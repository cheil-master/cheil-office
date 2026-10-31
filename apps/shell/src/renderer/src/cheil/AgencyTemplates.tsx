/**
 * Cheil fork: the home's catalog of work document templates.
 *
 * Each card opens its builtin template skill's copy as a new untitled
 * document (the same path as calling the skill with `/` in an AI panel) and
 * hands the new tab's AI panel a starter request with the skill's chip. The
 * hand-off is marked `prefill`: the panel only fills its composer, so nothing
 * runs until the person attaches their material and presses send.
 *
 * Built-in skill titles retain their existing Korean/English wording.
 * The catalog controls and imported-template flow cover all UI languages.
 */
import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { Lang } from '@genoffice/i18n'
import { useI18n } from '../locale'
import { AGENCY_TEMPLATES as TEMPLATES, type AgencyTemplate } from './templates'
// Cheil fork: imported work templates share the home catalog with built-in ones.
import type { MyTemplate } from '../../../shared/cheil-campaign-api'
import {
  WORK_TEMPLATE_BRIDGE,
  type WorkTemplateApi,
  type WorkTemplateFailure,
} from '../../../shared/cheil-work-template-api'
import { workTemplateWords } from './work-template-words'
import { OptionsDialog } from './OptionsDialog'

const SECTION = {
  ko: {
    failed: '양식을 열지 못했습니다. 설정 → 스킬에서 켜져 있는지 확인하세요.',
  },
  en: {
    failed: 'The template did not open. Check that its skill is on in Settings → Skills.',
  },
}

interface OpenTemplateBridge {
  openTemplate(input: {
    skillId: string
    text: string
    chips: Array<{ id: string; source: string; title: string }>
    prefill: boolean
  }): Promise<{ ok: boolean }>
}

function bridge(): OpenTemplateBridge | undefined {
  return (window as unknown as { aiOfficeUserSkills?: OpenTemplateBridge }).aiOfficeUserSkills
}

const words = (lang: Lang) => (lang === 'ko' ? 'ko' : 'en')

