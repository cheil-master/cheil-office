/** Cheil fork: four sample-derived templates, shared by home and campaign sets. */
export interface AgencyTemplate {
  skill: string
  ext: 'pptx' | 'docx' | 'xlsx'
  ko: { title: string; sub: string; request: string }
  en: { title: string; sub: string; request: string }
}
export const AGENCY_TEMPLATES: readonly AgencyTemplate[] = [
  {
    skill: 'cheil-brief',
    ext: 'pptx',
    ko: {
      title: 'OT 및 킥오프',
      sub: '제작 과제·표현 방향·산출물 → 12장',
      request: '첨부한 OT·킥오프 자료와 회의 메모로 이 OT 및 킥오프 양식을 채워 줘.',
    },
    en: {
      title: 'OT and kickoff',
      sub: 'Production task, direction and deliverables → 12 slides',
      request: 'Fill this ot and kickoff template using the supplied material.',
    },
  },
  {
    skill: 'cheil-meeting-notes',
    ext: 'docx',
    ko: {
      title: '컨택리포트',
      sub: '회의 메모 → 피드백·합의·NEXT',
      request: '아래 회의 메모로 이 컨택리포트를 채워 줘.',
    },
    en: {
      title: 'Contact report',
      sub: 'Meeting notes → feedback, decisions and next steps',
      request: 'Fill this contact report template using the supplied material.',
    },
  },
  {
    skill: 'cheil-media-plan',
    ext: 'xlsx',
    ko: {
      title: '미디어브리프',
      sub: '캠페인 과제·집행 조건 → 매체 제안 요청',
      request:
        '첨부한 캠페인 자료로 이 미디어브리프를 채워 줘. 매체 전략을 요청하는 브리프로 정리해 줘.',
    },
    en: {
      title: 'Media brief',
      sub: 'Campaign task and conditions → media planning request',
      request: 'Fill this media brief template using the supplied material.',
    },
  },
  {
    skill: 'cheil-monthly-report',
    ext: 'pptx',
    ko: {
      title: '결과보고서',
      sub: '집행 데이터 → 성과·배운 점·다음 제안 11장',
      request: '첨부한 집행 데이터와 캠페인 자료로 이 결과보고서를 채워 줘.',
    },
    en: {
      title: 'Campaign results',
      sub: 'Campaign data → results and next recommendations, 11 slides',
      request: 'Fill this campaign results template using the supplied material.',
    },
  },
]

/** Cheil fork: start a campaign with the production OT and media request. */
export const DEFAULT_SET: ReadonlySet<string> = new Set(['cheil-brief', 'cheil-media-plan'])
