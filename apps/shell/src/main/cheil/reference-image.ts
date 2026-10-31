/** Cheil fork: local image-to-template analysis, bounded inputs, no external model requests. */
import { app, nativeImage, utilityProcess } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { inferReference, detectReferenceShapes, type ReferenceLine } from './reference-analysis'
import { contrast, moodboardStyle } from './moodboard-style'
import workerPath from './reference-worker?modulePath'
export async function analyzeReferenceImage(bytes: Uint8Array, name: string, url?: string) {
  if (bytes.length > 10_000_000) throw Error('invalid-reference-image')
  const image = nativeImage.createFromBuffer(Buffer.from(bytes))
  const size = image.getSize()
  if (
    image.isEmpty() ||
    size.width < 100 ||
    size.height < 100 ||
    size.width * size.height > 40000000
  )
    throw Error('invalid-reference-image')
  const scale = Math.min(1, 1800 / Math.max(size.width, size.height))
  const png = image
    .resize({ width: Math.round(size.width * scale), height: Math.round(size.height * scale) })
    .toPNG()
  const lines = await new Promise<ReferenceLine[]>((resolve, reject) => {
    const child = utilityProcess.fork(workerPath, [], {
      stdio: 'ignore',
      serviceName: 'Cheil reference OCR',
    })
    let done = false
    const finish = (lines?: ReferenceLine[]) => {
      if (done) return
      done = true
      clearTimeout(timer)
      app.off('before-quit', cancel)
      child.kill()
      if (lines) resolve(lines)
      else reject(Error('unreadable-reference'))
    }
    const cancel = () => finish()
    const timer = setTimeout(cancel, 40000)
    app.once('before-quit', cancel)
    child.once('exit', cancel)
    child.once('message', (r: { ok: boolean; lines?: ReferenceLine[] }) =>
      finish(r.ok ? r.lines : undefined),
    )
    const helper = process.platform === 'darwin' ? 'vision-ocr' : 'win-ocr.exe'
    child.postMessage({
      png,
      helpers: [
        join(process.resourcesPath, 'ocr', helper),
        join(
          dirname(fileURLToPath(import.meta.url)),
          '../../../../packages/pdf2docx/ocr-helper',
          helper,
        ),
      ],
    })
  })
  const small = image.resize({
    width: 160,
    height: Math.max(1, Math.round((160 * size.height) / size.width)),
  })
  const shapes = detectReferenceShapes(
    small.toBitmap(),
    small.getSize().width,
    small.getSize().height,
  )
  const data = moodboardStyle(
    { id: 'local', name, url: url ?? 'https://www.pinterest.com/', count: 1 },
    [image.resize({ width: 48, height: 48 }).toBitmap()],
    1,
  )
  const accent = data.profile.colors.find((c) => {
    const rgb = [1, 3, 5].map((i) => parseInt(c.value.slice(i, i + 2), 16))
    return Math.max(...rgb) - Math.min(...rgb) > 15
  })?.value
  if (accent) {
    let adjusted = accent
    while (contrast(adjusted, data.selection.background!) < 4.5)
      adjusted =
        '#' +
        [1, 3, 5]
          .map((i) =>
            Math.round(parseInt(adjusted.slice(i, i + 2), 16) * 0.9)
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')
          .toUpperCase()
    data.selection.accent = adjusted
  }
  data.selection.headingPt = 32
  data.selection.bodyPt = 18
  data.profile.template = inferReference(size.width / size.height, lines, shapes)
  data.profile.name = data.profile.name.replace(' · Moodboard', ' · Reference')
  data.profile.source = {
    ...(url ? { url } : {}),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    modified: true,
  }
  data.profile.warnings = [
    'local-geometry-review-required',
    'font-family-not-recognized',
    'semantic-roles-inferred',
  ]
  data.profile.shapes = shapes.map((s) => ({ value: s.geometry, count: 1, basis: 'direct' }))
  return data
}
