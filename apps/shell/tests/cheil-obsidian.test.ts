/**
 * Cheil fork (plan item 13): campaigns as Obsidian notes. Nothing is written
 * before a vault is picked; then a campaign note links its document notes and
 * mail note, a document is written as Markdown once until it changes, and
 * mails are appended.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  campaignNote,
  createObsidianLink,
  obsidianNoteName,
  obsidianText,
} from '../src/main/cheil/obsidian'
import type { CampaignDetail } from '../src/shared/cheil-campaign-api'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cheil-obsidian-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const ID = '가상전자 - 에어린 봄 런칭'
const DETAIL: CampaignDetail = {
  id: ID,
  card: {
    campaign: '에어린 봄 런칭',
    client: '가상전자',
    brand: '에어린',
    start: '2027-03-01',
    end: '2027-04-30',
    budget: '500000000',
    target: '25~34세 | 1인 가구',
    kpi: '브랜드 인지도 30%',
    team: '비즈니스13팀',
    author: '홍길동',
  },
  createdAt: '2026-10-25T00:00:00.000Z',
  updatedAt: '2026-10-26T01:00:00.000Z',
  last: null,
  events: 2,
  timeline: [
    { at: '2026-10-25T00:00:00.000Z', kind: 'created', text: '캠페인을 만들었습니다' },
    { at: '2026-10-26T01:00:00.000Z', kind: 'task', text: '시안 2안 송부', due: '2026-11-03' },
  ],
}

describe('Cheil fork: Obsidian notes (plan item 13)', () => {
  it('turns table rows into a Markdown table and keeps headings and items', () => {
    expect(obsidianText('# 1. 과제\n- 인지도 높이기\n광고주 | 가상전자\n총예산 | 5억\n끝')).toBe(
      [
        '# 1. 과제',
        '- 인지도 높이기',
        '',
        '| 광고주 | 가상전자 |',
        '| --- | --- |',
        '| 총예산 | 5억 |',
        '',
        '끝',
      ].join('\n'),
    )
    expect(obsidianNoteName('a/b:c?')).toBe('a b c')
  })

  it('writes a campaign note with its card, timeline and links', () => {
    const note = campaignNote(DETAIL, ['크리에이티브 브리프'], true)
    expect(note).toContain('client: "가상전자"')
    expect(note).toContain('| 타깃 | 25~34세 \\| 1인 가구 |')
    expect(note).toContain(`[[Cheil/${ID}/문서/크리에이티브 브리프|크리에이티브 브리프]]`)
    expect(note).toContain(`[[Cheil/${ID}/주고받은 메일|주고받은 메일]]`)
    expect(note).toContain('시안 2안 송부 (마감 2026-11-03)')
  })

  it('writes nothing without a vault, then the notes once a vault is picked', async () => {
    const doc = join(dir, '크리에이티브 브리프.docx')
    writeFileSync(doc, 'x')
    let reads = 0
    const link = createObsidianLink({
      settingsPath: () => join(dir, 'user', 'cheil-settings.json'),
      readText: async () => (reads++, '광고주 | 가상전자\n# 1. 과제'),
      campaign: async (id) => (id === ID ? DETAIL : null),
      documents: async () => [{ path: doc, title: '크리에이티브 브리프' }],
      delayMs: 0,
    })
    expect(await link.syncCampaign(ID)).toBe(false)
    expect(
      await link.appendMail(ID, {
        kind: 'received',
        title: '',
        text: '안녕하세요',
        at: DETAIL.updatedAt,
      }),
    ).toBe(false)

    const vault = join(dir, 'vault')
    await link.setVault(vault)
    expect(await link.vault()).toBe(vault)
    expect(await link.syncCampaign(ID)).toBe(true)
    const folder = join(vault, 'Cheil', ID)
    expect(readFileSync(join(folder, `${ID}.md`), 'utf8')).toContain('# 가상전자 · 에어린 봄 런칭')
    expect(readFileSync(join(folder, '문서', '크리에이티브 브리프.md'), 'utf8')).toContain(
      '| 광고주 | 가상전자 |',
    )
    // an unchanged document is not read again; a saved one is
    await link.syncCampaign(ID)
    expect(reads).toBe(1)
    utimesSync(doc, new Date(), new Date(Date.now() + 5_000))
    await link.syncCampaign(ID)
    expect(reads).toBe(2)

    // mails are appended, and the campaign note links them from then on
    await link.appendMail(ID, {
      kind: 'received',
      title: '',
      text: '시안 2안 부탁드립니다',
      at: DETAIL.updatedAt,
    })
    await link.appendMail(ID, {
      kind: 'draft',
      title: '[에어린] 송부',
      text: '보내 드립니다',
      at: DETAIL.updatedAt,
    })
    const mail = readFileSync(join(folder, '주고받은 메일.md'), 'utf8')
    expect(mail).toContain('받은 메일')
    expect(mail).toContain('시안 2안 부탁드립니다')
    expect(mail).toContain('보낸 메일 초안 — [에어린] 송부')
    await link.syncCampaign(ID)
    expect(readFileSync(join(folder, `${ID}.md`), 'utf8')).toContain('주고받은 메일|')

    // the report of a template of the person's own
    expect(
      await link.writeTemplateSource('블루윈드 브리프', 'C:/x.docx', '광고주 | 블루윈드'),
    ).toBe(true)
    expect(existsSync(join(vault, 'Cheil', '내 양식', '블루윈드 브리프.md'))).toBe(true)

    // unlinked: nothing more is written
    await link.setVault(null)
    expect(await link.vault()).toBeNull()
  })
})
