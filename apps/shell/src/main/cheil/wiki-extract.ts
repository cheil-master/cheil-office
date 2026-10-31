/** Cheil fork: document extraction stays local; PDF OCR cannot stall the shell. */
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, utilityProcess } from 'electron'
import { parseFileToText } from '@genoffice/file-parse'
import { pdfiumWasmPath } from '../../../../pdf/src/main/wasm-path'
import type { WikiExtraction } from '../../shared/cheil-wiki-api'
import workerPath from './wiki-extract-worker?modulePath'

export async function renderWikiPages(
  path: string,
  pages: number[],
): Promise<Array<{ page: number; png: string }> | null> {
  return new Promise((resolve) => {
    const child = utilityProcess.fork(workerPath, [], {
      stdio: 'ignore',
      serviceName: 'Cheil wiki page preview',
    })
    let done = false
    const finish = (images: Array<{ page: number; png: string }> | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      app.off('before-quit', cancel)
      child.kill()
      resolve(images)
    }
    const cancel = () => finish(null)
    const timer = setTimeout(cancel, 120_000)
    app.once('before-quit', cancel)
    child.once('exit', cancel)
    child.once('message', (r: { ok: boolean; images?: Array<{ page: number; png: string }> }) =>
      finish(r.ok ? (r.images ?? null) : null),
    )
    child.postMessage({ path, wasm: pdfiumWasmPath(), helpers: [], renderPages: pages })
  })
}
export async function readWikiText(path: string): Promise<WikiExtraction | null> {
  if (extname(path).toLowerCase() !== '.pdf') {
    const parsed = await parseFileToText(path, { xlsxRowNumbers: true })
    return parsed.ok && parsed.kind === 'text' ? { body: parsed.text ?? '' } : null
  }
  return new Promise((resolve) => {
    const helper = process.platform === 'darwin' ? 'vision-ocr' : 'win-ocr.exe'
    const here = dirname(fileURLToPath(import.meta.url))
    const child = utilityProcess.fork(workerPath, [], {
      stdio: 'ignore',
      serviceName: 'Cheil wiki OCR',
    })
    const finish = (value: WikiExtraction | null) => {
      clearTimeout(timer)
      app.off('before-quit', cancel)
      child.kill()
      resolve(value)
    }
    const cancel = () => finish(null)
    const timer = setTimeout(cancel, 600_000)
    app.once('before-quit', cancel)
    child.once('exit', () => {
      clearTimeout(timer)
      app.off('before-quit', cancel)
      resolve(null)
    })
    child.once('message', (reply: { ok: boolean } & WikiExtraction) =>
      finish(reply.ok ? { body: reply.body, extraction: reply.extraction } : null),
    )
    child.postMessage({
      path,
      wasm: pdfiumWasmPath(),
      helpers: [
        join(process.resourcesPath, 'ocr', helper),
        join(here, '../../../../packages/pdf2docx/ocr-helper', helper),
      ],
    })
  })
}
