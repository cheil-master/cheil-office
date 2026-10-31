/** Cheil fork: style extraction is isolated from the shell UI and has no network calls. */
import { extractDocumentStyleFile } from './document-style'
const port = (
  process as unknown as {
    parentPort: {
      once(event: string, fn: (event: { data: { path: string } }) => void): void
      postMessage(data: unknown): void
    }
  }
).parentPort
port.once('message', async ({ data }) => {
  try {
    port.postMessage({ ok: true, profile: await extractDocumentStyleFile(data.path) })
  } catch {
    port.postMessage({ ok: false })
  }
})
