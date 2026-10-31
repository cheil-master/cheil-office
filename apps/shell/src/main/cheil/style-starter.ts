import { applyReferenceToOffice } from './reference-office'
/** Cheil fork: new Office starter documents with editable appearance; existing documents are untouched. */
import JSZip from 'jszip'
import type { DocumentStyle, StyleSelection } from '../../shared/cheil-style-api'
import { styleMarkdown } from './document-style'
import { readStyleSelection } from './style-instructions'
const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
const relationship = (id: string, type: string, target: string) =>
  `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`
const relationships = (rows: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rows.join('')}</Relationships>`
export function styleAttribution(profile: DocumentStyle): string {
  const source = profile.source
  return (
    [
      'Document appearance source',
      `Style: ${profile.name}`,
      source.author ? `Creator: ${source.author}` : 'Source: locally supplied document appearance',
      source.url ? `Source: ${source.url}` : '',
      source.revision ? `Revision: ${source.revision}` : '',
      source.license ? `License: ${source.license} (${source.licenseUrl ?? ''})` : '',
      source.sha256 ? `Source fingerprint: ${source.sha256}` : '',
      'Changes: appearance tokens adapted for an Office starter document. Source content, logos, images and font files are excluded.',
      'The appearance source does not grant rights to brand assets or font files.',
    ]
      .filter(Boolean)
      .join('\n') + '\n'
  )
}

export async function createStyledStarter(
  profile: DocumentStyle,
  selection: StyleSelection,
  format: 'docx' | 'pptx' | 'xlsx',
  title: string,
  body: string,
): Promise<Buffer> {
  if (
    !['docx', 'pptx', 'xlsx'].includes(format) ||
    typeof title !== 'string' ||
    typeof body !== 'string' ||
    title.length > 160 ||
    body.length > (profile.template ? 30000 : 600) ||
    [...(title + body)].some((c) => c.charCodeAt(0) < 32 && c !== '\n' && c !== '\t')
  )
    throw Error('invalid-starter-input')
  const choice = readStyleSelection(styleMarkdown(profile, selection))
  const font = escape(choice.font ?? 'Arial'),
    heading = choice.headingPt ?? 28,
    size = choice.bodyPt ?? 12
  const accent = (choice.accent ?? '#315C4C').slice(1),
    text = (choice.text ?? '#25332D').slice(1),
    background = (choice.background ?? '#FFFFFF').slice(1)
  const zip = new JSZip(),
    t = escape(title),
    b = escape(body)
  const overrides: string[] = []
  const part = (path: string, contentType: string, xml: string) => {
    zip.file(path, xml)
    overrides.push(`<Override PartName="/${path}" ContentType="${contentType}"/>`)
  }
  const office = 'application/vnd.openxmlformats-officedocument.'
  if (format === 'docx') {
    zip.file(
      '_rels/.rels',
      relationships([relationship('rId1', 'officeDocument', 'word/document.xml')]),
    )
    zip.file(
      'word/_rels/document.xml.rels',
      relationships([
        relationship('rId1', 'styles', 'styles.xml'),
        relationship('rId2', 'settings', 'settings.xml'),
      ]),
    )
    part(
      'word/document.xml',
      office + 'wordprocessingml.document.main+xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:background w:color="${background}"/><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${t}</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t xml:space="preserve">${b}</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    )
    const run = (pt: number, color: string) =>
      `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/><w:color w:val="${color}"/><w:sz w:val="${Math.round(pt * 2)}"/><w:szCs w:val="${Math.round(pt * 2)}"/>`
    part(
      'word/styles.xml',
      office + 'wordprocessingml.styles+xml',
      `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${run(size, text)}</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:rPr>${run(size, text)}</w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="240"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr>${run(heading, accent)}<w:b/></w:rPr></w:style></w:styles>`,
    )
    part(
      'word/settings.xml',
      office + 'wordprocessingml.settings+xml',
      '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:displayBackgroundShape/></w:settings>',
    )
  } else if (format === 'xlsx') {
    zip.file(
      '_rels/.rels',
      relationships([relationship('rId1', 'officeDocument', 'xl/workbook.xml')]),
    )
    part(
      'xl/workbook.xml',
      office + 'spreadsheetml.sheet.main+xml',
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
    )
    zip.file(
      'xl/_rels/workbook.xml.rels',
      relationships([
        relationship('rId1', 'worksheet', 'worksheets/sheet1.xml'),
        relationship('rId2', 'styles', 'styles.xml'),
      ]),
    )
    const f = (pt: number, color: string, bold = false) =>
      `<font><sz val="${pt}"/><color rgb="FF${color}"/><name val="${font}"/>${bold ? '<b/>' : ''}<family val="2"/></font>`
    part(
      'xl/styles.xml',
      office + 'spreadsheetml.styles+xml',
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2">${f(size, text)}${f(heading, accent, true)}</fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${background}"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    )
    part(
      'xl/worksheets/sheet1.xml',
      office + 'spreadsheetml.worksheet+xml',
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:A3"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="${Math.max(15, size * 1.4)}"/><cols><col min="1" max="1" width="70" customWidth="1"/></cols><sheetData><row r="1" ht="${Math.max(24, heading * 1.6)}" customHeight="1"><c r="A1" s="1" t="inlineStr"><is><t>${t}</t></is></c></row><row r="3"><c r="A3" s="0" t="inlineStr"><is><t>${b}</t></is></c></row></sheetData></worksheet>`,
    )
  } else {
    const pns =
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
    const group =
      '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
    const shape = (id: number, y: number, h: number, pt: number, color: string, content: string) =>
      `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="${y}"/><a:ext cx="10820400" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="ko-KR" sz="${Math.round(pt * 100)}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${font}"/><a:ea typeface="${font}"/><a:cs typeface="${font}"/></a:rPr><a:t>${content}</a:t></a:r><a:endParaRPr sz="${Math.round(pt * 100)}"/></a:p></p:txBody></p:sp>`
    zip.file(
      '_rels/.rels',
      relationships([relationship('rId1', 'officeDocument', 'ppt/presentation.xml')]),
    )
    part(
      'ppt/presentation.xml',
      office + 'presentationml.presentation.main+xml',
      `<p:presentation ${pns}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId2"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr sz="${Math.round(size * 100)}"><a:latin typeface="${font}"/><a:ea typeface="${font}"/></a:defRPr></a:defPPr></p:defaultTextStyle></p:presentation>`,
    )
    zip.file(
      'ppt/_rels/presentation.xml.rels',
      relationships([
        relationship('rId1', 'slide', 'slides/slide1.xml'),
        relationship('rId2', 'slideMaster', 'slideMasters/slideMaster1.xml'),
      ]),
    )
    part(
      'ppt/slides/slide1.xml',
      office + 'presentationml.slide+xml',
      `<p:sld ${pns}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${group}${shape(2, 685800, 1371600, heading, accent, t)}${shape(3, 2286000, 3429000, size, text, b)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    )
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      relationships([relationship('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')]),
    )
    const clrmap =
      '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
    part(
      'ppt/slideMasters/slideMaster1.xml',
      office + 'presentationml.slideMaster+xml',
      `<p:sldMaster ${pns}><p:cSld><p:spTree>${group}</p:spTree></p:cSld>${clrmap}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="${Math.round(heading * 100)}"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="${Math.round(size * 100)}"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:defPPr><a:defRPr sz="${Math.round(size * 100)}"/></a:defPPr></p:otherStyle></p:txStyles></p:sldMaster>`,
    )
    zip.file(
      'ppt/slideMasters/_rels/slideMaster1.xml.rels',
      relationships([
        relationship('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'),
        relationship('rId2', 'theme', '../theme/theme1.xml'),
      ]),
    )
    part(
      'ppt/slideLayouts/slideLayout1.xml',
      office + 'presentationml.slideLayout+xml',
      `<p:sldLayout ${pns} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
    )
    zip.file(
      'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      relationships([relationship('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')]),
    )
    const colors = {
      dk1: text,
      lt1: background,
      dk2: '44546A',
      lt2: 'E7E6E6',
      accent1: accent,
      accent2: 'ED7D31',
      accent3: 'A5A5A5',
      accent4: 'FFC000',
      accent5: '4472C4',
      accent6: '70AD47',
      hlink: '0563C1',
      folHlink: '954F72',
    }
    const fontBlock = (kind: string) =>
      `<a:${kind}><a:latin typeface="${font}"/><a:ea typeface="${font}"/><a:cs typeface="${font}"/></a:${kind}>`
    const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
    part(
      'ppt/theme/theme1.xml',
      office + 'theme+xml',
      `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Document style"><a:themeElements><a:clrScheme name="Document colors">${Object.entries(
        colors,
      )
        .map(([k, v]) => `<a:${k}><a:srgbClr val="${v}"/></a:${k}>`)
        .join(
          '',
        )}</a:clrScheme><a:fontScheme name="Document fonts">${fontBlock('majorFont')}${fontBlock('minorFont')}</a:fontScheme><a:fmtScheme name="Document formats"><a:fillStyleLst>${fill.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${`<a:ln w="9525">${fill}<a:prstDash val="solid"/></a:ln>`.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${fill.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`,
    )
  }
  const attribution = styleAttribution(profile)
  part(
    'docProps/custom.xml',
    office + 'custom-properties+xml',
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="AppearanceSource"><vt:lpwstr>${escape(attribution)}</vt:lpwstr></property></Properties>`,
  )
  const rootRelationships = await zip.file('_rels/.rels')!.async('string')
  zip.file(
    '_rels/.rels',
    rootRelationships.replace(
      '</Relationships>',
      relationship('rIdStyleSource', 'custom-properties', 'docProps/custom.xml') +
        '</Relationships>',
    ),
  )
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="txt" ContentType="text/plain"/>${overrides.join('')}</Types>`,
  )
  // Include both a standard custom property and a readable source manifest.
  zip.file('cheil-style-source.txt', attribution)
  if (profile.template) {
    if (format === 'xlsx') throw Error('invalid-reference-format')
    await applyReferenceToOffice(zip, profile.template, choice, format, title, body)
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
