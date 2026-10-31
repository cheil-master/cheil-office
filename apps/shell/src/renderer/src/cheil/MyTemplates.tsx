/**
 * Cheil fork (plan item 13, step ①): the home's "내 양식" row.
 *
 * "내 양식 등록" picks a report the person wrote before (DRM already
 * removed); the main process copies it into "Cheil 양식" and finds the
 * values that change between campaigns. The person checks the list here,
 * turns rows off, renames blanks or adds their own, and "양식 만들기" opens the
 * copy in its editor with each value turned into its blank (one undo step,
 * not saved: they check it and save). The fonts, places and layout stay the
 * report's own. A card opens a template itself to edit; the campaign's
 * document set offers every template with the campaign's card filled in.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Lang } from '@genoffice/i18n'
import { cheilBlankOf } from '@genoffice/ui'
import { useI18n } from '../locale'
import { DocumentStyles } from './DocumentStyles'
import { styleWords } from './style-words'
import {
  CHEIL_CAMPAIGN_BRIDGE_KEY,
  type CampaignFailReason,
  type CheilCampaignApi,
  type MyTemplate,
  type MyTemplateCandidate,
} from '../../../shared/cheil-campaign-api'

const WORDS = {
  ko: {
    label: '내 양식',
    add: '내 양식 등록',
    empty:
      '예전에 쓴 보고서(DRM 을 푼 워드·PPT·엑셀)를 넣으면 서식과 배치는 그대로 두고 바뀌는 값만 [칸]으로 바꿔 내 양식이 됩니다.',
    reviewTitle: (title: string) => `내 양식 만들기 — ${title}`,
    reviewDesc:
      '아래 값이 [칸]으로 바뀝니다(AI 없이). 남길 값은 체크를 끄고, 칸 이름은 고칠 수 있습니다. 원본 파일은 그대로 두고 사본을 바꿉니다.',
    none: '바꿀 값을 찾지 못했습니다. 아래에서 직접 더하세요.',
    places: (n: number) => `${n}곳`,
    addFind: '찾을 글',
    addBlank: '칸 이름',
    addRow: '더하기',
    make: (n: number) => `양식 만들기 (${n})`,
    making: '바꾸는 중…',
    cancel: '취소',
    made: (title: string, n: number) =>
      `‘${title}’: ${n}곳을 [칸]으로 바꿨습니다. 열린 탭에서 확인하고 저장하세요.`,
    noAnswer: (title: string) => `‘${title}’ 탭이 응답하지 않았습니다. 열린 탭을 확인하세요.`,
    kinds: { field: '공통 칸', money: '금액', rate: '수치', date: '날짜' },
    own: '직접 더함',
    fail: {
      'not-found': '양식 파일을 찾지 못했습니다.',
      invalid: '칸 이름이나 찾을 글을 확인해 주세요(두 글자 이상, [ ] 없이).',
      failed: '양식을 열지 못했습니다. 문서 폴더에 쓸 수 있는지 확인해 주세요.',
      canceled: '',
      unreadable:
        '이 파일의 글을 읽지 못했습니다. DRM 이나 암호가 걸려 있으면 풀어서 다시 넣어 주세요.',
    } satisfies Record<CampaignFailReason, string>,
  },
  en: {
    label: 'My templates',
    add: 'Add my template',
    empty:
      'Add a report you wrote before (Word, PowerPoint or Excel, DRM removed): its look and layout stay, and only the values that change become [blanks].',
    reviewTitle: (title: string) => `Make a template — ${title}`,
    reviewDesc:
      'These values become [blanks] (no AI). Untick the ones to keep; blank names can be changed. Your original file is left as it is; a copy changes.',
    none: 'No values to change were found. Add your own below.',
    places: (n: number) => `${n}×`,
    addFind: 'Text to find',
    addBlank: 'Blank name',
    addRow: 'Add',
    make: (n: number) => `Make the template (${n})`,
    making: 'Changing…',
    cancel: 'Cancel',
    made: (title: string, n: number) =>
      `‘${title}’: ${n} places became blanks. Check the open tab and save it.`,
    noAnswer: (title: string) => `The ‘${title}’ tab did not answer. Check the open tab.`,
    kinds: { field: 'Common', money: 'Amount', rate: 'Rate', date: 'Date' },
    own: 'Added',
    fail: {
      'not-found': 'The template file was not found.',
      invalid: 'Check the blank names and texts (two characters or more, no [ ]).',
      failed: 'The template did not open. Check that the Documents folder can be written.',
      canceled: '',
      unreadable:
        'The file’s text could not be read. If it has DRM or a password, remove it and add the file again.',
    },
  },
}

type Words = (typeof WORDS)['ko']
const words = (lang: Lang): Words => (lang === 'ko' ? WORDS.ko : (WORDS.en as unknown as Words))

function bridge(): CheilCampaignApi | undefined {
  return (window as unknown as Record<string, CheilCampaignApi | undefined>)[
    CHEIL_CAMPAIGN_BRIDGE_KEY
  ]
}

/** a value to blank; `own` when the person added it */
type Row = MyTemplateCandidate & { on: boolean; own?: boolean }

