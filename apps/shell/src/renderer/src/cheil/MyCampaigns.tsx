/**
 * Cheil fork: the home's "내 캠페인" (plan item 2).
 *
 * A campaign card is typed once (name, client, period, budget, target, KPI,
 * ...); every document, mail and check later hangs off it, and the campaign's
 * timeline keeps what was done. This row lists the campaigns, makes a new one,
 * and opens one: its card, a note box and the timeline, newest first.
 *
 * The main process owns the folders (`window.aiOfficeCheilCampaigns`); this
 * screen names a campaign by its folder name only. Words are Korean, with
 * English for every other UI language, like the agency templates row.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import type { Lang } from '@genoffice/i18n'
import {
  EMPTY_CHEIL_CARD,
  buildCheilTaskPrompt,
  cheilBudgetText,
  cheilCardSummary,
  cheilToday,
  parseCheilTasks,
} from '@genoffice/ui'
import { useI18n } from '../locale'
import { readAiSettings } from '../settings-ai'
import {
  CHEIL_CAMPAIGN_BRIDGE_KEY,
  type CampaignDetail,
  type CampaignEvent,
  type CampaignEventKind,
  type CampaignFailReason,
  type CampaignPropagation,
  type CampaignSetItem,
  type CampaignTask,
  type CampaignSummary,
  type CheilCampaignApi,
  type CheilCampaignCard,
} from '../../../shared/cheil-campaign-api'
import { AGENCY_TEMPLATES, DEFAULT_SET } from './templates'

const WORDS = {
  ko: {
    label: '내 캠페인',
    add: '새 캠페인',
    empty:
      '아직 캠페인이 없습니다. 캠페인 정보를 한 번 넣어 두면 문서·메일·작업 기록이 그 캠페인으로 묶입니다.',
    newTitle: '새 캠페인',
    editTitle: '캠페인 카드 고치기',
    create: '만들기',
    save: '저장',
    cancel: '취소',
    close: '닫기',
    required: '캠페인명은 꼭 넣어 주세요.',
    badDates: '종료일이 시작일보다 앞섭니다.',
    editCard: '카드 고치기',
    openFolder: '폴더 열기',
    openHistory: '이력 문서로 보기',
    notePlaceholder: '메모를 남기면 타임라인에 기록됩니다(예: 광고주 OT 완료, 다음 주 시안 공유).',
    addNote: '메모 남기기',
    timeline: '타임라인',
    events: (n: number) => `${n}건`,
    noEvents: '아직 기록이 없습니다.',
    lastNone: '기록 없음',
    fields: {
      campaign: '캠페인명',
      client: '광고주',
      brand: '브랜드·제품',
      start: '시작일',
      end: '종료일',
      budget: '총예산',
      target: '타깃',
      kpi: 'KPI',
      team: '팀명',
      author: '작성자',
    } satisfies Record<keyof CheilCampaignCard, string>,
    hints: {
      campaign: '예: 에어린 봄 신제품 런칭',
      client: '예: 가상전자',
      brand: '예: 에어린',
      budget: '예: 500000000 또는 5억 원',
      target: '누구에게 — 나이·생활·구매 맥락',
      kpi: '성공을 판단할 지표와 목표 수준',
      team: '예: 비즈니스13팀',
      author: '이름',
    } as Partial<Record<keyof CheilCampaignCard, string>>,
    kinds: {
      created: '만듦',
      card: '카드',
      note: '메모',
      fill: '채우기',
      document: '문서',
      mail: '메일',
      check: '점검',
      revise: '수정 반영',
      task: '할 일',
    } satisfies Record<CampaignEventKind, string>,
    changed: '카드 수정',
    period: '캠페인 기간',
    setTitle: '문서 세트 만들기',
    setDesc:
      '고른 양식이 캠페인 폴더에 파일로 만들어져 새 탭으로 열리고, 카드의 광고주·캠페인명·기간·예산·타깃·KPI가 공통 칸에 바로 들어갑니다(AI 없이). 저장하면 그 파일에 저장됩니다. 나머지 칸은 각 탭에서 자료를 붙여 보내면 채웁니다.',
    setOpen: (n: number) => `선택한 양식 열기 (${n})`,
    setOpened: (n: number) =>
      `양식 ${n}개를 캠페인 폴더에 만들어 열었습니다. 각 탭의 AI 창에 요청이 기다리고 있습니다.`,
    propTitle: '카드 변경을 캠페인 문서에 반영했습니다',
    propNoTabs: '캠페인 폴더의 문서에 바뀐 값이 들어 있지 않아 바꾼 문서가 없습니다.',
    propNoAnswer: '— 응답이 없어 확인하지 못했습니다',
    propNothing: '— 바꿀 곳이 없었습니다',
    propItem: (label: string, from: string, to: string, n: number) =>
      `— ${label} ${from || '(빈칸)'} → ${to} ${n}곳`,
    propReopened: '— 닫혀 있던 문서를 열어 바꿨습니다. 확인하고 저장하세요',
    propLeft: (titles: string) => `확인하지 못한 문서: ${titles} — 직접 열어 확인하세요.`,
    propCleared: (labels: string) => `${labels}: 카드에서 비웠지만 문서의 값은 그대로 두었습니다.`,
    propClosed:
      '캠페인 폴더의 워드·파워포인트·엑셀 문서를 살폈습니다. 바꾼 문서는 저장해야 파일에 남고, 각 탭에서 되돌리기 한 번으로 되돌릴 수 있습니다.',
    mailTitle: '받은 메일 → 할 일',
    mailPlaceholder:
      '받은 메일을 붙여넣으면 할 일·담당·마감을 뽑습니다(AI 한 번). 대외비·개인정보가 보이면 이 PC 밖 AI 로는 보내지 않습니다.',
    mailRead: '할 일 뽑기',
    mailReading: 'AI 가 메일을 읽는 중…',
    tasksReview:
      '메일에서 뽑은 할 일입니다. 고치거나 빼고 기록하세요. 기록하기 전에는 아무것도 남지 않습니다.',
    taskLabel: '할 일',
    ownerLabel: '담당',
    dueLabel: '마감',
    tasksAdd: (n: number) => `선택한 할 일 기록 (${n})`,
    tasksAdded: (n: number) => `할 일 ${n}개를 타임라인에 기록했습니다.`,
    tasksNone: '메일에서 할 일을 찾지 못했습니다.',
    tasksFailed: (why: string) => `할 일을 뽑지 못했습니다${why ? `: ${why}` : '.'}`,
    emptyValue: '(비어 있음)',
    due: (d: string) => `마감 ${d}`,
    fail: {
      'not-found': '캠페인 폴더를 찾지 못했습니다. 폴더 이름이 바뀌었거나 지워졌을 수 있습니다.',
      invalid: '입력한 내용을 저장할 수 없습니다. 길이와 날짜를 확인해 주세요.',
      failed: '저장하지 못했습니다. 문서 폴더에 쓸 수 있는지 확인해 주세요.',
    } satisfies Record<CampaignFailReason, string>,
    now: '방금',
    minutes: (n: number) => `${n}분 전`,
    hours: (n: number) => `${n}시간 전`,
    days: (n: number) => `${n}일 전`,
  },
  en: {
    label: 'My campaigns',
    add: 'New campaign',
    empty:
      'No campaigns yet. Enter a campaign once and its documents, mails and work log stay together under it.',
    newTitle: 'New campaign',
    editTitle: 'Edit the campaign card',
    create: 'Create',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    required: 'A campaign name is needed.',
    badDates: 'The end date is before the start date.',
    editCard: 'Edit card',
    openFolder: 'Open folder',
    openHistory: 'History as a document',
    notePlaceholder: 'A note goes into the timeline (e.g. client orientation done).',
    addNote: 'Add note',
    timeline: 'Timeline',
    events: (n: number) => `${n}`,
    noEvents: 'Nothing recorded yet.',
    lastNone: 'Nothing recorded',
    fields: {
      campaign: 'Campaign',
      client: 'Client',
      brand: 'Brand / product',
      start: 'Start',
      end: 'End',
      budget: 'Total budget',
      target: 'Target',
      kpi: 'KPI',
      team: 'Team',
      author: 'Author',
    } satisfies Record<keyof CheilCampaignCard, string>,
    hints: {
      budget: 'e.g. 500000000',
      target: 'Who — age, life, buying context',
      kpi: 'What decides success, and the goal',
    } as Partial<Record<keyof CheilCampaignCard, string>>,
    kinds: {
      created: 'Created',
      card: 'Card',
      note: 'Note',
      fill: 'Fill',
      document: 'Document',
      mail: 'Mail',
      check: 'Check',
      revise: 'Revision',
      task: 'To-do',
    } satisfies Record<CampaignEventKind, string>,
    changed: 'Card changed',
    period: 'Period',
    setTitle: 'Make a document set',
    setDesc:
      'The chosen templates are made as files in the campaign’s folder and open in new tabs with the card’s client, campaign, period, budget, target and KPI already in their common blanks (no AI). Saving writes those files. Send your material in each tab to fill the rest.',
    setOpen: (n: number) => `Open the chosen templates (${n})`,
    setOpened: (n: number) =>
      `Made ${n} templates in the campaign’s folder and opened them; each AI panel has its request waiting.`,
    propTitle: 'The card change went into the campaign’s documents',
    propNoTabs:
      'No document in the campaign’s folder holds a changed value; no document was changed.',
    propNoAnswer: '— did not answer; not checked',
    propNothing: '— nothing to change',
    propItem: (label: string, from: string, to: string, n: number) =>
      `— ${label} ${from || '(blank)'} → ${to}, ${n}`,
    propReopened: '— was closed: opened and changed. Check it and save',
    propLeft: (titles: string) => `Not checked: ${titles} — open them and check.`,
    propCleared: (labels: string) =>
      `${labels}: emptied on the card; the documents keep their values.`,
    propClosed:
      'The Word, PowerPoint and Excel documents in the campaign’s folder were checked. A changed document keeps the change once saved; each tab can undo it in one step.',
    mailTitle: 'Received mail → to-dos',
    mailPlaceholder:
      'Paste a received mail to pick out to-dos, owners and due days (one AI call). Confidential or personal content is not sent to an AI outside this PC.',
    mailRead: 'Pick out to-dos',
    mailReading: 'The AI is reading the mail…',
    tasksReview: 'To-dos from the mail. Edit or untick, then record. Nothing is kept before that.',
    taskLabel: 'To-do',
    ownerLabel: 'Owner',
    dueLabel: 'Due',
    tasksAdd: (n: number) => `Record the chosen to-dos (${n})`,
    tasksAdded: (n: number) => `Recorded ${n} to-dos in the timeline.`,
    tasksNone: 'No to-dos found in the mail.',
    tasksFailed: (why: string) => `Could not pick out to-dos${why ? `: ${why}` : '.'}`,
    emptyValue: '(empty)',
    due: (d: string) => `due ${d}`,
    fail: {
      'not-found': 'The campaign folder was not found. It may have been renamed or removed.',
      invalid: 'This cannot be saved. Check the lengths and dates.',
      failed: 'Could not save. Check that the Documents folder can be written.',
    } satisfies Record<CampaignFailReason, string>,
    now: 'just now',
    minutes: (n: number) => `${n} min ago`,
    hours: (n: number) => `${n} h ago`,
    days: (n: number) => `${n} d ago`,
  },
}

type Words = (typeof WORDS)['ko']

const words = (lang: Lang): Words => (lang === 'ko' ? WORDS.ko : (WORDS.en as unknown as Words))

/** how often an open campaign view re-reads its timeline (editor tabs add lines) */
const VIEW_REFRESH_MS = 3_000

