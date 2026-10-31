/** Cheil fork: only the office home can toggle recording or expose the pairing value. */
import type { IpcMain } from 'electron'
import { mkdir } from 'node:fs/promises'
import {
  JOURNAL_CHANNEL,
  type JournalReply,
  type JournalRequest,
} from '../../shared/cheil-journal-api'
import { JournalServer } from './journal-server'
import { DAY_RE, JournalStore } from './journal-store'

export function registerJournalIpc(deps: {
  ipc: Pick<IpcMain, 'handle'>
  root(): string
  extensionDir(): string
  isHome(sender: unknown): boolean
  copy(text: string): void
  openFolder(path: string): Promise<string>
  openDocument(path: string): boolean
  onQuit(close: () => void): void
}) {
  let service: JournalServer | null = null
  const receiver = () => (service ??= new JournalServer(new JournalStore(deps.root())))
  deps.onQuit(() => service?.close())
  deps.ipc.handle(
    JOURNAL_CHANNEL,
    async (event: { sender: unknown }, request: JournalRequest): Promise<JournalReply> => {
      if (!deps.isHome(event.sender) || !request || typeof request !== 'object')
        return { ok: false, reason: 'invalid' }
      try {
        service = receiver()
        await service.start()
        if (request.op === 'record') {
          if (typeof request.enabled !== 'boolean' || !service.ready)
            return { ok: false, reason: 'failed' }
          await service.store.setEnabled(request.enabled)
        } else if (request.op === 'pair-confirm') {
          if (typeof request.code !== 'string' || !service.pairing.approve(request.code))
            return { ok: false, reason: 'invalid' }
        } else if (request.op === 'copy-connection') {
          deps.copy(JSON.stringify(await service.store.connection()))
        } else if (request.op === 'extension-folder') {
          if (await deps.openFolder(deps.extensionDir())) return { ok: false, reason: 'failed' }
        } else if (request.op === 'folder') {
          await mkdir(service.store.root, { recursive: true })
          if (await deps.openFolder(service.store.root)) return { ok: false, reason: 'failed' }
        } else if (request.op === 'open') {
          if (!DAY_RE.test(request.day) || !deps.openDocument(service.store.pathOf(request.day)))
            return { ok: false, reason: 'invalid' }
        } else if (
          request.op !== 'status' ||
          (request.day !== undefined && !DAY_RE.test(request.day))
        ) {
          return { ok: false, reason: 'invalid' }
        }
        return {
          ok: true,
          view: {
            ...(await service.store.view(
              request.op === 'status' ? request.day : undefined,
              service.ready,
            )),
            pairingCode: service.pairing.code(),
          },
        }
      } catch {
        return { ok: false, reason: 'failed' }
      }
    },
  )
  return { start: () => receiver().start() }
}
