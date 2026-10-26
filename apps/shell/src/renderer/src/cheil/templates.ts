/**
 * Cheil fork: the agency templates, as the home's template row and a
 * campaign's document set show them. Each is a builtin template skill
 * (apps/shell/resources/builtin-skills/<skill>) with the request its new tab
 * waits with. Titles match the skills' own `ieum-title`.
 */

export interface AgencyTemplate {
  /** builtin skill name (apps/shell/resources/builtin-skills/<name>) */
  skill: string
  ext: 'pptx' | 'docx' | 'xlsx'
  ko: { title: string; sub: string; request: string }
  en: { title: string; sub: string; request: string }
}

export const AGENCY_TEMPLATES: readonly AgencyTemplate[] = [
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
      title: '결과보고서',
      sub: '매체 리포트·실적 → 12장',
      request: '첨부한 매체 리포트와 실적 자료로 이 결과보고서를 채워 줘.',
    },
    en: {
      title: 'Campaign result report',
      sub: 'Media reports and results → 12 slides',
      request: 'Fill this result report from the attached media reports and results.',
    },
  },
  {
    // Cheil fork (10-26): the brief became the campaign OT deck, after the agency's kickoff decks
    skill: 'cheil-brief',
    ext: 'pptx',
    ko: {
      title: '캠페인 OT',
      sub: '광고주 OT·브리프 → 14장',
      request: '첨부한 광고주 OT·브리프 자료와 회의 메모로 이 캠페인 OT 를 채워 줘.',
    },
    en: {
      title: 'Campaign OT',
      sub: 'Client orientation and brief → 14 slides',
      request: 'Fill this campaign OT from the attached client orientation, brief and notes.',
    },
  },
  {
    skill: 'cheil-media-plan',
    ext: 'xlsx',
    ko: {
      title: '미디어 플랜',
      sub: '미디어 브리프·견적 → 매체 믹스·예산',
      request: '첨부한 미디어 브리프와 매체 견적으로 이 미디어 플랜을 채워 줘.',
    },
    en: {
      title: 'Media plan',
      sub: 'Media brief and quotes → mix and budget',
      request: 'Fill this media plan from the attached media brief and quotes.',
    },
  },
  {
    skill: 'cheil-meeting-notes',
    ext: 'docx',
    ko: {
      title: '컨택 리포트',
      sub: '회의 메모 → 피드백·Next',
      request: '아래 회의 메모로 이 컨택 리포트를 채워 줘.\n',
    },
    en: {
      title: 'Contact report',
      sub: 'Meeting notes → feedback and next steps',
      request: 'Fill this contact report from the meeting notes below.\n',
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

/** the set a campaign opens by default (plan item 4: campaign OT, proposal, media plan) */
export const DEFAULT_SET: ReadonlySet<string> = new Set([
  'cheil-brief',
  'cheil-proposal',
  'cheil-media-plan',
])