export function AgencyTemplates({
  badge,
}: {
  /** the home's file badge for an extension */
  badge: (ext: string) => ReactElement
}) {
  const { lang } = useI18n()
  const w = words(lang)
  const copy = workTemplateWords(lang)
  const [failed, setFailed] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)
  const [custom, setCustom] = useState<MyTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<WorkTemplateFailure | null>(null)
  const [notice, setNotice] = useState<'added' | 'renamed' | 'deleted' | null>(null)
  // Cheil fork: management acts on the stored copy and the version displayed on its card.
  const [manage, setManage] = useState<{
    action: 'rename' | 'delete'
    template: MyTemplate
  } | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [managing, setManaging] = useState(false)
  const [manageError, setManageError] = useState<WorkTemplateFailure | null>(null)
  const busy = adding || !!opening || managing
  const api = bridge()
  const customApi = (window as unknown as Record<string, WorkTemplateApi | undefined>)[
    WORK_TEMPLATE_BRIDGE
  ]

  const refresh = useCallback(async () => {
    if (!customApi) {
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await customApi.request({ action: 'list' }).catch(() => null)
    setLoadFailed(!result?.ok)
    if (result?.ok) setCustom(result.templates)
    setLoading(false)
  }, [customApi])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!api) return null

  const add = async () => {
    if (!customApi || busy) return
    setAdding(true)
    setError(null)
    setNotice(null)
    const result = await customApi.request({ action: 'add' }).catch(() => null)
    setAdding(false)
    if (result?.ok) {
      setCustom(result.templates)
      setLoadFailed(false)
      setNotice('added')
    } else if (result?.reason !== 'canceled') setError(result?.reason ?? 'failed')
  }

  const use = async (template: MyTemplate) => {
    if (!customApi || busy) return
    setOpening(template.name)
    setError(null)
    setNotice(null)
    const result = await customApi.request({ action: 'use', name: template.name }).catch(() => null)
    setOpening(null)
    if (!result?.ok) setError(result?.reason ?? 'failed')
  }

  const open = async (tpl: AgencyTemplate) => {
    if (busy) return
    setOpening(tpl.skill)
    setFailed(false)
    const id = `builtin:${tpl.skill}`
    const res = await api
      .openTemplate({
        skillId: id,
        text: tpl[w].request,
        chips: [{ id, source: 'builtin', title: tpl.ko.title }],
        prefill: true,
      })
      .catch(() => ({ ok: false }))
    setOpening(null)
    if (!res?.ok) setFailed(true)
  }

  const startManage = (action: 'rename' | 'delete', template: MyTemplate) => {
    setManage({ action, template })
    setNewTitle(template.title)
    setManageError(null)
    setError(null)
    setNotice(null)
  }

  const saveManage = async () => {
    if (!customApi || !manage || busy) return
    setManaging(true)
    setManageError(null)
    const { action, template } = manage
    const result = await customApi
      .request(
        action === 'rename'
          ? { action, name: template.name, title: newTitle, updatedAt: template.updatedAt }
          : { action, name: template.name, updatedAt: template.updatedAt },
      )
      .catch(() => null)
    setManaging(false)
    if (result?.ok) {
      setCustom(result.templates)
      setManage(null)
      setNotice(action === 'rename' ? 'renamed' : 'deleted')
    } else {
      setManageError(result?.reason ?? 'failed')
      setError(result?.reason ?? 'failed')
      if (result?.reason === 'changed' || result?.reason === 'not-found') {
        setManage(null)
        void refresh()
      }
    }
  }

  const errorText = (reason: WorkTemplateFailure | null) =>
    reason === 'exists'
      ? copy.exists
      : reason === 'invalid'
        ? copy.invalidName
        : reason === 'changed'
          ? copy.changed
          : reason === 'too-large'
            ? copy.tooLarge
            : reason === 'unreadable'
              ? copy.unreadable
              : copy.failed

  return (
    <section className="quick-start cheil-templates" aria-label={copy.label}>
      <div className="section-head">
        <span className="section-label">{copy.label}</span>
        {customApi && (
          <button
            className="cheil-campaign-add"
            data-testid="cheil-work-template-add"
            disabled={loading || busy}
            onClick={() => void add()}
          >
            {adding ? copy.adding : `+ ${copy.add}`}
          </button>
        )}
      </div>
      {customApi && <p className="cheil-work-template-hint">{copy.hint}</p>}
      <div className="quick-cards">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.skill}
            className="quick-card"
            data-testid={`cheil-template-${tpl.skill}`}
            aria-busy={opening === tpl.skill}
            disabled={busy}
            onClick={() => void open(tpl)}
          >
            {badge(tpl.ext)}
            <span className="quick-text">
              <span className="quick-title-row">
                <span className="quick-title">{tpl[w].title}</span>
                <span className="ai-chip">AI</span>
              </span>
              <span className="quick-sub">{tpl[w].sub}</span>
            </span>
          </button>
        ))}
        {custom.map((template) => (
          <div
            className="cheil-work-template-item"
            key={template.name}
            data-testid="cheil-work-template-item"
          >
            <button
              className="quick-card cheil-work-template-card"
              data-testid="cheil-work-template-card"
              title={`${template.title} · ${copy.use}`}
              aria-busy={opening === template.name}
              disabled={busy}
              onClick={() => void use(template)}
            >
              {badge(template.name.split('.').pop() ?? '')}
              <span className="quick-text">
                <span className="quick-title-row">
                  <span className="quick-title">{template.title}</span>
                  <span className="cheil-work-template-owned">{copy.own}</span>
                </span>
                <span className="quick-sub">
                  {template.name.split('.').pop()?.toUpperCase()} · {copy.use}
                </span>
              </span>
            </button>
            <div className="cheil-work-template-actions">
              <button
                type="button"
                data-testid="cheil-work-template-rename"
                aria-label={`${template.title} · ${copy.rename}`}
                disabled={busy}
                onClick={() => startManage('rename', template)}
              >
                {copy.rename}
              </button>
              <button
                type="button"
                data-testid="cheil-work-template-delete"
                aria-label={`${template.title} · ${copy.remove}`}
                disabled={busy}
                onClick={() => startManage('delete', template)}
              >
                {copy.remove}
              </button>
            </div>
          </div>
        ))}
      </div>
      {loading && customApi && <p role="status">{copy.loading}</p>}
      {loadFailed && (
        <p className="cheil-templates-failed" role="status">
          {copy.failed}{' '}
          <button className="btn btn-secondary" onClick={() => void refresh()}>
            {copy.retry}
          </button>
        </p>
      )}
      {(notice || error) && (
        <p
          className="cheil-work-template-status"
          role="status"
          data-testid="cheil-work-template-status"
        >
          {notice ? copy[notice] : errorText(error)}
        </p>
      )}
      {failed ? (
        <p className="cheil-templates-failed" role="status">
          {SECTION[w].failed}
        </p>
      ) : null}
      {manage && (
        <OptionsDialog
          open
          title={manage.action === 'rename' ? copy.renameTitle : copy.deleteTitle}
          onClose={() => setManage(null)}
        >
          <form
            className="cheil-work-template-form"
            onSubmit={(event) => {
              event.preventDefault()
              void saveManage()
            }}
          >
            <p className="cheil-work-template-filename">{manage.template.name}</p>
            {manage.action === 'rename' ? (
              <>
                <label htmlFor="cheil-work-template-name">{copy.nameLabel}</label>
                <input
                  id="cheil-work-template-name"
                  className="cheil-mail-input"
                  data-testid="cheil-work-template-name"
                  value={newTitle}
                  maxLength={150}
                  required
                  autoFocus
                  disabled={managing}
                  onChange={(event) => {
                    setNewTitle(event.target.value)
                    setManageError(null)
                  }}
                />
                <p className="cheil-work-template-hint">{copy.nameHint}</p>
              </>
            ) : (
              <p>{copy.deleteHint}</p>
            )}
            {manageError && (
              <p role="alert" data-testid="cheil-work-template-manage-error">
                {errorText(manageError)}
              </p>
            )}
            <div className="modal-buttons">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={managing}
                onClick={() => setManage(null)}
              >
                {copy.cancel}
              </button>
              <button
                type="submit"
                className={manage.action === 'delete' ? 'btn btn-danger' : 'btn btn-primary'}
                data-testid="cheil-work-template-confirm"
                disabled={managing || (manage.action === 'rename' && !newTitle.trim())}
              >
                {managing
                  ? copy.working
                  : manage.action === 'rename'
                    ? copy.save
                    : copy.confirmDelete}
              </button>
            </div>
          </form>
        </OptionsDialog>
      )}
    </section>
  )
}
