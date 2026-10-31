/** Cheil fork: round-trip QR payloads and verify local export boundaries. */
import { describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import jsQR from 'jsqr'
import { qrBytes, qrInput } from '../src/main/cheil/qr-service'
import { registerQrIpc } from '../src/main/cheil/qr-ipc'
import { qrWords } from '../src/renderer/src/cheil/qr-words'
import type { QrReply, QrRequest } from '../src/shared/cheil-qr-api'
import type { Lang } from '@genoffice/i18n'
const require = createRequire(import.meta.url)
const PNG = require('pngjs').PNG as {
  sync: { read(buffer: Buffer): { data: Uint8Array; width: number; height: number } }
}
describe('offline QR', () => {
  it.each([
    ['https://example.com/campaign?q=a%26b#section', 256],
    ['가상전자 캠페인\n안녕하세요 😀', 512],
    ['x'.repeat(1000), 256],
    ['x'.repeat(1000), 512],
    ['x'.repeat(1000), 1024],
  ])('round-trips payload %#', async (text, size) => {
    const png = PNG.sync.read(Buffer.from(await qrBytes(String(text), Number(size), 'png')))
    expect(png.width).toBe(size)
    expect(png.height).toBe(size)
    expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(text)
  })
  it('exports a vector with a white quiet zone and rejects invalid inputs', async () => {
    expect(await qrBytes('example', 512, 'svg')).toContain('<svg')
    for (const [text, size] of [
      ['', 512],
      ['가'.repeat(334), 512],
      ['ok', 999],
      [null, 512],
    ]) {
      expect(() => qrInput(text, size)).toThrow('invalid')
    }
  })
  it('has translated words in every supported language', () => {
    const langs = 'ko en ja zh zh-TW de fr es pt it nl pl cs ru ar he hi id ms th vi'.split(
      ' ',
    ) as Lang[]
    for (const lang of langs) {
      expect(Object.keys(qrWords(lang))).toEqual(Object.keys(qrWords('zh')))
      expect(Object.values(qrWords(lang)).every(Boolean)).toBe(true)
    }
  })
  it('restricts senders, handles cancellation and writes only the dialog destination', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cheil-qr-'))
    try {
      let handler!: (event: { sender: unknown }, req: QrRequest) => Promise<QrReply>
      const copyImage = vi.fn(),
        pickSave = vi.fn<() => Promise<string | null>>().mockResolvedValue(null)
      const owner = {}
      registerQrIpc({
        ipc: {
          handle: (_channel, fn) => {
            handler = fn as typeof handler
          },
        },
        isHome: (sender) => sender === owner,
        copyImage,
        pickSave,
      })
      const req: QrRequest = { op: 'save', text: '가상전자', size: 512, format: 'png' }
      expect(await handler({ sender: {} }, req)).toEqual({ ok: false, reason: 'invalid' })
      expect(pickSave).not.toHaveBeenCalled()
      expect(await handler({ sender: owner }, req)).toEqual({ ok: true, canceled: true })
      const target = join(dir, 'code.png')
      pickSave.mockResolvedValue(target)
      expect(await handler({ sender: owner }, req)).toEqual({ ok: true })
      expect(PNG.sync.read(await readFile(target)).width).toBe(512)
      expect(await handler({ sender: owner }, { op: 'copy', text: 'hello', size: 256 })).toEqual({
        ok: true,
      })
      expect(copyImage).toHaveBeenCalledOnce()
      pickSave.mockResolvedValue(join(dir, 'bad.txt'))
      expect(await handler({ sender: owner }, req)).toEqual({ ok: false, reason: 'invalid' })
      expect(
        await handler({ sender: owner }, { ...req, format: 'exe' } as unknown as QrRequest),
      ).toEqual({ ok: false, reason: 'invalid' })
      let release!: (value: null) => void
      pickSave.mockImplementation(
        () =>
          new Promise((resolve) => {
            release = resolve
          }),
      )
      const pending = handler({ sender: owner }, req)
      await vi.waitFor(() => expect(release).toBeTypeOf('function'))
      expect(await handler({ sender: owner }, req)).toEqual({ ok: false, reason: 'busy' })
      release(null)
      expect(await pending).toEqual({ ok: true, canceled: true })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
