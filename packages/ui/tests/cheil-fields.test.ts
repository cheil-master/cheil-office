import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildCheilFillPrompt, findCheilSlots } from '../src/cheil-fill'
import {
  CHEIL_FIELDS,
  cheilBudgetText,
  cheilFieldHint,
  cheilFieldOf,
  cheilFieldValueFor,
  cheilFieldValues,
  cheilToday,
} from '../src/cheil-fields'

const SKILLS = join(__dirname, '..', '..', '..', 'apps', 'shell', 'resources', 'builtin-skills')

/** every `[blank]` in a template's text, in order (repeats kept) */
async function templateBlanks(path: string): Promise<string[]> {
  const zip = await JSZip.loadAsync(readFileSync(path))
  const parts = Object.keys(zip.files)
    .filter((n) =>
      /^(word\/document\.xml|ppt\/slides\/slide\d+\.xml|xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(
        n,
      ),
    )
    .sort()
  const out: string[] = []
  for (const name of parts) {
    const xml = await zip.file(name)!.async('string')
    for (const m of xml.matchAll(/<(w:t|a:t|t)(?:\s[^>]*)?>([^<]*)<\/\1>/g)) {
      // openpyxl writes non-ASCII text as numeric character references
      const text = m[2]!
        .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
      for (const slot of findCheilSlots(text)) out.push(slot.placeholder)
    }
  }
  return out
}

describe('Cheil fork: common template blanks', () => {
  it('names each blank once across the dictionary', () => {
    const names = CHEIL_FIELDS.flatMap((f) => [f.placeholder, ...f.aliases])
    expect(new Set(names).size).toBe(names.length)
    expect(new Set(CHEIL_FIELDS.map((f) => f.key)).size).toBe(CHEIL_FIELDS.length)
    for (const f of CHEIL_FIELDS) expect(f.placeholder).toMatch(/^\[[^[\]]+\]$/)
  })

  it('reads aliases and spacing as the common blank', () => {
    expect(cheilFieldOf('[광고주명]')?.placeholder).toBe('[광고주]')
    expect(cheilFieldOf('[ 광고주 ]')?.key).toBe('client')
    expect(cheilFieldOf('[예산 합계]')?.placeholder).toBe('[총예산]')
    expect(cheilFieldOf('[이 광고로 해결할 문제 한 문장]')).toBeNull()
    expect(cheilFieldHint('[타깃]')).toContain('나이·생활·구매 맥락')
  })

  it('turns a card into the common blanks it fills', () => {
    const values = cheilFieldValues(
      {
        campaign: '에어린 봄 런칭',
        client: '가상전자',
        brand: '에어린',
        start: '2027-03-01',
        end: '',
        budget: '500000000',
        target: '30대 1인 가구\n직장인',
        kpi: '',
      },
      '2026-10-25',
    )
    expect(values.get('[캠페인명]')).toBe('에어린 봄 런칭')
    expect(values.get('[캠페인 기간]')).toBe('2027-03-01 ~ [확인 필요]')
    expect(values.get('[총예산]')).toBe('500,000,000원')
    expect(values.get('[타깃]')).toBe('30대 1인 가구 직장인')
    expect(values.get('[작성일]')).toBe('2026-10-25')
    // an empty card field is left for the model or a person
    expect(values.has('[KPI]')).toBe(false)
    expect(values.has('[팀명]')).toBe(false)
    expect(cheilFieldValueFor('[광고주명]', values)).toBe('가상전자')
    expect(cheilFieldValueFor('[회의명]', values)).toBeNull()
  })

  it('keeps a budget written in words as typed, and dates are local days', () => {
    expect(cheilBudgetText('5억 원')).toBe('5억 원')
    expect(cheilBudgetText('1,200,000')).toBe('1,200,000원')
    expect(cheilToday(new Date(2027, 0, 5, 23, 59))).toBe('2027-01-05')
  })

  it("tells the model what a common blank means, and leaves other blanks' lines as they were", () => {
    const slots = findCheilSlots('핵심 타깃: [타깃]\n[이 광고로 해결할 문제 한 문장]')
    const { user } = buildCheilFillPrompt({
      request: '채워 줘',
      skillText: '',
      materials: '',
      slots,
    })
    expect(user).toContain(
      'S1: [타깃] (뜻: 누구에게 — 나이·생활·구매 맥락) — 문맥: 핵심 타깃: [타깃]',
    )
    expect(user).toContain('S2: [이 광고로 해결할 문제 한 문장] — 문맥:')
  })

  it('builds every shipped template with the common names only, other blanks once each', async () => {
    const aliases = new Map(
      CHEIL_FIELDS.flatMap((f) => f.aliases.map((a) => [a, f.placeholder] as const)),
    )
    const canonical = new Set(CHEIL_FIELDS.map((f) => f.placeholder))
    const templates = readdirSync(SKILLS)
      .filter((d) => d.startsWith('cheil-'))
      .flatMap((d) => {
        try {
          return readdirSync(join(SKILLS, d, 'assets')).map((f) => join(SKILLS, d, 'assets', f))
        } catch {
          return []
        }
      })
    expect(templates).toHaveLength(6)
    for (const path of templates) {
      const blanks = await templateBlanks(path)
      expect(blanks.length, path).toBeGreaterThan(0)
      expect(
        blanks.filter((b) => aliases.has(b)),
        path,
      ).toEqual([])
      const others = blanks.filter((b) => !canonical.has(b))
      expect(
        others.filter((b, i) => others.indexOf(b) !== i),
        path,
      ).toEqual([])
      // every template carries the client's name from the card
      expect(blanks, path).toContain('[광고주]')
    }
  })
})
