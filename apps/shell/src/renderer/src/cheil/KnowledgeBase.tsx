/** Cheil fork: own wiki; Obsidian is an optional external viewer. */
import type { Lang } from '@genoffice/i18n'
import type { CheilCampaignApi, KnowledgeHit } from '../../../shared/cheil-campaign-api'
import { WikiPanel } from './WikiPanel'

export function buildKnowledgeSummaryPrompt(
  query: string,
  hits: Array<Pick<KnowledgeHit, 'title' | 'snippet'>>,
): { system: string; user: string } {
  return {
    system: [
      '너는 광고대행사 기획 AE 의 개인 지식 베이스를 정리하는 도우미다.',
      '주어진 노트 발췌에 있는 사실만 쓴다. 발췌에 없는 숫자·날짜·이름은 지어내지 않는다.',
      '질문에 맞게 3~6개 항목으로 짧게 정리하고, 항목마다 끝에 근거 노트를 [[노트 제목]]으로 붙인다.',
      '노트끼리 숫자나 내용이 다르면 그 사실을 한 줄로 알린다.',
    ].join('\n'),
    user: [
      `질문: ${query}`,
      '',
      ...hits.map((hit, i) => `[${i + 1}] ${hit.title}\n${hit.snippet}`),
    ].join('\n'),
  }
}

export function KnowledgeBase({ lang, api }: { lang: Lang; api: CheilCampaignApi }) {
  return (
    <main className="content cheil-tool cheil-kb" data-testid="cheil-tool-knowledge">
      <WikiPanel lang={lang} api={api} />
    </main>
  )
}