export function MyTemplates({
  badge,
  onOpenStyles,
}: {
  badge: (ext: string) => React.ReactElement
  onOpenStyles?: () => void
}) {
  const { lang } = useI18n()
  const w = words(lang)
  // Cheil fork: keep personal templates and styles visible but unavailable.
  const disabled = true
  const api = bridge()
  const [templates, setTemplates] = useState<MyTemplate[] | null>(null)
  const [review, setReview] = useState<{ name: string; rows: Row[] } | null>(null)
  const [extra, setExtra] = useState({ find: '', blank: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  // Cheil fork: preserve document templates and offer appearance extraction alongside them.
  const [showStyles, setShowStyles] = useState(false)

  const refresh = useCallback(async () => {
    if (!api) return
    const res = await api.myTemplates().catch(() => null)
    setTemplates(res?.ok ? res.templates : [])
  }, [api])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!api) return null
  if (!disabled && showStyles) return <DocumentStyles onBack={() => setShowStyles(false)} />

  const titleOf = (name: string) => name.replace(/\.[^.]+$/, '')

  const add = async () => {
    if (busy) return
    setMessage('')
    setBusy(true)
    const res = await api
      .myTemplateAdd()
      .catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(false)
    if (!res.ok) {
      setMessage(w.fail[res.reason])
      return
    }
    setReview({ name: res.name, rows: res.candidates.map((c) => ({ ...c, on: true })) })
    setExtra({ find: '', blank: '' })
  }

  const cancel = async () => {
    if (!review) return
    await api.myTemplateDiscard(review.name).catch(() => undefined)
    setReview(null)
  }

  const edit = (i: number, patch: Partial<Row>) =>
    setReview((prev) =>
      prev ? { ...prev, rows: prev.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : prev,
    )

  const addRow = () => {
    const find = extra.find.trim()
    const blank = cheilBlankOf(extra.blank)
    if (!review || find.length < 2 || !blank || review.rows.some((r) => r.find === find)) return
    setReview({
      ...review,
      rows: [...review.rows, { find, blank, kind: 'field', count: 0, on: true, own: true }],
    })
    setExtra({ find: '', blank: '' })
  }

  const chosen = review?.rows.filter((r) => r.on && r.find.trim() && cheilBlankOf(r.blank)) ?? []

  const make = async () => {
    if (!review || busy || chosen.length === 0) return
    setBusy(true)
    const { name } = review
    const res = await api
      .myTemplateApply(
        name,
        chosen.map((r) => ({ find: r.find.trim(), blank: cheilBlankOf(r.blank)! })),
      )
      .catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(false)
    if (!res.ok) {
      setMessage(w.fail[res.reason])
      return
    }
    setReview(null)
    setMessage(res.answered ? w.made(titleOf(name), res.changed) : w.noAnswer(titleOf(name)))
    void refresh()
  }

  return (
    <section
      className="quick-start cheil-my-templates"
      aria-disabled={disabled}
      aria-label={w.label}
      data-testid="cheil-my-templates"
    >
      <div className="section-head">
        <span className="section-label">{w.label}</span>
        <button
          className="cheil-campaign-add"
          data-testid="cheil-style-mode"
          disabled={disabled || busy || !!review}
          onClick={() => (onOpenStyles ? onOpenStyles() : setShowStyles(true))}
        >
          {styleWords(lang).extract}
        </button>
        <button
          className="cheil-campaign-add"
          data-testid="cheil-my-template-add"
          disabled={disabled || busy}
          onClick={() => void add()}
        >
          + {w.add}
        </button>
      </div>
      {message ? (
        <p className="cheil-campaigns-empty" role="status" data-testid="cheil-my-template-status">
          {message}
        </p>
      ) : null}
      {templates && templates.length === 0 ? (
        <p className="cheil-campaigns-empty">{w.empty}</p>
      ) : (
        <div className="quick-cards cheil-campaign-cards">
          {(templates ?? []).map((t) => (
            <button
              key={t.name}
              className="quick-card cheil-my-template-card"
              data-testid="cheil-my-template-card"
              disabled={disabled}
              onClick={() => void api.myTemplateOpen(t.name)}
            >
              {badge(t.name.split('.').pop() ?? '')}
              <span className="quick-text">
                <span className="quick-title-row">
                  <span className="quick-title">{t.title}</span>
                </span>
                <span className="quick-sub">{t.name}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {review ? (
        <div className="modal-overlay cheil-dialog" onClick={() => void cancel()}>
          <div
            className="modal cheil-campaign-view"
            role="dialog"
            aria-modal="true"
            aria-label={w.reviewTitle(titleOf(review.name))}
            data-testid="cheil-my-template-review"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{w.reviewTitle(titleOf(review.name))}</h3>
            <p className="cheil-set-desc">{review.rows.length ? w.reviewDesc : w.none}</p>
            <ul className="cheil-task-rows cheil-blank-rows">
              {review.rows.map((row, i) => (
                <li key={row.find} className={`cheil-blank-row${row.on ? '' : ' is-off'}`}>
                  <input
                    type="checkbox"
                    checked={row.on}
                    aria-label={row.find}
                    onChange={(e) => edit(i, { on: e.target.checked })}
                  />
                  <span className="cheil-blank-find" title={row.find}>
                    {row.find}
                  </span>
                  <span className="cheil-blank-arrow">→</span>
                  <input
                    className="cheil-mail-input"
                    value={row.blank}
                    aria-label={w.addBlank}
                    onChange={(e) => edit(i, { blank: e.target.value })}
                  />
                  <span className="cheil-blank-count">
                    {row.own ? w.own : w.kinds[row.kind]}
                    {row.count ? ` · ${w.places(row.count)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <div className="cheil-blank-row cheil-blank-add">
              <span />
              <input
                className="cheil-mail-input"
                value={extra.find}
                placeholder={w.addFind}
                aria-label={w.addFind}
                data-testid="cheil-my-template-extra-find"
                onChange={(e) => setExtra({ ...extra, find: e.target.value })}
              />
              <span className="cheil-blank-arrow">→</span>
              <input
                className="cheil-mail-input"
                value={extra.blank}
                placeholder={w.addBlank}
                aria-label={w.addBlank}
                data-testid="cheil-my-template-extra-blank"
                onChange={(e) => setExtra({ ...extra, blank: e.target.value })}
              />
              <button
                className="btn btn-secondary"
                data-testid="cheil-my-template-extra-add"
                onClick={addRow}
              >
                {w.addRow}
              </button>
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => void cancel()}>
                {w.cancel}
              </button>
              <button
                className="btn btn-primary"
                data-testid="cheil-my-template-make"
                disabled={busy || chosen.length === 0}
                onClick={() => void make()}
              >
                {busy ? w.making : w.make(chosen.length)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