/** the campaign view's card: short fields in pairs, then target and KPI across */
const VIEW_ROWS: Array<Exclude<keyof CheilCampaignCard, 'campaign' | 'start' | 'end'> | 'period'> =
  ['client', 'brand', 'period', 'budget', 'team', 'author', 'target', 'kpi']

function bridge(): CheilCampaignApi | undefined {
  return (window as unknown as Record<string, CheilCampaignApi | undefined>)[
    CHEIL_CAMPAIGN_BRIDGE_KEY
  ]
}

function period(card: CheilCampaignCard): string {
  if (!card.start && !card.end) return ''
  return `${card.start || '?'} ~ ${card.end || '?'}`
}

function shownValue(w: Words, key: keyof CheilCampaignCard, value: string): string {
  if (!value) return w.emptyValue
  return key === 'budget' ? cheilBudgetText(value) : value
}

function ago(w: Words, iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const minutes = Math.floor((now - t) / 60_000)
  if (minutes < 1) return w.now
  if (minutes < 60) return w.minutes(minutes)
  if (minutes < 24 * 60) return w.hours(Math.floor(minutes / 60))
  if (minutes < 7 * 24 * 60) return w.days(Math.floor(minutes / (24 * 60)))
  return localTime(iso).slice(0, 10)
}

function localTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** A timeline line as a person reads it: card changes from their fields, the rest as recorded */
function eventText(w: Words, event: CampaignEvent): string {
  if (event.kind === 'card' && event.changes?.length) {
    const parts = event.changes.map(
      (c) =>
        `${w.fields[c.field]} ${shownValue(w, c.field, c.from)} → ${shownValue(w, c.field, c.to)}`,
    )
    return `${w.changed}: ${parts.join(', ')}`
  }
  return event.text
}

/** a folder with a page: one campaign */
function CampaignIcon(): ReactElement {
  return (
    <span className="quick-folder cheil-campaign-icon" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M1.75 4.25c0-.69.56-1.25 1.25-1.25h3l1.5 1.5H13c.69 0 1.25.56 1.25 1.25v6.5c0 .69-.56 1.25-1.25 1.25H3c-.69 0-1.25-.56-1.25-1.25v-8Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M5 8.5h6M5 10.75h4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

export function MyCampaigns() {
  const { lang } = useI18n()
  const w = words(lang)
  const api = bridge()
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null)
  const [form, setForm] = useState<{ mode: 'new' } | { mode: 'edit'; id: string } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  /** plan item 5: what the last card edit changed in the campaign's open documents */
  const [propagation, setPropagation] = useState<{
    id: string
    result: CampaignPropagation
  } | null>(null)

  const refresh = useCallback(async () => {
    if (!api) return
    const res = await api.list().catch(() => null)
    setCampaigns(res?.ok ? res.campaigns : [])
  }, [api])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!api) return null

  return (
    <section className="quick-start cheil-campaigns" aria-label={w.label}>
      <div className="section-head">
        <span className="section-label">{w.label}</span>
        <button
          className="cheil-campaign-add"
          data-testid="cheil-campaign-add"
          onClick={() => setForm({ mode: 'new' })}
        >
          + {w.add}
        </button>
      </div>
      {campaigns && campaigns.length === 0 ? (
        <p className="cheil-campaigns-empty">{w.empty}</p>
      ) : (
        <div className="quick-cards cheil-campaign-cards">
          {(campaigns ?? []).map((c) => (
            <button
              key={c.id}
              className="quick-card cheil-campaign-card"
              data-testid="cheil-campaign-card"
              onClick={() => setOpenId(c.id)}
            >
              <CampaignIcon />
              <span className="quick-text">
                <span className="quick-title-row">
                  <span className="quick-title">{c.card.campaign}</span>
                </span>
                <span className="quick-sub">
                  {[c.card.client, period(c.card)].filter(Boolean).join(' · ') || ' '}
                </span>
                <span className="cheil-campaign-last">
                  {c.last ? `${w.kinds[c.last.kind]} · ${ago(w, c.last.at)}` : w.lastNone}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {form ? (
        <CampaignForm
          w={w}
          api={api}
          editId={form.mode === 'edit' ? form.id : null}
          onDone={(id, result) => {
            setForm(null)
            void refresh()
            setPropagation(id && result ? { id, result } : null)
            if (id) setOpenId(id)
          }}
        />
      ) : openId ? (
        <CampaignView
          w={w}
          lang={lang === 'ko' ? 'ko' : 'en'}
          api={api}
          id={openId}
          propagation={propagation?.id === openId ? propagation.result : undefined}
          onEdit={() => setForm({ mode: 'edit', id: openId })}
          onClose={() => {
            setOpenId(null)
            setPropagation(null)
            void refresh()
          }}
        />
      ) : null}
    </section>
  )
}

/** Escape closes a dialog */
function useEscape(onEscape: () => void) {
  const ref = useRef(onEscape)
  ref.current = onEscape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        ref.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}

function CampaignForm({
  w,
  api,
  editId,
  onDone,
}: {
  w: Words
  api: CheilCampaignApi
  /** null for a new campaign */
  editId: string | null
  /** the campaign to show next, or null when cancelled; a card edit's propagation (plan item 5) */
  onDone: (id: string | null, propagation?: CampaignPropagation) => void
}) {
  const [card, setCard] = useState<CheilCampaignCard>({ ...EMPTY_CHEIL_CARD })
  const [loaded, setLoaded] = useState(editId === null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEscape(() => onDone(editId))

  useEffect(() => {
    if (editId === null) return
    let live = true
    void api.get(editId).then((res) => {
      if (!live) return
      if (res.ok) setCard(res.campaign.card)
      else setError(w.fail[res.reason])
      setLoaded(true)
    })
    return () => {
      live = false
    }
  }, [api, editId, w])

  const set = (key: keyof CheilCampaignCard) => (value: string) =>
    setCard((prev) => ({ ...prev, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!card.campaign.trim()) return setError(w.required)
    if (card.start && card.end && card.start > card.end) return setError(w.badDates)
    setBusy(true)
    setError('')
    const res = await (editId === null ? api.create(card) : api.update(editId, card)).catch(() => ({
      ok: false as const,
      reason: 'failed' as const,
    }))
    setBusy(false)
    if (!res.ok) return setError(w.fail[res.reason])
    const { propagation } = res as { propagation?: CampaignPropagation }
    onDone(res.campaign.id, propagation)
  }

  const input = (key: keyof CheilCampaignCard, type: 'text' | 'date' = 'text') => (
    <label className={`cheil-field cheil-field-${key}`}>
      <span>
        {w.fields[key]}
        {key === 'campaign' ? <em aria-hidden> *</em> : null}
      </span>
      <input
        type={type}
        name={key}
        value={card[key]}
        placeholder={w.hints[key] ?? ''}
        required={key === 'campaign'}
        onChange={(e) => set(key)(e.target.value)}
      />
    </label>
  )
  const area = (key: 'target' | 'kpi') => (
    <label className={`cheil-field cheil-field-${key} cheil-field-wide`}>
      <span>{w.fields[key]}</span>
      <textarea
        name={key}
        rows={2}
        value={card[key]}
        placeholder={w.hints[key] ?? ''}
        onChange={(e) => set(key)(e.target.value)}
      />
    </label>
  )

  return (
    <div className="modal-overlay cheil-dialog" onClick={() => onDone(editId)}>
      <form
        className="modal cheil-campaign-form"
        role="dialog"
        aria-modal="true"
        aria-label={editId === null ? w.newTitle : w.editTitle}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void submit(e)}
      >
        <h3>{editId === null ? w.newTitle : w.editTitle}</h3>
        {loaded ? (
          <div className="cheil-field-grid">
            {input('campaign')}
            {input('client')}
            {input('brand')}
            {input('budget')}
            {input('start', 'date')}
            {input('end', 'date')}
            {area('target')}
            {area('kpi')}
            {input('team')}
            {input('author')}
          </div>
        ) : null}
        {error ? (
          <p className="cheil-campaign-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-buttons">
          <button type="button" className="btn btn-secondary" onClick={() => onDone(editId)}>
            {w.cancel}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="cheil-campaign-submit"
            disabled={busy || !loaded}
          >
            {editId === null ? w.create : w.save}
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * Plan item 4: open several templates at once for this campaign. Each is a
 * file in the campaign's folder (plan item 5) and opens in a new tab with the
 * card's values already in its common blanks (the main
 * process works them out from the stored card) and its request, with the
 * card's lines, waiting unsent in the AI panel.
 */
function DocumentSet({
  w,
  lang,
  card,
  onOpen,
}: {
  w: Words
  lang: 'ko' | 'en'
  card: CheilCampaignCard
  /** the number of tabs opened, or null when it failed (the view says why) */
  onOpen: (items: CampaignSetItem[]) => Promise<number | null>
}) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(DEFAULT_SET))
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  const toggle = (skill: string) =>
    setChosen((prev) => {
      const next = new Set(prev)
      if (next.has(skill)) next.delete(skill)
      else next.add(skill)
      return next
    })

  const open = async () => {
    if (busy || chosen.size === 0) return
    const summary = cheilCardSummary(card)
    const items = AGENCY_TEMPLATES.filter((tpl) => chosen.has(tpl.skill)).map((tpl) => ({
      skill: tpl.skill,
      title: tpl.ko.title,
      text: summary ? `${tpl[lang].request.trimEnd()}\n\n${summary}` : tpl[lang].request,
    }))
    setBusy(true)
    setDone(null)
    const opened = await onOpen(items)
    setBusy(false)
    if (opened !== null) setDone(opened)
  }

  return (
    <section className="cheil-set" aria-label={w.setTitle} data-testid="cheil-campaign-set">
      <div className="cheil-set-head">
        <span className="section-label">{w.setTitle}</span>
      </div>
      <p className="cheil-set-desc">{w.setDesc}</p>
      <div className="cheil-set-options">
        {AGENCY_TEMPLATES.map((tpl) => (
          <label
            key={tpl.skill}
            className={`cheil-set-option${chosen.has(tpl.skill) ? ' is-on' : ''}`}
          >
            <input
              type="checkbox"
              checked={chosen.has(tpl.skill)}
              data-skill={tpl.skill}
              onChange={() => toggle(tpl.skill)}
            />
            {tpl[lang].title}
          </label>
        ))}
      </div>
      <div className="cheil-set-foot">
        <button
          className="btn btn-primary"
          data-testid="cheil-campaign-open-set"
          disabled={busy || chosen.size === 0}
          onClick={() => void open()}
        >
          {w.setOpen(chosen.size)}
        </button>
        {done !== null ? (
          <span className="cheil-set-done" role="status">
            {w.setOpened(done)}
          </span>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Plan item 3: to-dos out of a received mail. One model call reads them (the
 * shared `ai:chat`, so the confidentiality line applies); the person checks,
 * edits and picks them; only then do they go into the timeline with their
 * due days.
 */
function MailTasks({
  w,
  api,
  card,
  onAdd,
}: {
  w: Words
  api: CheilCampaignApi
  card: CheilCampaignCard
  /** the number recorded, or null when it failed (the view says why) */
  onAdd: (tasks: CampaignTask[]) => Promise<number | null>
}) {
  const [mail, setMail] = useState('')
  const [phase, setPhase] = useState<'idle' | 'reading' | 'review'>('idle')
  const [rows, setRows] = useState<Array<CampaignTask & { on: boolean }>>([])
  const [message, setMessage] = useState('')

  const read = async () => {
    if (!mail.trim() || phase === 'reading') return
    setPhase('reading')
    setMessage('')
    const settings = await readAiSettings()
    const prompt = buildCheilTaskPrompt({
      mail,
      today: cheilToday(),
      campaign: card.campaign,
      client: card.client,
    })
    const reply = await api
      .aiChat({ settings, system: prompt.system, user: prompt.user, json: true })
      .catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }))
    if (!reply.ok || !('content' in reply) || !reply.content) {
      setPhase('idle')
      setMessage(w.tasksFailed(('error' in reply && reply.error) || ''))
      return
    }
    const tasks = parseCheilTasks(reply.content)
    if (tasks.length === 0) {
      setPhase('idle')
      setMessage(w.tasksNone)
      return
    }
    setRows(tasks.map((t) => ({ ...t, on: true })))
    setPhase('review')
  }

  const chosen = rows.filter((r) => r.on && r.task.trim())
  const add = async () => {
    const added = await onAdd(chosen.map(({ task, owner, due }) => ({ task, owner, due })))
    if (added === null) return
    setRows([])
    setMail('')
    setPhase('idle')
    setMessage(w.tasksAdded(added))
  }
  const edit = (i: number, patch: Partial<CampaignTask & { on: boolean }>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <section
      className="cheil-set cheil-mail"
      aria-label={w.mailTitle}
      data-testid="cheil-mail-tasks"
    >
      <div className="cheil-set-head">
        <span className="section-label">{w.mailTitle}</span>
      </div>
      {phase !== 'review' ? (
        <>
          <textarea
            className="cheil-mail-input"
            rows={3}
            value={mail}
            placeholder={w.mailPlaceholder}
            data-testid="cheil-mail-input"
            onChange={(e) => setMail(e.target.value)}
          />
          <div className="cheil-set-foot">
            <button
              className="btn btn-secondary"
              data-testid="cheil-mail-read"
              disabled={!mail.trim() || phase === 'reading'}
              onClick={() => void read()}
            >
              {phase === 'reading' ? w.mailReading : w.mailRead}
            </button>
            {message ? (
              <span className="cheil-set-done" role="status">
                {message}
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p className="cheil-set-desc">{w.tasksReview}</p>
          <ul className="cheil-task-rows" data-testid="cheil-mail-review">
            {rows.map((row, i) => (
              <li key={i} className={`cheil-task-row${row.on ? '' : ' is-off'}`}>
                <input
                  type="checkbox"
                  checked={row.on}
                  aria-label={row.task}
                  onChange={(e) => edit(i, { on: e.target.checked })}
                />
                <input
                  className="cheil-task-text"
                  value={row.task}
                  aria-label={w.taskLabel}
                  onChange={(e) => edit(i, { task: e.target.value })}
                />
                <input
                  className="cheil-task-owner"
                  value={row.owner}
                  placeholder={w.ownerLabel}
                  aria-label={w.ownerLabel}
                  onChange={(e) => edit(i, { owner: e.target.value })}
                />
                <input
                  className="cheil-task-due"
                  type="date"
                  value={row.due}
                  aria-label={w.dueLabel}
                  onChange={(e) => edit(i, { due: e.target.value })}
                />
              </li>
            ))}
          </ul>
          <div className="cheil-set-foot">
            <button
              className="btn btn-primary"
              data-testid="cheil-mail-add"
              disabled={chosen.length === 0}
              onClick={() => void add()}
            >
              {w.tasksAdd(chosen.length)}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setRows([])
                setPhase('idle')
              }}
            >
              {w.cancel}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

/** Plan item 5: what a card edit changed in the campaign's documents, open or opened again */
function PropagationList({ w, result }: { w: Words; result: CampaignPropagation }) {
  return (
    <section
      className="cheil-set cheil-propagation"
      aria-label={w.propTitle}
      data-testid="cheil-propagation"
    >
      <div className="cheil-set-head">
        <span className="section-label">{w.propTitle}</span>
      </div>
      {result.tabs.length === 0 ? (
        <p className="cheil-set-desc">{w.propNoTabs}</p>
      ) : (
        <ul className="cheil-propagation-list">
          {result.tabs.map((tab, i) => {
            const done = tab.items.filter((item) => item.count > 0)
            return (
              <li key={i}>
                <strong>{tab.title}</strong>{' '}
                {!tab.answered
                  ? w.propNoAnswer
                  : done.length === 0
                    ? w.propNothing
                    : done
                        .map((item) => w.propItem(item.label, item.from, item.to, item.count))
                        .join(', ')}
                {tab.reopened ? ` ${w.propReopened}` : null}
              </li>
            )
          })}
        </ul>
      )}
      {result.left?.length ? (
        <p className="cheil-set-desc">{w.propLeft(result.left.join(', '))}</p>
      ) : null}
      {result.cleared.length > 0 ? (
        <p className="cheil-set-desc">{w.propCleared(result.cleared.join(', '))}</p>
      ) : null}
      <p className="cheil-set-desc">{w.propClosed}</p>
    </section>
  )
}

function CampaignView({
  w,
  lang,
  api,
  id,
  propagation,
  onEdit,
  onClose,
}: {
  w: Words
  lang: 'ko' | 'en'
  api: CheilCampaignApi
  id: string
  /** plan item 5: the last card edit's changes in the open documents */
  propagation?: CampaignPropagation | undefined
  onEdit: () => void
  onClose: () => void
}) {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEscape(onClose)

  useEffect(() => {
    let live = true
    void api.get(id).then((res) => {
      if (!live) return
      if (res.ok) setCampaign(res.campaign)
      else setError(w.fail[res.reason])
    })
    // plan item 3: editor tabs add lines on their own (fills); pick them up while the view is open
    const timer = window.setInterval(() => {
      void api.get(id).then((res) => {
        if (!live || !res.ok) return
        setCampaign((prev) =>
          prev && prev.events === res.campaign.events && prev.updatedAt === res.campaign.updatedAt
            ? prev
            : res.campaign,
        )
      })
    }, VIEW_REFRESH_MS)
    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [api, id, w])

  const act = async (run: () => Promise<{ ok: boolean; reason?: CampaignFailReason }>) => {
    setError('')
    const res = await run().catch(() => ({ ok: false, reason: 'failed' as const }))
    if (!res.ok) setError(w.fail[res.reason ?? 'failed'])
  }

  const addNote = async () => {
    const text = note.trim()
    if (!text || busy) return
    setBusy(true)
    const res = await api
      .note(id, text)
      .catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(false)
    if (!res.ok) return setError(w.fail[res.reason])
    setCampaign(res.campaign)
    setNote('')
  }

  const card = campaign?.card
  const timeline = campaign ? [...campaign.timeline].reverse() : []

  return (
    <div className="modal-overlay cheil-dialog" onClick={onClose}>
      <div
        className="modal cheil-campaign-view"
        role="dialog"
        aria-modal="true"
        aria-label={card?.campaign ?? w.label}
        data-testid="cheil-campaign-view"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cheil-campaign-view-head">
          <div>
            <h3>{card?.campaign ?? ''}</h3>
            <p className="cheil-campaign-view-sub">
              {card ? [card.client, card.brand, period(card)].filter(Boolean).join(' · ') : ''}
            </p>
          </div>
          <button className="cheil-icon-btn" aria-label={w.close} onClick={onClose}>
            ×
          </button>
        </div>

        {card ? (
          <dl className="cheil-card-grid">
            {VIEW_ROWS.map((key) => {
              const value = key === 'period' ? period(card) : card[key]
              const shown = key === 'period' ? value || w.emptyValue : shownValue(w, key, value)
              return (
                <div key={key} className={`cheil-card-item cheil-card-${key}`}>
                  <dt>{key === 'period' ? w.period : w.fields[key]}</dt>
                  <dd className={value ? '' : 'is-empty'}>{shown}</dd>
                </div>
              )
            })}
          </dl>
        ) : null}

        {propagation ? <PropagationList w={w} result={propagation} /> : null}

        {card ? (
          <DocumentSet
            w={w}
            lang={lang}
            card={card}
            onOpen={async (items) => {
              setError('')
              const res = await api
                .openSet(id, items)
                .catch(() => ({ ok: false as const, reason: 'failed' as const }))
              if (!res.ok) {
                setError(w.fail[res.reason])
                return null
              }
              setCampaign(res.campaign)
              return res.opened
            }}
          />
        ) : null}

        {card ? (
          <MailTasks
            w={w}
            api={api}
            card={card}
            onAdd={async (tasks) => {
              setError('')
              const res = await api
                .addTasks(id, tasks)
                .catch(() => ({ ok: false as const, reason: 'failed' as const }))
              if (!res.ok) {
                setError(w.fail[res.reason])
                return null
              }
              setCampaign(res.campaign)
              return res.added
            }}
          />
        ) : null}

        <div className="cheil-campaign-actions">
          <button className="btn btn-secondary" onClick={onEdit} disabled={!card}>
            {w.editCard}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => void act(() => api.openFolder(id))}
            disabled={!card}
          >
            {w.openFolder}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => void act(() => api.openHistory(id))}
            disabled={!card}
          >
            {w.openHistory}
          </button>
        </div>

        <div className="cheil-note-box">
          <textarea
            rows={2}
            value={note}
            placeholder={w.notePlaceholder}
            data-testid="cheil-campaign-note"
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void addNote()
            }}
          />
          <button
            className="btn btn-primary"
            data-testid="cheil-campaign-note-add"
            disabled={!note.trim() || busy || !card}
            onClick={() => void addNote()}
          >
            {w.addNote}
          </button>
        </div>

        {error ? (
          <p className="cheil-campaign-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="cheil-timeline-head">
          <span className="section-label">{w.timeline}</span>
          <span className="cheil-timeline-count">{campaign ? w.events(campaign.events) : ''}</span>
        </div>
        <ol className="cheil-timeline" data-testid="cheil-campaign-timeline">
          {campaign && timeline.length === 0 ? <li className="is-empty">{w.noEvents}</li> : null}
          {timeline.map((event, i) => (
            <li key={`${event.at}-${i}`} className={`cheil-event cheil-event-${event.kind}`}>
              <span className="cheil-event-kind">{w.kinds[event.kind]}</span>
              <span className="cheil-event-text">
                {eventText(w, event)}
                {event.due ? <span className="cheil-event-due"> · {w.due(event.due)}</span> : null}
                {event.files?.length ? (
                  <span className="cheil-event-files"> · {event.files.join(', ')}</span>
                ) : null}
              </span>
              <time className="cheil-event-time" dateTime={event.at} title={localTime(event.at)}>
                {localTime(event.at)}
              </time>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
