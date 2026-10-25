/**
 * Cheil fork: "내 API 키로 연결" — Claude, GPT and Solar by the person's own
 * key, first in Settings → AI and in the first-run guide (2026-10-25: the
 * deployed app runs on the person's own API). Saving a key makes that AI the
 * one in use; removing it goes back to `auto`. The rules are in api-keys.ts.
 *
 * Words are Korean, with English for every other UI language, like the other
 * Cheil rows. Names are written as text with a generic key mark only
 * (docs/standards.md, trademarks).
 */
import { useEffect, useState } from 'react'
import type { AiSettings } from '@genoffice/ai-provider/browser'
import type { Lang } from '@genoffice/i18n'
import { Dropdown } from '@genoffice/ui'
import { changeAiSettings, readAiSettings } from '../settings-ai'
import {
  CHEIL_API_CHOICES,
  apiKeyOf,
  apiKeyState,
  apiModelOf,
  apiModels,
  maskedKey,
  withApiInUse,
  withApiKey,
  withApiModel,
  withoutApiKey,
  type CheilApiChoice,
} from './api-keys'

const WORDS = {
  ko: {
    title: '내 API 키로 연결',
    desc: '가지고 있는 Claude·GPT·Solar API 키를 넣으면 그 AI로 문서를 채우고 고칩니다. 키는 이 PC의 설정 파일에만 저장되고, 쓴 만큼 각 회사에 요금이 나갑니다. 대외비·개인정보가 보이는 요청은 보내지 않습니다.',
    keyLabel: (name: string) => `${name} API 키`,
    keyFrom: (where: string) => `${where}에서 발급`,
    model: '모델',
    save: '저장하고 쓰기',
    use: '이걸로 쓰기',
    remove: '키 지우기',
    inUse: '사용 중',
    saved: '키 저장됨',
    failed: '저장하지 못했습니다. 다시 시도해 주세요.',
  },
  en: {
    title: 'Connect your own API key',
    desc: 'Paste a Claude, GPT or Solar API key and that AI fills and edits your documents. The key is kept only in this PC’s settings file, and each company bills you for what you use. Requests that show confidential or personal information are not sent.',
    keyLabel: (name: string) => `${name} API key`,
    keyFrom: (where: string) => `made at ${where}`,
    model: 'Model',
    save: 'Save and use',
    use: 'Use this',
    remove: 'Remove key',
    inUse: 'In use',
    saved: 'Key saved',
    failed: 'Could not save. Try again.',
  },
}

type Words = (typeof WORDS)['ko']

const words = (lang: Lang): Words => (lang === 'ko' ? WORDS.ko : (WORDS.en as unknown as Words))

/** The first-run guide's lead line on its connect page: the API key first, a subscription below */
export function apiConnectLead(lang: Lang): string {
  return lang === 'ko'
    ? '가지고 있는 Claude·GPT·Solar API 키를 넣으면 바로 씁니다. 키는 이 PC에만 저장되고, 쓴 만큼 각 회사에 요금이 나갑니다. Claude·ChatGPT 구독이 있으면 아래에서 연결해도 됩니다.'
    : 'Paste a Claude, GPT or Solar API key to start. The key stays on this PC, and each company bills you for what you use. With a Claude or ChatGPT subscription, connect it below instead.'
}

