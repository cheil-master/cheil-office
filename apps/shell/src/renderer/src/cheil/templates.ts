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

/** the set a campaign opens by default (plan item 4: brief, proposal, media plan) */
export const DEFAULT_SET: ReadonlySet<string> = new Set([
  'cheil-brief',
  'cheil-proposal',
  'cheil-media-plan',
])
