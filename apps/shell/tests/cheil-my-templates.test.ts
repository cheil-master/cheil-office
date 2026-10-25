/**
 * Cheil fork (plan item 13): the person's own templates. An added report is
 * copied into "Cheil 양식" (never the original), its changing values are
 * offered as blanks, a file that cannot be read (DRM, a password) is not
 * kept, and the chosen values go to the copy's editor tab as one change.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCampaignStore } from '../src/main/cheil/campaign-store'
import { myTemplatePairsOf, registerCheilCampaignIpc } from '../src/main/cheil/campaign-ipc'
import { createObsidianLink } from '../src/main/cheil/obsidian'
import { createMyTemplates, isMyTemplateName } from '../src/main/cheil/my-templates'
import { CHEIL_CAMPAIGN_CHANNELS } from '../src/shared/cheil-campaign-api'
import {
  CHEIL_PROPAGATED_CHANNEL,
  CHEIL_PROPAGATE_READY_CHANNEL,
} from '../../../packages/electron-utils/src/user-skills-channels'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cheil-mine-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const REPORT =
  '광고주 | 블루윈드\n총예산 | 300,000,000원\n- 목표 KPI: 브랜드 인지도 25%\n마감 2026년 5월 20일'

function wire(options: { picked?: string | null; texts?: Record<string, string | null> } = {}) {
  const handlers = new Map<string, (event: { sender: unknown }, ...args: unknown[]) => unknown>()
  const home = { id: 1 }
  const sent: Array<{ pairs: Array<{ find: string; to: string }>; purpose?: string }> = []
  const opened: string[] = []
  const myTemplates = createMyTemplates({ root: () => join(dir, 'Cheil 양식') })
  registerCheilCampaignIpc({
    ipc: { handle: (channel: string, fn: never) => void handlers.set(channel, fn) } as never,
    store: createCampaignStore({
      root: () => join(dir, 'Cheil 캠페인'),
      writeFile: (path, bytes) => writeFile(path, bytes),
      now: () => new Date(),
    }),
    isHome: (sender) => sender === home,
    openFolder: async () => '',
    openDocument: (path) => (opened.push(path), true),
    openTemplate: async () => true,
    today: () => '2026-10-26',
    campaignOfSender: () => null,
    campaignTabs: () => [],
    closedDocuments: async () => [],
    readText: async (path) => {
      const name = path.split(/[\\/]/).pop()!
      return options.texts && name in options.texts ? options.texts[name]! : REPORT
    },
    reopen: async (path) => {
      opened.push(path)
      const senderId = 50
      // the editor listens once its file has loaded, then answers
      setTimeout(
        () => void handlers.get(CHEIL_PROPAGATE_READY_CHANNEL)!({ sender: { id: senderId } }, true),
        10,
      )
      return {
        senderId,
        title: 'x',
        send: (_channel: string, payload: unknown) => {
          const request = payload as {
            requestId: string
            pairs: Array<{ find: string; to: string }>
            purpose?: string
          }
          sent.push({ pairs: request.pairs, purpose: request.purpose })
          void handlers.get(CHEIL_PROPAGATED_CHANNEL)!(
            { sender: { id: senderId } },
            { requestId: request.requestId, counts: request.pairs.map(() => 2) },
          )
        },
      }
    },
    showHome: () => undefined,
    documentNames: async () => [],
    myTemplates,
    pickDocument: async () => (options.picked === undefined ? null : options.picked),
    obsidian: noObsidian(),
    pickFolder: async () => null,
    nowIso: () => '2026-10-26T00:00:00.000Z',
  })
  const call = (sender: unknown, channel: string, ...args: unknown[]) =>
    handlers.get(channel)!({ sender }, ...args) as Promise<Record<string, unknown>>
  return { home, call, sent, opened, myTemplates }
}

describe('Cheil fork: my templates (plan item 13)', () => {
  it('copies an added report in, never touching the original, and offers its values as blanks', async () => {
    const original = join(dir, '블루윈드 브리프.docx')
    writeFileSync(original, 'report bytes')
    const w = wire({ picked: original })
    const res = (await w.call(w.home, CHEIL_CAMPAIGN_CHANNELS.myTemplateAdd)) as {
      ok: boolean
      name: string
      candidates: Array<{ find: string; blank: string }>
    }
    expect(res.ok).toBe(true)
    expect(res.name).toBe('블루윈드 브리프.docx')
    expect(readFileSync(join(dir, 'Cheil 양식', res.name), 'utf8')).toBe('report bytes')
    expect(res.candidates.map((c) => [c.find, c.blank])).toEqual([
      ['블루윈드', '[광고주]'],
      ['300,000,000원', '[총예산]'],
      ['브랜드 인지도 25%', '[KPI]'],
      ['2026년 5월 20일', '[날짜]'],
    ])
    // the same report again gets a name of its own
    const again = (await w.call(w.home, CHEIL_CAMPAIGN_CHANNELS.myTemplateAdd)) as { name: string }
    expect(again.name).toBe('블루윈드 브리프 (2).docx')
    const list = (await w.call(w.home, CHEIL_CAMPAIGN_CHANNELS.myTemplates)) as {
      templates: Array<{ name: string; title: string }>
    }
    expect(list.templates.map((t) => t.title).sort()).toEqual([
      '블루윈드 브리프',
      '블루윈드 브리프 (2)',
    ])
    expect(readFileSync(original, 'utf8')).toBe('report bytes')
  })

  it('keeps nothing of a file it cannot read, and says so; a closed dialog is just that', async () => {
    const locked = join(dir, 'DRM 보고서.pptx')
    writeFileSync(locked, 'drm')
    const w = wire({ picked: locked, texts: { 'DRM 보고서.pptx': null } })
    expect(await w.call(w.home, CHEIL_CAMPAIGN_CHANNELS.myTemplateAdd)).toEqual({
      ok: false,
      reason: 'unreadable',
    })
    expect(readdirSync(join(dir, 'Cheil 양식'))).toEqual([])
    const none = wire({ picked: null })
    expect(await none.call(none.home, CHEIL_CAMPAIGN_CHANNELS.myTemplateAdd)).toEqual({
      ok: false,
      reason: 'canceled',
    })
    // only the home asks
    expect(await w.call({ id: 9 }, CHEIL_CAMPAIGN_CHANNELS.myTemplateAdd)).toEqual({
      ok: false,
      reason: 'not-found',
    })
  })

  it('opens the copy and turns the chosen values into blanks as a template change', async () => {
    const original = join(dir, '블루윈드 브리프.docx')
    writeFileSync(original, 'report bytes')
    const w = wire({ picked: original })
    const { name } = (await w.call(w.home, CHEIL_CAMPAIGN_CHANNELS.myTemplateAdd)) as {
      name: string
    }
    const res = await w.call(w.home, CHEIL_CAMPAIGN_CHANNELS.myTemplateApply, name, [
      { find: '블루윈드', blank: '광고주' },
      { find: '2026년 5월 20일', blank: '[마감일]' },
    ])
    expect(res).toEqual({ ok: true, answered: true, changed: 4 })
    expect(w.opened).toEqual([join(dir, 'Cheil 양식', name)])
    expect(w.sent).toEqual([
      {
        purpose: 'template',
        pairs: [
          { label: '[광고주]', from: '블루윈드', to: '[광고주]', find: '블루윈드' },
          { label: '[마감일]', from: '2026년 5월 20일', to: '[마감일]', find: '2026년 5월 20일' },
        ],
      },
    ])
    // a path for a name, or a value that is already a blank, is refused
    expect(
      await w.call(w.home, CHEIL_CAMPAIGN_CHANNELS.myTemplateApply, '../x.docx', [
        { find: '블루윈드', blank: '광고주' },
      ]),
    ).toEqual({ ok: false, reason: 'invalid' })
    // dropping a copy takes it away
    expect(await w.call(w.home, CHEIL_CAMPAIGN_CHANNELS.myTemplateDiscard, name)).toEqual({
      ok: true,
    })
    expect(existsSync(join(dir, 'Cheil 양식', name))).toBe(false)
  })

  it('checks names and pairs', () => {
    expect(isMyTemplateName('제안서.pptx')).toBe(true)
    expect(isMyTemplateName('../제안서.pptx')).toBe(false)
    expect(isMyTemplateName('메모.md')).toBe(false)
    expect(myTemplatePairsOf([{ find: 'a', blank: '광고주' }])).toBeNull()
    expect(myTemplatePairsOf([{ find: '[광고주]', blank: '광고주' }])).toBeNull()
    expect(myTemplatePairsOf([{ find: '블루윈드', blank: '  ' }])).toBeNull()
    expect(
      myTemplatePairsOf([
        { find: '블루윈드', blank: 'a' },
        { find: '블루윈드', blank: 'b' },
      ]),
    ).toBeNull()
    expect(myTemplatePairsOf([])).toBeNull()
  })
})

/** an Obsidian link with no vault set: it writes nothing */
function noObsidian() {
  return createObsidianLink({
    settingsPath: () => join(tmpdir(), 'cheil-no-vault', 'none.json'),
    readText: async () => null,
    campaign: async () => null,
    documents: async () => [],
  })
}
