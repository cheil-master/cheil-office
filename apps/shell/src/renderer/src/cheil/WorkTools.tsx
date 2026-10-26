/**
 * Cheil fork: the home's "업무 도구" — what office staff open other websites
 * for, here and with no campaign needed: a mail draft, a spelling check and
 * character count, amounts in words and VAT, day counts, translation, and the
 * PDF tools. Counting, the spelling rules, amounts and dates run on this PC;
 * the mail draft, the closer spelling check and translation ask a model once
 * through the shared `ai:chat` (the confidentiality line), with numbers and
 * dates kept on this PC.
 */
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { Lang } from '@genoffice/i18n'
import { cheilToday } from '@genoffice/ui'
import { useI18n } from '../locale'
import { readAiSettings } from '../settings-ai'
import {
  CHEIL_CAMPAIGN_BRIDGE_KEY,
  type CampaignDetail,
  type CampaignSummary,
  type CheilCampaignApi,
} from '../../../shared/cheil-campaign-api'
import { MailDraft, words as campaignWords } from './MyCampaigns'
import { applySpellingFixes, countText, findSpellingIssues } from './tools/text-tools'
import {
  addWorkdays,
  amountInWords,
  dayOf,
  dday,
  holidaysKnown,
  isoOf,
  parseAmount,
  spanOf,
  vatOf,
  weekOf,
} from './tools/number-tools'
import {
  TRANSLATE_LANGS,
  buildSpellingPrompt,
  buildTranslatePrompt,
  parseSpellingFixes,
  parseTranslation,
  type SpellingFix,
  type TranslateLang,
} from './tools/ai-tools'

export type WorkToolId = 'mail' | 'spelling' | 'money' | 'dates' | 'translate'

