/** Cheil fork: isolated, local-only PDF page extraction and system OCR. */
import { readFileSync } from 'node:fs'
import {
  createVisionOcrEngine,
  createWindowsOcrEngine,
} from '../../../../../packages/pdf2docx/src/ocr-vision'
import {
  withPdfDocument,
  renderPageByIndexPng,
  type PdfiumModule,
} from '../../../../../packages/pdf2docx/src/extract'
const port = (
  process as unknown as {
    parentPort: {
      once(
        event: string,
        fn: (event: {
          data: { path: string; wasm: string; helpers: string[]; renderPages?: number[] }
        }) => void,
      ): void
      postMessage(value: unknown): void
    }
  }
).parentPort
port?.once('message', async ({ data }) => {
  try {
    const { init } = await import('@embedpdf/pdfium')
    const bytes = readFileSync(data.wasm)
    const wrapped = await init({
      wasmBinary: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      thisProgram: 'cheil-wiki',
    })
    const module = wrapped as unknown as { pdfium?: PdfiumModule }
    const m = (module.pdfium ?? wrapped) as unknown as PdfiumModule & { _PDFiumExt_Init(): void }
    m._PDFiumExt_Init()
    // Render only the reviewed page pixels; never upload the source PDF or hidden objects.
    if (data.renderPages) {
      const images = withPdfDocument(m, readFileSync(data.path), (doc) =>
        data.renderPages!.map((number) => {
          const page = m._FPDF_LoadPage(doc, number - 1)
          if (!page) throw new Error('page')
          const scale = Math.min(
            5,
            3600 / Math.max(1, m._FPDF_GetPageWidthF(page), m._FPDF_GetPageHeightF(page)),
          )
          m._FPDF_ClosePage(page)
          const image = renderPageByIndexPng(m, doc, number - 1, scale)
          if (!image || image.data.length > 10_000_000) throw new Error('render')
          return { page: number, png: Buffer.from(image.data).toString('base64') }
        }),
      )
      port.postMessage({ ok: true, images })
      return
    }
    const create = process.platform === 'darwin' ? createVisionOcrEngine : createWindowsOcrEngine
    const ocr = data.helpers.map((p) => create(p)).find(Boolean)
    const result = withPdfDocument(m, readFileSync(data.path), (doc) => {
      const totalPages = m._FPDF_GetPageCount(doc),
        sections: string[] = [],
        unreadablePages: number[] = []
      let ocrPages = 0
      for (let index = 0; index < Math.min(totalPages, 250); index++) {
        const page = m._FPDF_LoadPage(doc, index)
        let text = '',
          method = 'text'
        if (page) {
          const tp = m._FPDFText_LoadPage(page)
          try {
            if (tp) {
              const count = Math.min(m._FPDFText_CountChars(tp), 200_000),
                ptr = m._malloc((count + 1) * 2)
              try {
                const n = m._FPDFText_GetText(tp, 0, count, ptr)
                text = new TextDecoder('utf-16le').decode(
                  m.HEAPU8.subarray(ptr, ptr + Math.max(0, n - 1) * 2),
                )
              } finally {
                m._free(ptr)
              }
            }
          } finally {
            if (tp) m._FPDFText_ClosePage(tp)
            m._FPDF_ClosePage(page)
          }
          if (text.replace(/\s/g, '').length < 80) {
            let recognized = ''
            if (ocr) {
              const p = m._FPDF_LoadPage(doc, index)
              let scale = 1
              if (p) {
                scale = Math.min(
                  3,
                  2600 / Math.max(1, m._FPDF_GetPageWidthF(p), m._FPDF_GetPageHeightF(p)),
                )
                m._FPDF_ClosePage(p)
              }
              const render = renderPageByIndexPng(m, doc, index, scale)
              if (render)
                recognized =
                  ocr(render.data, { widthPt: render.pixelWidth, heightPt: render.pixelHeight })
                    ?.lines.map((l) => l.text)
                    .join('\n') ?? ''
            }
            if (recognized.trim().length > text.trim().length + 20) {
              text = recognized
              method = 'OCR'
              ocrPages++
            } else if (text.replace(/\s/g, '').length < 40) unreadablePages.push(index + 1)
          }
        } else unreadablePages.push(index + 1)
        sections.push(
          `## PDF ${index + 1} (${method})\n${text.trim() || '[No readable text: verification required]'}`,
        )
      }
      const body = sections.join('\n\n')
      return {
        body: body.slice(0, 1_000_000),
        extraction: {
          revision: 2,
          totalPages,
          ocrPages,
          unreadablePages,
          truncated: totalPages > 250 || body.length > 1_000_000,
        },
      }
    })
    port.postMessage({ ok: true, ...result })
  } catch {
    port.postMessage({ ok: false })
  }
})
