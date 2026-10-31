/** Cheil fork: row labels are opt-in and refer to XML rows, including sparse sheets. */
import { expect, it } from 'vitest'
import JSZip from 'jszip'
import { xlsxToText } from '../src/xlsx'
import { buildXlsxFixture } from './helpers/fixtures'
it('preserves real sparse row numbers without changing default callers', async () => {
  const zip = await JSZip.loadAsync(await buildXlsxFixture())
  const part = zip.file('xl/worksheets/sheet1.xml')!
  const xml = (await part.async('text')).replace(/<row r="2"/g, '<row r="760"')
  zip.file('xl/worksheets/sheet1.xml', xml)
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  expect(await xlsxToText(bytes)).not.toContain('[row ')
  expect(await xlsxToText(bytes, { rowNumbers: true })).toContain('[row 760]')
})