const WORDS = {
  ko: {
    section: '업무 도구',
    tools: {
      mail: '메일 초안',
      spelling: '맞춤법·글자수',
      money: '금액·부가세',
      dates: '날짜 계산',
      translate: '번역',
      pdf: 'PDF 도구',
    },
    mailCampaign: '캠페인',
    mailNone: '캠페인 없이 쓰기',
    mailHint:
      '캠페인을 고르면 카드 값과 최근 이력이 초안에 들어가고, 복사하면 그 캠페인 타임라인에 남습니다.',
    textPlaceholder: '글을 붙여넣거나 입력하세요.',
    withSpaces: '공백 포함',
    withoutSpaces: '공백 제외',
    bytes: '바이트(한글 2)',
    utf8: (n: number) => `UTF-8 ${n.toLocaleString()}바이트`,
    lines: (n: number) => `${n}줄`,
    sheets: '원고지(200자)',
    chars: (n: number) => `${n.toLocaleString()}자`,
    sheetCount: (n: number) => `약 ${n}장`,
    issuesNone: '자주 틀리는 말과 띄어쓰기에서는 고칠 곳을 찾지 못했습니다.',
    issuesTitle: (n: number) => `고칠 곳 ${n}개 (이 PC 의 규칙, AI 없이)`,
    fix: '고치기',
    fixAll: '모두 고치기',
    aiCheck: 'AI로 자세히 보기',
    aiChecking: 'AI 가 읽는 중…',
    aiFixes: (n: number) => `AI 가 찾은 고칠 곳 ${n}개`,
    aiNone: 'AI 가 더 고칠 곳을 찾지 못했습니다.',
    aiFailed: (why: string) => `AI 에 묻지 못했습니다${why ? `: ${why}` : '.'}`,
    aiBroken: 'AI 의 답을 읽지 못했습니다. 다시 해 보세요.',
    copy: '복사',
    copied: '복사했습니다.',
    amount: '금액',
    amountPlaceholder: '예: 5억 2,000만원 / 520000000',
    amountBad: '금액으로 읽지 못했습니다. 숫자와 조·억·만·천만 써 주세요.',
    words: '한글 금액',
    vatGiven: '입력한 금액은',
    supplyGiven: '공급가액(VAT 별도)',
    totalGiven: '합계(VAT 포함)',
    supply: '공급가액',
    vat: '부가세(10%)',
    total: '합계',
    won: (n: number) => `${n.toLocaleString('en-US')}원`,
    vatNote:
      '부가세는 공급가액의 10%에서 원 미만을 버립니다. 합계에서 나눌 때는 공급가액을 반올림하고 나머지를 부가세로 둡니다.',
    today: '오늘',
    target: '날짜',
    ddayTitle: 'D-day',
    spanTitle: '기간 (시작일·종료일 모두 포함)',
    start: '시작일',
    end: '종료일',
    days: (n: number) => `${n}일`,
    workdays: (n: number) => `영업일 ${n}일`,
    holidaysOut: (list: string) => `뺀 공휴일: ${list}`,
    unknownYears: (years: string) =>
      `${years}년은 공휴일 표가 없어 주말만 뺐습니다. 그 해 공휴일은 직접 확인하세요.`,
    addTitle: '영업일 더하기',
    addN: '영업일 수 (뒤로는 -)',
    addResult: (iso: string, weekday: string) => `${iso} (${weekday})`,
    weekTitle: '몇 주차',
    weekResult: (y: number, iso: number, m: number, month: number) =>
      `${y}년 ${iso}주차 (ISO) · ${month}월 ${m}주차`,
    weekdays: ['일', '월', '화', '수', '목', '금', '토'],
    holiday: (name: string) => `공휴일: ${name}`,
    translateTo: '옮길 말',
    toneBusiness: '업무 문체',
    tonePlain: '자연스럽게',
    translate: '번역하기',
    translating: 'AI 가 옮기는 중…',
    translateNote: '숫자·날짜는 AI 에 보내지 않고 앱이 그대로 넣습니다.',
  },
  en: {
    section: 'Work tools',
    tools: {
      mail: 'Mail draft',
      spelling: 'Spelling · count',
      money: 'Amount · VAT',
      dates: 'Dates',
      translate: 'Translate',
      pdf: 'PDF tools',
    },
    mailCampaign: 'Campaign',
    mailNone: 'Without a campaign',
    mailHint:
      'Pick a campaign to put its card and recent history in the draft; copying records it in that campaign’s timeline.',
    textPlaceholder: 'Paste or type your text.',
    withSpaces: 'With spaces',
    withoutSpaces: 'No spaces',
    bytes: 'Bytes (Korean 2)',
    utf8: (n: number) => `UTF-8 ${n.toLocaleString()} bytes`,
    lines: (n: number) => `${n} lines`,
    sheets: 'Sheets (200)',
    chars: (n: number) => n.toLocaleString(),
    sheetCount: (n: number) => `about ${n}`,
    issuesNone: 'No common mistakes or spacing errors found.',
    issuesTitle: (n: number) => `${n} to fix (rules on this PC, no AI)`,
    fix: 'Fix',
    fixAll: 'Fix all',
    aiCheck: 'Check more with AI',
    aiChecking: 'The AI is reading…',
    aiFixes: (n: number) => `${n} found by the AI`,
    aiNone: 'The AI found nothing more to fix.',
    aiFailed: (why: string) => `Could not ask the AI${why ? `: ${why}` : '.'}`,
    aiBroken: 'The AI’s answer could not be read. Try again.',
    copy: 'Copy',
    copied: 'Copied.',
    amount: 'Amount',
    amountPlaceholder: 'e.g. 520000000 or 5억 2,000만원',
    amountBad: 'Not an amount. Use digits and 조·억·만·천.',
    words: 'In Korean words',
    vatGiven: 'The amount is',
    supplyGiven: 'Supply price (VAT excluded)',
    totalGiven: 'Total (VAT included)',
    supply: 'Supply price',
    vat: 'VAT (10%)',
    total: 'Total',
    won: (n: number) => `₩${n.toLocaleString('en-US')}`,
    vatNote:
      'VAT is 10% of the supply price, won fractions cut. From a total, the supply price is rounded and the rest is VAT.',
    today: 'Today',
    target: 'Date',
    ddayTitle: 'D-day',
    spanTitle: 'Period (both days counted)',
    start: 'Start',
    end: 'End',
    days: (n: number) => `${n} days`,
    workdays: (n: number) => `${n} working days`,
    holidaysOut: (list: string) => `Holidays left out: ${list}`,
    unknownYears: (years: string) =>
      `No holiday table for ${years}: only weekends were left out. Check that year’s holidays.`,
    addTitle: 'Add working days',
    addN: 'Working days (minus for back)',
    addResult: (iso: string, weekday: string) => `${iso} (${weekday})`,
    weekTitle: 'Week',
    weekResult: (y: number, iso: number, m: number, month: number) =>
      `${y} week ${iso} (ISO) · week ${m} of month ${month}`,
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    holiday: (name: string) => `Holiday: ${name}`,
    translateTo: 'Into',
    toneBusiness: 'Business',
    tonePlain: 'Plain',
    translate: 'Translate',
    translating: 'The AI is translating…',
    translateNote: 'Numbers and dates are not sent to the AI; the app keeps them.',
  },
}

