import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CAMPAIGN_FILE,
  HISTORY_FILE,
  TIMELINE_FILE,
  campaignFolderName,
  cleanCard,
  createCampaignStore,
  isCampaignId,
} from '../src/main/cheil/campaign-store'
import { registerCheilCampaignIpc } from '../src/main/cheil/campaign-ipc'
import { CHEIL_CAMPAIGN_CHANNELS } from '../src/shared/cheil-campaign-api'

const CARD = {
  campaign: '에어린 봄 런칭',
  client: '가상전자',
  brand: '에어린',
  start: '2027-03-01',
  end: '2027-04-30',
  budget: '500000000',
  target: '30대 1인 가구 직장인',
  kpi: '인지도 30%',
  team: '비즈니스13팀',
  author: '홍길동',
}

let root: string
let clock: number

function makeStore(dir = root) {
  return createCampaignStore({
    root: () => dir,
    writeFile: (path, bytes) => writeFile(path, bytes),
    now: () => new Date((clock += 60_000)),
  })
}

beforeEach(() => {
  root = join(mkdtempSync(join(tmpdir(), 'cheil-campaigns-')), 'Cheil 캠페인')
  clock = Date.UTC(2026, 9, 25, 7, 0, 0)
})

afterEach(() => {
  rmSync(join(root, '..'), { recursive: true, force: true })
})

