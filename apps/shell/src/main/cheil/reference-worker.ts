/** Cheil fork: system OCR runs outside the UI/main event loop. Words never leave this worker. */
import {
  createVisionOcrEngine,
  createWindowsOcrEngine,
} from '../../../../../packages/pdf2docx/src/ocr-vision'
const port = (
  process as unknown as {
    parentPort: {
      once(event: string, fn: (e: { data: { png: Uint8Array; helpers: string[] } }) => void): void
      postMessage(v: unknown): void
    }
  }
).parentPort
port?.once('message', ({ data }) => {
  try {
    const create = process.platform === 'darwin' ? createVisionOcrEngine : createWindowsOcrEngine
    const ocr = data.helpers.map((p) => create(p)).find(Boolean)
    const result = ocr?.(data.png, { widthPt: 1, heightPt: 1 })
    port.postMessage({
      ok: !!result,
      lines: result?.lines.map((l) => ({ box: l.box, confidence: l.confidence })) ?? [],
    })
  } catch {
    port.postMessage({ ok: false })
  }
})