type Words = (typeof WORDS)['ko']
const toolWords = (lang: Lang): Words => (lang === 'ko' ? WORDS.ko : (WORDS.en as unknown as Words))

function bridge(): CheilCampaignApi | undefined {
  return (window as unknown as Record<string, CheilCampaignApi | undefined>)[
    CHEIL_CAMPAIGN_BRIDGE_KEY
  ]
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** One model call through the shared `ai:chat`; the content, or why not */
async function askOnce(
  api: CheilCampaignApi,
  system: string,
  user: string,
): Promise<{ content: string } | { error: string }> {
  const settings = await readAiSettings()
  const reply = await api
    .aiChat({ settings, system, user, json: true })
    .catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  if (!reply.ok || !('content' in reply) || !reply.content) {
    return { error: ('error' in reply && reply.error) || '' }
  }
  return { content: reply.content }
}

// ── nav ──────────────────────────────────────────────────────────────────

const ICON_PATHS: Record<WorkToolId | 'pdf', string> = {
  mail: 'M2 4h12v8H2zM2 4l6 4.5L14 4',
  spelling: 'M2.5 12L5.5 4l3 8M3.6 9.2h3.8M10 9.5l1.6 1.6L14 7.5',
  money:
    'M2 4.5h12v7H2zM8 6v4M6.6 7.2c0-.7.6-1.2 1.4-1.2s1.4.5 1.4 1.1M9.4 8.8c0 .7-.6 1.2-1.4 1.2s-1.4-.5-1.4-1.2',
  dates: 'M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3',
  translate:
    'M2 3.5h6M5 2v1.5M3.5 3.5c.4 2 1.8 3.6 3.5 4.5M6.5 3.5c-.4 2-1.8 3.6-3.5 4.5M8.5 14l2.5-6 2.5 6M9.3 12h3.4',
  pdf: 'M3.5 1.8h6l3 3v9.4h-9zM9.5 1.8v3h3M5.5 9h5M5.5 11.3h3.5',
}

function ToolIcon({ id }: { id: WorkToolId | 'pdf' }): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={ICON_PATHS[id]}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The left nav's "업무 도구" group; PDF opens the PDF tools window */
export function WorkToolsNav({
  active,
  onPick,
}: {
  active: WorkToolId | null
  onPick: (tool: WorkToolId) => void
}) {
  const { lang } = useI18n()
  const w = toolWords(lang)
  if (!bridge()) return null
  const tools: WorkToolId[] = ['mail', 'spelling', 'money', 'dates', 'translate']
  const pdf = (window as { aiOfficePdfToolsHome?: { open(): Promise<unknown> } })
    .aiOfficePdfToolsHome
  return (
    <div className="cheil-tools-nav" data-testid="cheil-tools-nav">
      <div className="cheil-tools-nav-label">{w.section}</div>
      {tools.map((tool) => (
        <button
          key={tool}
          className={`nav-item${active === tool ? ' active' : ''}`}
          data-tool={tool}
          onClick={() => onPick(tool)}
        >
          <ToolIcon id={tool} />
          <span className="nav-label">{w.tools[tool]}</span>
        </button>
      ))}
      {pdf ? (
        <button className="nav-item" data-tool="pdf" onClick={() => void pdf.open()}>
          <ToolIcon id="pdf" />
          <span className="nav-label">{w.tools.pdf}</span>
        </button>
      ) : null}
    </div>
  )
}

// ── the tools ────────────────────────────────────────────────────────────

export function WorkToolView({ tool }: { tool: WorkToolId }) {
  const { lang } = useI18n()
  const w = toolWords(lang)
  const api = bridge()
  if (!api) return null
  return (
    <main className="content cheil-tool" data-testid={`cheil-tool-${tool}`}>
      <h2 className="cheil-tool-title">{w.tools[tool]}</h2>
      {tool === 'mail' ? <MailTool lang={lang} api={api} w={w} /> : null}
      {tool === 'spelling' ? <SpellingTool api={api} w={w} /> : null}
      {tool === 'money' ? <MoneyTool w={w} /> : null}
      {tool === 'dates' ? <DateTool w={w} /> : null}
      {tool === 'translate' ? <TranslateTool api={api} w={w} /> : null}
    </main>
  )
}

function MailTool({ lang, api, w }: { lang: Lang; api: CheilCampaignApi; w: Words }) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [chosen, setChosen] = useState('')
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  useEffect(() => {
    void api.list().then((res) => res.ok && setCampaigns(res.campaigns))
  }, [api])
  useEffect(() => {
    if (!chosen) {
      setCampaign(null)
      return
    }
    let live = true
    void api.get(chosen).then((res) => live && setCampaign(res.ok ? res.campaign : null))
    return () => {
      live = false
    }
  }, [api, chosen])
  return (
    <>
      <div className="cheil-mail-row">
        <span className="cheil-mail-row-label">{w.mailCampaign}</span>
        <select
          className="cheil-tool-select"
          value={chosen}
          data-testid="cheil-tool-mail-campaign"
          onChange={(e) => setChosen(e.target.value)}
        >
          <option value="">{w.mailNone}</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.card.client, c.card.campaign].filter(Boolean).join(' · ')}
            </option>
          ))}
        </select>
      </div>
      <p className="cheil-set-desc">{w.mailHint}</p>
      <MailDraft
        key={campaign?.id ?? 'none'}
        w={campaignWords(lang)}
        api={api}
        campaign={campaign}
        onRecorded={setCampaign}
      />
    </>
  )
}

