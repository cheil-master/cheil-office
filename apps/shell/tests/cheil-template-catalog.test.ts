/** Cheil fork: every visible template resolves to one shipped asset. */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { AGENCY_TEMPLATES, DEFAULT_SET } from '../src/renderer/src/cheil/templates'
describe('Cheil template catalog', () => {
  it('ships exactly the requested four formats and matching skill titles', () => {
    expect(AGENCY_TEMPLATES.map((t) => [t.ko.title, t.ext])).toEqual([
      ['OT 및 킥오프', 'pptx'],
      ['컨택리포트', 'docx'],
      ['미디어브리프', 'xlsx'],
      ['결과보고서', 'pptx'],
    ])
    const root = resolve(__dirname, '../resources/builtin-skills')
    for (const t of AGENCY_TEMPLATES) {
      const directory = join(root, t.skill)
      const skill = readFileSync(join(directory, 'SKILL.md'), 'utf8')
      expect(skill).toContain(`ieum-title: ${t.ko.title}`)
      const asset = skill.match(/ieum-template: (.+)/)![1]!.trim()
      expect(existsSync(join(directory, asset))).toBe(true)
      expect(readdirSync(join(directory, 'assets'))).toEqual([`${t.ko.title}.${t.ext}`])
    }
    for (const removed of ['cheil-proposal', 'cheil-pitch-analysis'])
      expect(existsSync(join(root, removed, 'SKILL.md'))).toBe(false)
    for (const id of DEFAULT_SET) expect(AGENCY_TEMPLATES.some((t) => t.skill === id)).toBe(true)
  })
})

it('media brief declares one-page-wide native printing without altering cell content', async () => {
  const path = resolve(
    __dirname,
    '../resources/builtin-skills/cheil-media-plan/assets/미디어브리프.xlsx',
  )
  const book = await JSZip.loadAsync(readFileSync(path))
  const sheet = await book.file('xl/worksheets/sheet1.xml')!.async('string')
  const workbook = await book.file('xl/workbook.xml')!.async('string')
  expect(sheet).toContain('fitToPage="1"')
  expect(sheet).toContain('fitToWidth="1"')
  expect(sheet).toContain('fitToHeight="0"')
  expect(workbook).toContain('_xlnm.Print_Area')
  expect(workbook).toContain('$A$1:$H$48')
})