function KeyMark() {
  return (
    <svg className="cheil-api-mark" width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <circle cx="6" cy="9" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M9.25 9h6.25M13 9v2.5M15.5 9v1.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ApiKeyCards({
  lang,
  compact = false,
}: {
  lang: Lang
  /** the first-run guide: no description line, one row per AI */
  compact?: boolean
}) {
  const w = words(lang)
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () => {
      void readAiSettings().then((next) => {
        if (alive && next) setSettings(next)
      })
    }
    load()
    // the composer chip, the "AI to use" row and the key panes write the same file
    const off = window.aiOffice?.onAiSettingsChanged?.(load)
    return () => {
      alive = false
      off?.()
    }
  }, [])

  const change = (apply: (current: AiSettings) => AiSettings) => {
    setFailed(false)
    void changeAiSettings(apply).then((next) => {
      if (next) setSettings(next)
      else setFailed(true)
    })
  }

  if (!settings) return null

  return (
    <section
      className={`cheil-api-keys${compact ? ' is-compact' : ''}`}
      aria-label={w.title}
      data-testid="cheil-api-keys"
    >
      {compact ? null : (
        <>
          <h4 className="set-pane-subtitle set-sub-title">{w.title}</h4>
          <div className="set-field-desc set-ai-note">{w.desc}</div>
        </>
      )}
      <div className="cheil-api-cards">
        {CHEIL_API_CHOICES.map((choice) => (
          <ApiKeyCard
            key={choice.id}
            w={w}
            choice={choice}
            settings={settings}
            compact={compact}
            onChange={change}
          />
        ))}
      </div>
      {failed ? (
        <p className="cheil-api-failed" role="alert">
          {w.failed}
        </p>
      ) : null}
    </section>
  )
}

function ApiKeyCard({
  w,
  choice,
  settings,
  compact,
  onChange,
}: {
  w: Words
  choice: CheilApiChoice
  settings: AiSettings
  compact: boolean
  onChange: (apply: (current: AiSettings) => AiSettings) => void
}) {
  const state = apiKeyState(settings, choice.id)
  const { models } = apiModels(choice.id)
  const stored = apiModelOf(settings, choice.id)
  const [draft, setDraft] = useState('')
  const [model, setModel] = useState(stored)
  useEffect(() => setModel(stored), [stored])
  const key = apiKeyOf(settings, choice.id)
  const modelOptions = (models.includes(model) ? models : [model, ...models]).map((m) => ({
    value: m,
    label: m,
  }))

  return (
    <div className={`cheil-api-card is-${state}`} data-provider={choice.id}>
      <div className="cheil-api-head">
        <KeyMark />
        <span className="cheil-api-name">{choice.name}</span>
        <span className="cheil-api-vendor">{choice.vendor} API</span>
        {state !== 'empty' ? (
          <span className={`cheil-api-badge is-${state}`}>
            {state === 'in-use' ? w.inUse : w.saved}
          </span>
        ) : null}
      </div>
      <div className="cheil-api-body">
        {state === 'empty' ? (
          <input
            className="set-input cheil-api-input"
            type="password"
            value={draft}
            placeholder={
              compact
                ? w.keyLabel(choice.name)
                : `${w.keyLabel(choice.name)} · ${w.keyFrom(choice.console)}`
            }
            aria-label={w.keyLabel(choice.name)}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                onChange((current) => withApiKey(current, choice.id, draft, model))
                setDraft('')
              }
            }}
          />
        ) : (
          <span className="cheil-api-saved" title={w.keyLabel(choice.name)}>
            {maskedKey(key)}
          </span>
        )}
        {compact ? null : (
          <Dropdown
            className="set-dd cheil-api-model"
            value={model}
            ariaLabel={`${choice.name} ${w.model}`}
            options={modelOptions}
            onPick={(next) => {
              setModel(next)
              if (state !== 'empty') onChange((current) => withApiModel(current, choice.id, next))
            }}
          />
        )}
        <div className="set-btn-row cheil-api-actions">
          {state === 'empty' ? (
            <button
              className="set-btn primary"
              disabled={!draft.trim()}
              data-testid={`cheil-api-save-${choice.id}`}
              onClick={() => {
                onChange((current) => withApiKey(current, choice.id, draft, model))
                setDraft('')
              }}
            >
              {w.save}
            </button>
          ) : (
            <>
              {state === 'saved' ? (
                <button
                  className="set-btn primary"
                  onClick={() => onChange((current) => withApiInUse(current, choice.id))}
                >
                  {w.use}
                </button>
              ) : null}
              <button
                className="set-btn"
                data-testid={`cheil-api-remove-${choice.id}`}
                onClick={() => onChange((current) => withoutApiKey(current, choice.id))}
              >
                {w.remove}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
