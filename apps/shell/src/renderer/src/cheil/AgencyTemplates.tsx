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

interface AgencyTemplate {
  /** builtin skill name (apps/shell/resources/builtin-skills/<name>) */
  skill: string
  ext: 'pptx' | 'docx' | 'xlsx'
  ko: { title: string; sub: string; request: string }
  en: { title: string; sub: string; request: string }
}

const TEMPLATES: readonly AgencyTemplate[] = [
  {
    skill: 'cheil-proposal',
    ext: 'pptx',
    ko: {
      title: '캠페인 제안서',
      sub: 'RFP·브리프 → 12장',
      request: '첨부한 RFP·브리프로 이 제안서 양식을 채워 줘.',
    },
    en: {
      title: 'Campaign proposal',
      sub: 'RFP and brief → 12 slides',
      request: 'Fill this proposal template from the attached RFP and brief.',
    },
  },
  {
    skill: 'cheil-monthly-report',
    ext: 'pptx',
    ko: {
      title: '월간 성과 보고서',
      sub: '실적표 → 8장',
      request: '첨부한 실적표로 이 보고서 양식을 채워 줘. 보고 월: ',
    },
    en: {
      title: 'Monthly performance report',
      sub: 'Results sheet → 8 slides',
      request: 'Fill this report template from the attached results. Month: ',
    },
  },
  {
    skill: 'cheil-brief',
    ext: 'docx',
    ko: {
      title: '크리에이티브 브리프',
      sub: 'OT 자료 → 제작 지시서',
      request: '첨부한 OT 자료와 회의 메모로 이 브리프를 채워 줘.',
    },
    en: {
      title: 'Creative brief',
      sub: 'Orientation notes → brief',
      request: 'Fill this brief from the attached orientation material and notes.',
    },
  },
  {
    skill: 'cheil-media-plan',
    ext: 'xlsx',
    ko: {
      title: '미디어 플랜',
      sub: '매체 견적 → 예산·CPM·CTR',
      request: '첨부한 매체 견적으로 이 미디어 플랜을 채워 줘.',
    },
    en: {
      title: 'Media plan',
      sub: 'Media quotes → budget, CPM, CTR',
      request: 'Fill this media plan from the attached media quotes.',
    },
  },
  {
    skill: 'cheil-meeting-notes',
    ext: 'docx',
    ko: {
      title: '광고주 회의록',
      sub: '메모 → 결정·할 일',
      request: '아래 회의 메모로 이 회의록을 채워 줘.\n',
    },
    en: {
      title: 'Client meeting notes',
      sub: 'Notes → decisions and actions',
      request: 'Fill these minutes from the meeting notes below.\n',
    },
  },
  {
    skill: 'cheil-pitch-analysis',
    ext: 'docx',
    ko: {
      title: '경쟁 PT 분석',
      sub: 'RFP → 과제·승부처',
      request: '첨부한 RFP로 이 분석 양식을 채워 줘.',
    },
    en: {
      title: 'Pitch analysis',
      sub: 'RFP → task and winning point',
      request: 'Fill this analysis template from the attached RFP.',
    },
  },
]

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
