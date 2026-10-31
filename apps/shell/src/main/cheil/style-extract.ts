/** Cheil fork: dispose the style reader on timeout or app exit. */
import { app, utilityProcess } from 'electron'
import type { DocumentStyle } from '../../shared/cheil-style-api'
import workerPath from './style-extract-worker?modulePath'
export function readDocumentStyle(path: string): Promise<DocumentStyle | null> {
  return new Promise((resolve) => {
    const child = utilityProcess.fork(workerPath, [], {
      stdio: 'ignore',
      serviceName: 'Cheil document style',
    })
    let done = false
    const finish = (profile: DocumentStyle | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      app.off('before-quit', cancel)
      child.kill()
      resolve(profile)
    }
    const cancel = () => finish(null)
    const timer = setTimeout(cancel, 120_000)
    app.once('before-quit', cancel)
    child.once('exit', cancel)
    child.once('message', (r: { ok: boolean; profile?: DocumentStyle }) =>
      finish(r.ok && r.profile ? r.profile : null),
    )
    child.postMessage({ path })
  })
}