function SpellingTool({ api, w }: { api: CheilCampaignApi; w: Words }) {
  const [text, setText] = useState('')
  const [aiFixes, setAiFixes] = useState<SpellingFix[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const count = countText(text)
  const issues = findSpellingIssues(text)

  const askAi = async () => {
    if (busy || !text.trim()) return
    setBusy(true)
    setMessage('')
    setAiFixes(null)
    const prompt = buildSpellingPrompt(text)
    const reply = await askOnce(api, prompt.system, prompt.user)
    setBusy(false)
    if ('error' in reply) return setMessage(w.aiFailed(reply.error))
    const fixes = parseSpellingFixes(reply.content, text, prompt.values)
    if (!fixes) return setMessage(w.aiBroken)
    setAiFixes(fixes)
    if (fixes.length === 0) setMessage(w.aiNone)
  }

  const applyAiFix = (fix: SpellingFix) => {
    setText((prev) => prev.replace(fix.find, fix.fix))
    setAiFixes((prev) => prev?.filter((f) => f !== fix) ?? null)
  }

  return (
    <>
      <textarea
        className="cheil-mail-input cheil-tool-text"
        rows={10}
        value={text}
        placeholder={w.textPlaceholder}
        data-testid="cheil-tool-text"
        onChange={(e) => {
          setText(e.target.value)
          setAiFixes(null)
        }}
      />
      <div className="cheil-tool-metrics" data-testid="cheil-tool-counts">
        <div>
          <span>{w.withSpaces}</span>
          <strong>{w.chars(count.withSpaces)}</strong>
        </div>
        <div>
          <span>{w.withoutSpaces}</span>
          <strong>{w.chars(count.withoutSpaces)}</strong>
        </div>
        <div title={w.utf8(count.utf8)}>
          <span>{w.bytes}</span>
          <strong>{count.bytes.toLocaleString()}</strong>
        </div>
        <div title={w.lines(count.lines)}>
          <span>{w.sheets}</span>
          <strong>{w.sheetCount(count.sheets)}</strong>
        </div>
      </div>
      {text.trim() ? (
        <section className="cheil-set" data-testid="cheil-tool-issues">
          <p className="cheil-set-desc">
            {issues.length ? w.issuesTitle(issues.length) : w.issuesNone}
          </p>
          <ul className="cheil-tool-list">
            {issues.map((issue) => (
              <li key={`${issue.start}-${issue.found}`}>
                <span className="cheil-tool-wrong">{issue.found}</span> → {issue.fix}{' '}
                <span className="cheil-tool-kind">{issue.kind}</span>
                <button
                  className="btn btn-secondary"
                  onClick={() => setText((prev) => applySpellingFixes(prev, [issue]))}
                >
                  {w.fix}
                </button>
              </li>
            ))}
          </ul>
          {aiFixes?.length ? (
            <>
              <p className="cheil-set-desc">{w.aiFixes(aiFixes.length)}</p>
              <ul className="cheil-tool-list" data-testid="cheil-tool-ai-fixes">
                {aiFixes.map((fix) => (
                  <li key={fix.find}>
                    <span className="cheil-tool-wrong">{fix.find}</span> → {fix.fix}{' '}
                    <span className="cheil-tool-kind">{fix.why}</span>
                    <button className="btn btn-secondary" onClick={() => applyAiFix(fix)}>
                      {w.fix}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="cheil-set-foot">
            {issues.length ? (
              <button
                className="btn btn-primary"
                data-testid="cheil-tool-fix-all"
                onClick={() => setText(applySpellingFixes(text, issues))}
              >
                {w.fixAll}
              </button>
            ) : null}
            <button
              className="btn btn-secondary"
              data-testid="cheil-tool-ai-check"
              disabled={busy}
              onClick={() => void askAi()}
            >
              {busy ? w.aiChecking : w.aiCheck}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => void copyText(text).then((ok) => ok && setMessage(w.copied))}
            >
              {w.copy}
            </button>
            {message ? (
              <span className="cheil-set-done" role="status">
                {message}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  )
}

function MoneyTool({ w }: { w: Words }) {
  const [raw, setRaw] = useState('')
  const [given, setGiven] = useState<'supply' | 'total'>('supply')
  const [message, setMessage] = useState('')
  const amount = raw.trim() ? parseAmount(raw) : null
  const vat = amount !== null ? vatOf(amount, given) : null
  return (
    <>
      <div className="cheil-mail-row">
        <span className="cheil-mail-row-label">{w.amount}</span>
        <input
          className="cheil-mail-input"
          value={raw}
          placeholder={w.amountPlaceholder}
          data-testid="cheil-tool-amount"
          onChange={(e) => setRaw(e.target.value)}
        />
      </div>
      {raw.trim() && amount === null ? <p className="cheil-set-desc">{w.amountBad}</p> : null}
      {amount !== null && vat ? (
        <>
          <section className="cheil-set">
            <span className="section-label">{w.words}</span>
            <p className="cheil-tool-result" data-testid="cheil-tool-words">
              {amountInWords(amount)}
            </p>
            <button
              className="btn btn-secondary"
              onClick={() =>
                void copyText(amountInWords(amount)).then((ok) => ok && setMessage(w.copied))
              }
            >
              {w.copy}
            </button>{' '}
            {message ? <span className="cheil-set-done">{message}</span> : null}
          </section>
          <section className="cheil-set">
            <div className="cheil-mail-row" role="radiogroup" aria-label={w.vatGiven}>
              <span className="cheil-mail-row-label">{w.vatGiven}</span>
              <div className="cheil-set-options">
                {(['supply', 'total'] as const).map((g) => (
                  <label key={g} className={`cheil-set-option${given === g ? ' is-on' : ''}`}>
                    <input
                      type="radio"
                      name="cheil-vat-given"
                      checked={given === g}
                      data-choice={g}
                      onChange={() => setGiven(g)}
                    />
                    {g === 'supply' ? w.supplyGiven : w.totalGiven}
                  </label>
                ))}
              </div>
            </div>
            <div className="cheil-tool-metrics" data-testid="cheil-tool-vat">
              <div>
                <span>{w.supply}</span>
                <strong>{w.won(vat.supply)}</strong>
              </div>
              <div>
                <span>{w.vat}</span>
                <strong>{w.won(vat.vat)}</strong>
              </div>
              <div>
                <span>{w.total}</span>
                <strong>{w.won(vat.total)}</strong>
              </div>
            </div>
            <p className="cheil-set-desc">{w.vatNote}</p>
          </section>
        </>
      ) : null}
    </>
  )
}

function DateTool({ w }: { w: Words }) {
  const today = cheilToday()
  const [target, setTarget] = useState('')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState('')
  const [base, setBase] = useState(today)
  const [n, setN] = useState('5')
  const day = (iso: string) => dayOf(iso)
  const weekday = (d: Date) => w.weekdays[d.getUTCDay()]!
  const t = day(target)
  const s = day(start)
  const e = day(end)
  const span = s && e ? spanOf(s, e) : null
  const b = day(base)
  const added = b && /^-?\d{1,4}$/.test(n.trim()) ? addWorkdays(b, Number(n)) : null
  const week = t ?? day(today)
  const weekInfo = week ? weekOf(week) : null
  return (
    <>
      <section className="cheil-set" data-testid="cheil-tool-dday">
        <span className="section-label">{w.ddayTitle}</span>
        <div className="cheil-mail-row">
          <span className="cheil-mail-row-label">{w.target}</span>
          <input
            type="date"
            value={target}
            data-testid="cheil-tool-target"
            onChange={(ev) => setTarget(ev.target.value)}
          />
          {t ? (
            <strong className="cheil-tool-result" data-testid="cheil-tool-dday-result">
              {dday(t, day(today)!)} · {weekday(t)}
            </strong>
          ) : null}
        </div>
        {weekInfo ? (
          <p className="cheil-set-desc">
            {w.weekTitle}:{' '}
            {w.weekResult(
              weekInfo.year,
              weekInfo.isoWeek,
              weekInfo.monthWeek,
              (t ?? day(today)!).getUTCMonth() + 1,
            )}
          </p>
        ) : null}
      </section>
      <section className="cheil-set" data-testid="cheil-tool-span">
        <span className="section-label">{w.spanTitle}</span>
        <div className="cheil-mail-row">
          <span className="cheil-mail-row-label">{w.start}</span>
          <input
            type="date"
            value={start}
            data-testid="cheil-tool-start"
            onChange={(ev) => setStart(ev.target.value)}
          />
          <span className="cheil-mail-row-label">{w.end}</span>
          <input
            type="date"
            value={end}
            data-testid="cheil-tool-end"
            onChange={(ev) => setEnd(ev.target.value)}
          />
        </div>
        {span ? (
          <>
            <p className="cheil-tool-result" data-testid="cheil-tool-span-result">
              {w.days(span.days)} · {w.workdays(span.workdays)}
            </p>
            {span.holidays.length ? (
              <p className="cheil-set-desc">
                {w.holidaysOut(span.holidays.map((h) => `${h.date.slice(5)} ${h.name}`).join(', '))}
              </p>
            ) : null}
            {span.unknownYears.length ? (
              <p className="cheil-set-desc cheil-mail-warn">
                {w.unknownYears(span.unknownYears.join(', '))}
              </p>
            ) : null}
          </>
        ) : null}
      </section>
      <section className="cheil-set" data-testid="cheil-tool-add">
        <span className="section-label">{w.addTitle}</span>
        <div className="cheil-mail-row">
          <span className="cheil-mail-row-label">{w.start}</span>
          <input type="date" value={base} onChange={(ev) => setBase(ev.target.value)} />
          <input
            className="cheil-tool-small"
            value={n}
            aria-label={w.addN}
            title={w.addN}
            data-testid="cheil-tool-add-n"
            onChange={(ev) => setN(ev.target.value)}
          />
          {added ? (
            <strong className="cheil-tool-result" data-testid="cheil-tool-add-result">
              {w.addResult(isoOf(added), weekday(added))}
            </strong>
          ) : null}
        </div>
        {added && !holidaysKnown(added.getUTCFullYear()) ? (
          <p className="cheil-set-desc cheil-mail-warn">
            {w.unknownYears(String(added.getUTCFullYear()))}
          </p>
        ) : null}
      </section>
    </>
  )
}

function TranslateTool({ api, w }: { api: CheilCampaignApi; w: Words }) {
  const [text, setText] = useState('')
  const [to, setTo] = useState<TranslateLang>('en')
  const [tone, setTone] = useState<'business' | 'plain'>('business')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const run = async () => {
    if (busy || !text.trim()) return
    setBusy(true)
    setMessage('')
    const prompt = buildTranslatePrompt(text, to, tone)
    const reply = await askOnce(api, prompt.system, prompt.user)
    setBusy(false)
    if ('error' in reply) return setMessage(w.aiFailed(reply.error))
    const translated = parseTranslation(reply.content, prompt.values)
    if (!translated) return setMessage(w.aiBroken)
    setResult(translated)
  }

  return (
    <>
      <textarea
        className="cheil-mail-input cheil-tool-text"
        rows={8}
        value={text}
        placeholder={w.textPlaceholder}
        data-testid="cheil-tool-translate-text"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="cheil-mail-row">
        <span className="cheil-mail-row-label">{w.translateTo}</span>
        <select
          className="cheil-tool-select"
          value={to}
          data-testid="cheil-tool-translate-to"
          onChange={(e) => setTo(e.target.value as TranslateLang)}
        >
          {(Object.keys(TRANSLATE_LANGS) as TranslateLang[]).map((lang) => (
            <option key={lang} value={lang}>
              {TRANSLATE_LANGS[lang]}
            </option>
          ))}
        </select>
        <div className="cheil-set-options">
          {(['business', 'plain'] as const).map((t) => (
            <label key={t} className={`cheil-set-option${tone === t ? ' is-on' : ''}`}>
              <input
                type="radio"
                name="cheil-translate-tone"
                checked={tone === t}
                onChange={() => setTone(t)}
              />
              {t === 'business' ? w.toneBusiness : w.tonePlain}
            </label>
          ))}
        </div>
      </div>
      <p className="cheil-set-desc">{w.translateNote}</p>
      <div className="cheil-set-foot">
        <button
          className="btn btn-primary"
          data-testid="cheil-tool-translate-run"
          disabled={busy || !text.trim()}
          onClick={() => void run()}
        >
          {busy ? w.translating : w.translate}
        </button>
        {result ? (
          <button
            className="btn btn-secondary"
            onClick={() => void copyText(result).then((ok) => ok && setMessage(w.copied))}
          >
            {w.copy}
          </button>
        ) : null}
        {message ? (
          <span className="cheil-set-done" role="status">
            {message}
          </span>
        ) : null}
      </div>
      {result ? (
        <textarea
          className="cheil-mail-input cheil-tool-text"
          rows={8}
          value={result}
          data-testid="cheil-tool-translate-result"
          onChange={(e) => setResult(e.target.value)}
        />
      ) : null}
    </>
  )
}
