/**
 * Cheil fork: the home's row of advertising-agency templates.
 *
 * Each card opens its builtin template skill's copy as a new untitled
 * document (the same path as calling the skill with `/` in an AI panel) and
 * hands the new tab's AI panel a starter request with the skill's chip. The
 * hand-off is marked `prefill`: the panel only fills its composer, so nothing
 * runs until the person attaches their material and presses send.
 *
 * The words are Korean, with English for every other UI language: this row
 * exists for one company's staff, and its titles match the skills' own
 * `ieum-title`, which are Korean too.
 */
import { useState } from 'react'
import type { ReactElement } from 'react'
import type { Lang } from '@genoffice/i18n'
import { useI18n } from '../locale'
import { AGENCY_TEMPLATES as TEMPLATES, type AgencyTemplate } from './templates'

const SECTION = {
  ko: {
    label: '광고 문서 양식',
    failed: '양식을 열지 못했습니다. 설정 → 스킬에서 켜져 있는지 확인하세요.',
  },
  en: {
    label: 'Agency templates',
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
  const [failed, setFailed] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)
  const api = bridge()
  if (!api) return null

  const open = async (tpl: AgencyTemplate) => {
    if (opening) return
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

  return (
    <section className="quick-start cheil-templates" aria-label={SECTION[w].label}>
      <div className="section-head">
        <span className="section-label">{SECTION[w].label}</span>
      </div>
      <div className="quick-cards">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.skill}
            className="quick-card"
            data-testid={`cheil-template-${tpl.skill}`}
            aria-busy={opening === tpl.skill}
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
      </div>
      {failed ? (
        <p className="cheil-templates-failed" role="status">
          {SECTION[w].failed}
        </p>
      ) : null}
    </section>
  )
}