describe('Cheil fork: campaign history', () => {
  it('lists nothing before the first campaign, without making the folder', async () => {
    const store = makeStore()
    expect(await store.list()).toEqual({ ok: true, campaigns: [] })
  })

  it('makes a folder with the card and a first timeline line, and opens it again', async () => {
    const store = makeStore()
    const made = await store.create(CARD)
    expect(made.ok).toBe(true)
    if (!made.ok) return
    expect(made.campaign.id).toBe('가상전자 - 에어린 봄 런칭')
    expect(made.campaign.card).toEqual(CARD)
    expect(made.campaign.timeline.map((e) => e.kind)).toEqual(['created'])

    const folder = join(root, made.campaign.id)
    const file = JSON.parse(readFileSync(join(folder, CAMPAIGN_FILE), 'utf8'))
    expect(file.format).toBe('cheil-campaign')
    expect(file.card.budget).toBe('500000000')
    expect(readFileSync(join(folder, TIMELINE_FILE), 'utf8').trim().split('\n')).toHaveLength(1)

    // a fresh store (the app restarted) reads the same campaign back
    const again = await makeStore().get(made.campaign.id)
    expect(again.ok && again.campaign.timeline[0]!.text).toContain('에어린 봄 런칭')
  })

  it('records only the card fields that changed, and notes, newest last', async () => {
    const store = makeStore()
    const made = await store.create(CARD)
    if (!made.ok) throw new Error('not made')
    const id = made.campaign.id
    const same = await store.update(id, CARD)
    expect(same.ok && same.campaign.timeline).toHaveLength(1)

    const changed = await store.update(id, { ...CARD, budget: '600000000', kpi: '' })
    expect(changed.ok).toBe(true)
    if (!changed.ok) return
    const event = changed.campaign.timeline[1]!
    expect(event.kind).toBe('card')
    expect(event.changes).toEqual([
      { field: 'budget', from: '500000000', to: '600000000' },
      { field: 'kpi', from: '인지도 30%', to: '' },
    ])
    expect(event.text).toBe(
      '카드 수정: 총예산 500,000,000원 → 600,000,000원, KPI 인지도 30% → (비어 있음)',
    )

    const noted = await store.note(id, '  광고주 OT 완료\n다음 주 시안  ')
    expect(noted.ok && noted.campaign.last).toMatchObject({
      kind: 'note',
      text: '광고주 OT 완료\n다음 주 시안',
    })
    expect(await store.note(id, '   ')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('refuses a card without a name, a bad date or an end before the start', async () => {
    const store = makeStore()
    expect(await store.create({ ...CARD, campaign: '  ' })).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(cleanCard({ ...CARD, start: '2027-02-30' })).toBeNull()
    expect(cleanCard({ ...CARD, start: '2027-05-01' })).toBeNull()
    expect(cleanCard({ ...CARD, budget: 5 })).toBeNull()
    expect(cleanCard('x')).toBeNull()
    // missing fields read as empty
    expect(cleanCard({ campaign: '이름만' })).toMatchObject({ campaign: '이름만', client: '' })
  })

  it('never takes a path for a campaign', async () => {
    const store = makeStore()
    for (const id of ['..', '.', '../x', 'a/b', 'a\\b', '', 5, null]) {
      expect(isCampaignId(id)).toBe(false)
      expect(await store.get(id)).toEqual({ ok: false, reason: 'not-found' })
    }
    expect(store.folderOf('../x')).toBeNull()
  })

  it('makes a folder of its own for the same name, and a safe name from any card', async () => {
    const store = makeStore()
    const a = await store.create(CARD)
    const b = await store.create(CARD)
    expect(a.ok && b.ok && [a.campaign.id, b.campaign.id]).toEqual([
      '가상전자 - 에어린 봄 런칭',
      '가상전자 - 에어린 봄 런칭 (2)',
    ])
    expect(campaignFolderName({ ...CARD, client: '', campaign: 'a/b:c*?.' })).toBe('a b c')
    expect(campaignFolderName({ ...CARD, client: '', campaign: 'CON' })).toBe('CON 캠페인')
  })

  it('lists the most recently touched campaign first, and skips folders that are not campaigns', async () => {
    const store = makeStore()
    const first = await store.create(CARD)
    await store.create({ ...CARD, campaign: '블루윈드 여름', client: '가상전자' })
    if (!first.ok) throw new Error('not made')
    await store.note(first.campaign.id, '최근 메모')
    mkdirSync(join(root, '그냥 폴더'))
    mkdirSync(join(root, '깨진 캠페인'))
    writeFileSync(join(root, '깨진 캠페인', CAMPAIGN_FILE), '{not json')
    const listed = await store.list()
    expect(listed.ok && listed.campaigns.map((c) => c.card.campaign)).toEqual([
      '에어린 봄 런칭',
      '블루윈드 여름',
    ])
    expect(listed.ok && listed.campaigns[0]!.events).toBe(2)
  })

  it('reads past a broken timeline line', async () => {
    const store = makeStore()
    const made = await store.create(CARD)
    if (!made.ok) throw new Error('not made')
    const timeline = join(root, made.campaign.id, TIMELINE_FILE)
    writeFileSync(
      timeline,
      `${readFileSync(timeline, 'utf8')}{broken\n{"at":"x","kind":"bogus","text":"t"}\n`,
    )
    await store.note(made.campaign.id, '그 뒤 메모')
    const got = await store.get(made.campaign.id)
    expect(got.ok && got.campaign.timeline.map((e) => e.kind)).toEqual(['created', 'note'])
  })

  it('keeps writes to one campaign in order', async () => {
    const store = makeStore()
    const made = await store.create(CARD)
    if (!made.ok) throw new Error('not made')
    await Promise.all(
      ['1', '2', '3', '4', '5'].map((n) => store.note(made.campaign.id, `메모 ${n}`)),
    )
    const got = await store.get(made.campaign.id)
    expect(got.ok && got.campaign.timeline.slice(1).map((e) => e.text)).toEqual([
      '메모 1',
      '메모 2',
      '메모 3',
      '메모 4',
      '메모 5',
    ])
  })

  it('writes the history document a person can hand over', async () => {
    const store = makeStore()
    const made = await store.create(CARD)
    if (!made.ok) throw new Error('not made')
    await store.update(made.campaign.id, { ...CARD, budget: '5억 원' })
    const written = await store.writeHistory(made.campaign.id)
    expect(written.ok).toBe(true)
    if (!written.ok) return
    expect(written.path).toBe(join(root, made.campaign.id, HISTORY_FILE))
    const md = readFileSync(written.path, 'utf8')
    expect(md).toContain('# 가상전자 · 에어린 봄 런칭')
    expect(md).toContain('| 총예산 | 5억 원 |')
    expect(md).toContain('## 타임라인 (2건)')
    expect(md).toContain('**카드** 카드 수정: 총예산 500,000,000원 → 5억 원')
  })
})

describe('Cheil fork: campaign channels', () => {
  function wire() {
    const handlers = new Map<string, (event: { sender: unknown }, ...args: unknown[]) => unknown>()
    const home = { id: 1 }
    const openFolder = vi.fn(async () => '')
    const openDocument = vi.fn(() => true)
    const openTemplate = vi.fn(
      async (
        _item: { skill: string; title: string; text: string },
        _cheil: { campaign: string; values: Record<string, string> },
        _campaignId: string,
      ) => true,
    )
    // editor tabs a set opened: webContents id → campaign and template title
    const tabs = new Map<number, { id: string; title: string }>()
    registerCheilCampaignIpc({
      ipc: { handle: (channel: string, fn: never) => void handlers.set(channel, fn) } as never,
      store: makeStore(),
      isHome: (sender) => sender === home,
      openFolder,
      openDocument,
      openTemplate,
      today: () => '2026-10-25',
      campaignOfSender: (sender) => tabs.get((sender as { id: number }).id) ?? null,
    })
    const call = (sender: unknown, channel: string, ...args: unknown[]) =>
      handlers.get(channel)!({ sender }, ...args) as Promise<Record<string, unknown>>
    return { handlers, home, call, openFolder, openDocument, openTemplate, tabs }
  }

  const SET = [
    { skill: 'cheil-brief', title: '크리에이티브 브리프', text: '브리프를 채워 줘.' },
    { skill: 'cheil-proposal', title: '캠페인 제안서', text: '제안서를 채워 줘.' },
    { skill: 'cheil-media-plan', title: '미디어 플랜', text: '미디어 플랜을 채워 줘.' },
  ]

  it("opens a document set with the stored card's values and records it", async () => {
    const { home, call, openTemplate } = wire()
    const made = (await call(home, CHEIL_CAMPAIGN_CHANNELS.create, CARD)) as {
      campaign: { id: string }
    }
    const res = (await call(home, CHEIL_CAMPAIGN_CHANNELS.openSet, made.campaign.id, SET)) as {
      ok: boolean
      opened: number
      campaign: { timeline: Array<{ kind: string; text: string }> }
    }
    expect(res.ok).toBe(true)
    expect(res.opened).toBe(3)
    expect(openTemplate.mock.calls.map(([item]) => item.skill)).toEqual([
      'cheil-brief',
      'cheil-proposal',
      'cheil-media-plan',
    ])
    const [, cheil] = openTemplate.mock.calls[0]!
    expect(cheil.campaign).toBe('에어린 봄 런칭')
    expect(cheil.values).toMatchObject({
      '[광고주]': '가상전자',
      '[캠페인 기간]': '2027-03-01 ~ 2027-04-30',
      '[총예산]': '500,000,000원',
      '[작성자]': '홍길동',
      '[작성일]': '2026-10-25',
    })
    // the set's line comes first; each tab adds its own card fill once it has loaded
    const last = res.campaign.timeline.at(-1)!
    expect(last.kind).toBe('document')
    expect(last.text).toBe('문서 세트를 엽니다: 크리에이티브 브리프, 캠페인 제안서, 미디어 플랜')
    expect(openTemplate.mock.calls[0]![2]).toBe(made.campaign.id)
  })

  it('takes only known templates, each once, and never values from the page', async () => {
    const { home, call, openTemplate } = wire()
    const made = (await call(home, CHEIL_CAMPAIGN_CHANNELS.create, CARD)) as {
      campaign: { id: string }
    }
    const id = made.campaign.id
    const invalid = { ok: false, reason: 'invalid' }
    expect(await call(home, CHEIL_CAMPAIGN_CHANNELS.openSet, id, [])).toEqual(invalid)
    expect(
      await call(home, CHEIL_CAMPAIGN_CHANNELS.openSet, id, [
        { skill: 'meeting-minutes', title: 'x', text: '' },
      ]),
    ).toEqual(invalid)
    expect(await call(home, CHEIL_CAMPAIGN_CHANNELS.openSet, id, [SET[0], SET[0]])).toEqual(invalid)
    // a page's own "values" field is not read
    await call(home, CHEIL_CAMPAIGN_CHANNELS.openSet, id, [
      { ...SET[0], values: { '[광고주]': '다른 광고주' } },
    ])
    expect(openTemplate.mock.calls.at(-1)![1].values['[광고주]']).toBe('가상전자')
    expect(await call({ id: 2 }, CHEIL_CAMPAIGN_CHANNELS.openSet, id, SET)).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(await call(home, CHEIL_CAMPAIGN_CHANNELS.openSet, '..', SET)).toEqual({
      ok: false,
      reason: 'not-found',
    })
  })

  it('says it failed when no template opened, and the timeline says which', async () => {
    const { home, call, openTemplate } = wire()
    openTemplate.mockResolvedValue(false)
    const made = (await call(home, CHEIL_CAMPAIGN_CHANNELS.create, CARD)) as {
      campaign: { id: string }
    }
    expect(await call(home, CHEIL_CAMPAIGN_CHANNELS.openSet, made.campaign.id, SET)).toEqual({
      ok: false,
      reason: 'failed',
    })
    const got = (await call(home, CHEIL_CAMPAIGN_CHANNELS.get, made.campaign.id)) as {
      campaign: { timeline: Array<{ text: string }> }
    }
    expect(got.campaign.timeline.map((e) => e.text).slice(1)).toEqual([
      '문서 세트를 엽니다: 크리에이티브 브리프, 캠페인 제안서, 미디어 플랜',
      '열지 못한 양식: 크리에이티브 브리프, 캠페인 제안서, 미디어 플랜',
    ])
  })

  it("records an editor tab's fills in the campaign that opened it, and ignores other tabs", async () => {
    const { home, call, tabs } = wire()
    const made = (await call(home, CHEIL_CAMPAIGN_CHANNELS.create, CARD)) as {
      campaign: { id: string }
    }
    const id = made.campaign.id
    const brief = { id: 7 }
    tabs.set(brief.id, { id, title: '크리에이티브 브리프' })
    expect(await call(brief, CHEIL_CAMPAIGN_CHANNELS.record, { kind: 'card', filled: 10 })).toEqual(
      {
        ok: true,
      },
    )
    expect(
      await call(brief, CHEIL_CAMPAIGN_CHANNELS.record, {
        kind: 'fill',
        total: 29,
        filled: 21,
        open: 8,
      }),
    ).toEqual({ ok: true })
    // a tab no set opened, and reports that are not ones
    expect(
      await call({ id: 9 }, CHEIL_CAMPAIGN_CHANNELS.record, { kind: 'card', filled: 1 }),
    ).toEqual({
      ok: false,
      reason: 'not-found',
    })
    for (const bad of [
      { kind: 'card', filled: -1 },
      { kind: 'fill', total: 3 },
      { kind: 'x' },
      null,
    ]) {
      expect(await call(brief, CHEIL_CAMPAIGN_CHANNELS.record, bad)).toEqual({
        ok: false,
        reason: 'invalid',
      })
    }
    const got = (await call(home, CHEIL_CAMPAIGN_CHANNELS.get, id)) as {
      campaign: { timeline: Array<{ kind: string; text: string }> }
    }
    expect(got.campaign.timeline.slice(1)).toEqual([
      expect.objectContaining({
        kind: 'fill',
        text: '크리에이티브 브리프: 캠페인 카드로 공통 칸 10개를 채움',
      }),
      expect.objectContaining({
        kind: 'fill',
        text: '크리에이티브 브리프: 빠른 채우기 — 양식 칸 29개 중 21개를 자료로 채움, 8개는 [확인 필요]',
      }),
    ])
  })

  it('records the to-dos the person confirmed, each with its due day', async () => {
    const { home, call } = wire()
    const made = (await call(home, CHEIL_CAMPAIGN_CHANNELS.create, CARD)) as {
      campaign: { id: string }
    }
    const id = made.campaign.id
    const res = (await call(home, CHEIL_CAMPAIGN_CHANNELS.addTasks, id, [
      { task: '시안 2안 송부', owner: '기획 3팀', due: '2026-11-03' },
      { task: '견적서  재송부', owner: '', due: '' },
    ])) as { ok: boolean; added: number; campaign: { timeline: unknown[] } }
    expect(res.ok).toBe(true)
    expect(res.added).toBe(2)
    expect(res.campaign.timeline.slice(1)).toEqual([
      expect.objectContaining({
        kind: 'task',
        text: '시안 2안 송부 (담당 기획 3팀)',
        due: '2026-11-03',
      }),
      expect.objectContaining({ kind: 'task', text: '견적서 재송부' }),
    ])
    const invalid = { ok: false, reason: 'invalid' }
    expect(await call(home, CHEIL_CAMPAIGN_CHANNELS.addTasks, id, [])).toEqual(invalid)
    expect(
      await call(home, CHEIL_CAMPAIGN_CHANNELS.addTasks, id, [{ task: 'x', due: '11/03' }]),
    ).toEqual(invalid)
    expect(await call({ id: 2 }, CHEIL_CAMPAIGN_CHANNELS.addTasks, id, [{ task: 'x' }])).toEqual({
      ok: false,
      reason: 'not-found',
    })
  })

  it('registers every channel and answers the home only', async () => {
    const { handlers, home, call } = wire()
    expect([...handlers.keys()].sort()).toEqual(Object.values(CHEIL_CAMPAIGN_CHANNELS).sort())
    expect(await call({ id: 2 }, CHEIL_CAMPAIGN_CHANNELS.create, CARD)).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(await call({ id: 2 }, CHEIL_CAMPAIGN_CHANNELS.list)).toEqual({
      ok: false,
      reason: 'not-found',
    })
    const made = await call(home, CHEIL_CAMPAIGN_CHANNELS.create, CARD)
    expect(made.ok).toBe(true)
  })

  it("opens the campaign's own folder and its history document, nothing else", async () => {
    const { home, call, openFolder, openDocument } = wire()
    const made = (await call(home, CHEIL_CAMPAIGN_CHANNELS.create, CARD)) as {
      campaign: { id: string }
    }
    expect(await call(home, CHEIL_CAMPAIGN_CHANNELS.openFolder, made.campaign.id)).toEqual({
      ok: true,
    })
    expect(openFolder).toHaveBeenCalledWith(join(root, made.campaign.id))
    expect(await call(home, CHEIL_CAMPAIGN_CHANNELS.openFolder, '..')).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(openFolder).toHaveBeenCalledTimes(1)
    expect(await call(home, CHEIL_CAMPAIGN_CHANNELS.openHistory, made.campaign.id)).toEqual({
      ok: true,
    })
    expect(openDocument).toHaveBeenCalledWith(join(root, made.campaign.id, HISTORY_FILE))
  })
})
