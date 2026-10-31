/** Cheil fork: editable native Office objects from the same plan used by the preview. */
import type JSZip from 'jszip'
import type { StyleSelection } from '../../shared/cheil-style-api'
import {
  planReference,
  referenceSize,
  type ReferenceTemplate,
  type PlannedRegion,
} from '../../shared/reference-template'
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
export async function applyReferenceToOffice(
  zip: JSZip,
  t: ReferenceTemplate,
  choice: StyleSelection,
  format: 'docx' | 'pptx',
  title: string,
  body: string,
) {
  const pages = planReference(t, choice, title, body),
    size = referenceSize(t)
  const colors = {
    accent: (choice.accent ?? '#315C4C').slice(1),
    text: (choice.text ?? '#202020').slice(1),
    background: (choice.background ?? '#FFFFFF').slice(1),
  }
  const font = esc(choice.font ?? 'Arial')
  if (format === 'pptx') {
    const original = await zip.file('ppt/slides/slide1.xml')!.async('string')
    const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string')
    const shape = (e: PlannedRegion, id: number) => {
      const r = e.region,
        x = Math.round(r.x * size.width * 12700),
        y = Math.round(r.y * size.height * 12700),
        w = Math.round(r.w * size.width * 12700),
        h = Math.round(r.h * size.height * 12700)
      const fill =
        r.fill === 'none'
          ? '<a:noFill/>'
          : `<a:solidFill><a:srgbClr val="${colors[r.fill]}">${r.role === 'decoration' ? '<a:alpha val="15000"/>' : ''}</a:srgbClr></a:solidFill>`
      // Text color is chosen independently of the role when a solid fill is present.
      const color =
        r.fill === 'accent' ? colors.background : r.role === 'title' ? colors.accent : colors.text
      const text = e.lines
        .map(
          (line) =>
            `<a:p><a:pPr algn="${{ left: 'l', center: 'ctr', right: 'r' }[r.align]}"><a:lnSpc><a:spcPct val="130000"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft></a:pPr><a:r><a:rPr lang="ko-KR" sz="${Math.round(e.fontPt * 100)}" b="${r.role === 'title' ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${font}"/><a:ea typeface="${font}"/></a:rPr><a:t xml:space="preserve">${esc(line)}</a:t></a:r><a:endParaRPr sz="${Math.round(e.fontPt * 100)}"/></a:p>`,
        )
        .join('')
      return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${r.role}-${esc(r.id)}"/><p:cNvSpPr txBox="${r.geometry === 'none' ? 1 : 0}"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="${r.geometry === 'none' ? 'rect' : r.geometry}"><a:avLst/></a:prstGeom>${fill}<a:ln w="12700">${r.role !== 'decoration' && r.geometry !== 'none' ? `<a:solidFill><a:srgbClr val="${colors.accent}"/></a:solidFill>` : '<a:noFill/>'}</a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" anchor="t" lIns="101600" rIns="101600" tIns="76200" bIns="76200"><a:noAutofit/></a:bodyPr><a:lstStyle/>${text || '<a:p/>'}</p:txBody></p:sp>`
    }
    for (const [i, page] of pages.entries()) {
      const xml = original.replace(
        /<p:sp>[\s\S]*<\/p:sp>/,
        page.elements.map((e, j) => shape(e, j + 2)).join(''),
      )
      zip.file(`ppt/slides/slide${i + 1}.xml`, xml)
      zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, rels)
    }
    const presentation = await zip.file('ppt/presentation.xml')!.async('string')
    zip.file(
      'ppt/presentation.xml',
      presentation
        .replace(
          /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
          `<p:sldIdLst>${pages.map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdPage${i + 1}"/>`).join('')}</p:sldIdLst>`,
        )
        .replace(
          /<p:sldSz[^>]*\/>/,
          `<p:sldSz cx="${Math.round(size.width * 12700)}" cy="${Math.round(size.height * 12700)}" type="custom"/>`,
        ),
    )
    const presentationRels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string')
    zip.file(
      'ppt/_rels/presentation.xml.rels',
      presentationRels
        .replace(/<Relationship [^>]*Type="[^"]*\/slide"[^>]*\/>/g, '')
        .replace(
          '</Relationships>',
          pages
            .map(
              (_, i) =>
                `<Relationship Id="rIdPage${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
            )
            .join('') + '</Relationships>',
        ),
    )
    const ct = await zip.file('[Content_Types].xml')!.async('string')
    zip.file(
      '[Content_Types].xml',
      ct.replace(
        '</Types>',
        pages
          .slice(1)
          .map(
            (_, i) =>
              `<Override PartName="/ppt/slides/slide${i + 2}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
          )
          .join('') + '</Types>',
      ),
    )
  } else {
    // Word has a flowing page model: rows of related regions become editable card tables.
    const para = (e: PlannedRegion, breakBefore = false) => {
      const r = e.region,
        pt = r.role === 'title' ? Math.min(36, e.fontPt) : Math.min(18, e.fontPt)
      const color =
        r.fill === 'accent' ? colors.background : r.role === 'title' ? colors.accent : colors.text
      return `<w:p><w:pPr>${breakBefore ? '<w:pageBreakBefore/>' : ''}<w:pStyle w:val="${r.role === 'title' ? 'Heading1' : 'Normal'}"/><w:jc w:val="${r.align}"/><w:spacing w:after="160"/>${r.fill !== 'none' ? `<w:shd w:fill="${colors[r.fill]}"/>` : ''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}"/><w:sz w:val="${Math.round(pt * 2)}"/><w:color w:val="${color}"/>${r.role === 'title' ? '<w:b/>' : ''}</w:rPr>${e.lines.map((line, i) => `${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(line)}</w:t>`).join('')}</w:r></w:p>`
    }
    const content = pages
      .map((page, i) => {
        const title = page.elements.find((e) => e.region.role === 'title')!
        const body = page.elements.filter(
          (e) => ['body', 'label'].includes(e.region.role) && e.lines.length,
        )
        const rows: PlannedRegion[][] = []
        for (const e of body) {
          const last = rows.at(-1)
          if (last && Math.abs(last[0].region.y - e.region.y) < 0.035) last.push(e)
          else rows.push([e])
        }
        return (
          para(title, i > 0) +
          rows
            .map((row) => {
              if (
                row.length === 1 &&
                row[0].region.geometry === 'none' &&
                row[0].region.fill === 'none'
              )
                return para(row[0])
              const total = row.reduce((s, e) => s + e.region.w, 0)
              return `<w:tbl><w:tblPr><w:tblW w:w="9026" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="120" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="single" w:sz="4" w:color="${colors.accent}"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${row.map((e) => `<w:gridCol w:w="${Math.round((9026 * e.region.w) / total)}"/>`).join('')}</w:tblGrid><w:tr>${row.map((e) => `<w:tc><w:tcPr><w:tcW w:w="${Math.round((9026 * e.region.w) / total)}" w:type="dxa"/>${e.region.fill !== 'none' ? `<w:shd w:fill="${colors[e.region.fill]}"/>` : ''}</w:tcPr>${para(e)}</w:tc>`).join('')}</w:tr></w:tbl><w:p/>`
            })
            .join('')
        )
      })
      .join('')
    const original = await zip.file('word/document.xml')!.async('string')
    zip.file(
      'word/document.xml',
      original.replace(/<w:body>[\s\S]*?(<w:sectPr>)/, `<w:body>${content}$1`),
    )
  }
  zip.file('cheil-template.json', JSON.stringify({ template: t, selection: choice }))
}
