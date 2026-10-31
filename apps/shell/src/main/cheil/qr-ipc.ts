/** Cheil fork: home-only local QR IPC; the renderer never chooses a file path. */
import type { IpcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { CHEIL_QR_CHANNEL, type QrReply, type QrRequest } from '../../shared/cheil-qr-api'
import { qrBytes } from './qr-service'
export function registerQrIpc(deps: {
  ipc: Pick<IpcMain, 'handle'>
  isHome(sender: unknown): boolean
  pickSave(format: string): Promise<string | null>
  copyImage(png: Buffer): void
}) {
  let busy = false
  deps.ipc.handle(
    CHEIL_QR_CHANNEL,
    async (event: { sender: unknown }, req: QrRequest): Promise<QrReply> => {
      if (!deps.isHome(event.sender) || !req || typeof req !== 'object')
        return { ok: false, reason: 'invalid' }
      if (busy) return { ok: false, reason: 'busy' }
      busy = true
      try {
        if (req.op === 'preview' || req.op === 'copy') {
          const bytes = Buffer.from(await qrBytes(req.text, req.size, 'png'))
          if (req.op === 'copy') {
            deps.copyImage(bytes)
            return { ok: true }
          }
          return { ok: true, png: `data:image/png;base64,${bytes.toString('base64')}` }
        }
        if (req.op === 'save') {
          if (!['png', 'svg'].includes(req.format)) throw Error('invalid')
          const bytes = await qrBytes(req.text, req.size, req.format)
          const path = await deps.pickSave(req.format)
          if (!path) return { ok: true, canceled: true }
          if (extname(path).toLowerCase() !== `.${req.format}`) throw Error('invalid')
          await writeFile(path, bytes)
          return { ok: true }
        }
        return { ok: false, reason: 'invalid' }
      } catch (e) {
        return {
          ok: false,
          reason: e instanceof Error && e.message === 'invalid' ? 'invalid' : 'failed',
        }
      } finally {
        busy = false
      }
    },
  )
}
