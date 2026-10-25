/**
 * Cheil fork (plan items 6 and 7): a mail draft from a campaign.
 *
 * The person picks a situation (send, reply, request, schedule, revision,
 * issue), who reads it (the client or the team) and how firm it is (soft,
 * normal, firm). The app gives the model the situation, the tone and the
 * names of the facts it may use, `{총예산}` and the like, never their values;
 * every number and date in the recent history and in the person's own points
 * goes as `{값1}`, `{값2}`, …. One call answers a subject and a body; the app
 * puts the values back. So amounts, rates and dates never leave this PC, a
 * change of tone never changes a fact, and a name the model makes up shows as
 * `[확인 필요]`. Pure functions only.
 */

export type CheilMailSituation = 'send' | 'reply' | 'request' | 'schedule' | 'revision' | 'issue'
export type CheilMailAudience = 'client' | 'internal'
export type CheilMailStrength = 'soft' | 'normal' | 'firm'

export const CHEIL_MAIL_SITUATIONS: readonly CheilMailSituation[] = [
  'send',
  'reply',
  'request',
  'schedule',
  'revision',
  'issue',
]
export const CHEIL_MAIL_AUDIENCES: readonly CheilMailAudience[] = ['client', 'internal']
export const CHEIL_MAIL_STRENGTHS: readonly CheilMailStrength[] = ['soft', 'normal', 'firm']

/** What each situation is for and how its body runs (the model's brief) */
const SITUATION_BRIEF: Record<CheilMailSituation, { name: string; brief: string }> = {
  send: {
    name: '자료 송부',
    brief:
      '만든 자료를 보내는 메일. 무엇을 보내는지(첨부 문서 이름), 핵심 내용 두세 줄, 상대가 할 일(검토·회신)과 회신 날짜, 다음 일정 순서.',
  },
  reply: {
    name: '회신',
    brief:
      '받은 질문·요청에 답하는 메일. 무엇에 대한 답인지 먼저, 답, 남은 확인 사항, 다음 일정 순서.',
  },
  request: {
    name: '자료·확인 요청',
    brief:
      '상대에게 자료나 확인을 부탁하는 메일. 무엇이 왜 필요한지, 정확히 무엇을 언제까지 받아야 하는지, 받으면 무엇을 하는지 순서.',
  },
  schedule: {
    name: '일정 조율·리마인드',
    brief:
      '일정을 맞추거나 다가온 마감을 알리는 메일. 어떤 일정인지, 날짜, 상대가 할 일, 바뀌면 생기는 일 순서.',
  },
  revision: {
    name: '수정 반영 회신',
    brief:
      '요청받은 수정을 반영했다고 알리는 메일. 무엇을 고쳤는지 항목별로, 고치지 못한 것과 이유, 다시 볼 곳, 다음 일정 순서.',
  },
  issue: {
    name: '이슈 대응',
    brief:
      '문제가 생겼을 때 알리는 메일. 무슨 일이 있었는지 사실만, 영향, 대응과 일정, 재발 방지 순서. 변명하지 않는다.',
  },
}

const AUDIENCE_BRIEF: Record<CheilMailAudience, { name: string; brief: string }> = {
  client: {
    name: '광고주',
    brief:
      '광고주에게 보낸다. 합니다체, 문단으로. 인사 한 줄로 시작하고 끝에 감사 인사와 서명 자리({작성자} {팀명})를 둔다.',
  },
  internal: {
    name: '내부',
    brief:
      '같은 회사 동료에게 보낸다. 개조식(줄머리 "- "), 짧게. 인사는 한 줄, 요청·담당·마감을 분명히 적는다. 서명은 {작성자}만.',
  },
}

const STRENGTH_BRIEF: Record<CheilMailStrength, { name: string; brief: string }> = {
  soft: {
    name: '부드럽게',
    brief:
      '정중하고 완곡하게. 부탁과 양해의 말("가능하시다면", "번거로우시겠지만")을 쓰고, 날짜는 희망으로 적는다.',
  },
  normal: {
    name: '보통',
    brief: '보통의 업무 메일. 용건을 먼저 적고, 날짜와 요청을 분명히 적는다.',
  },
  firm: {
    name: '단호하게',
    brief:
      '분명하고 단호하게. 마감과 지켜지지 않을 때의 영향을 적고, 회신을 받을 날짜를 못 박는다. 완곡한 말과 사과를 줄인다. 무례한 말은 쓰지 않는다.',
  },
}

export function cheilMailSituationName(s: CheilMailSituation): string {
  return SITUATION_BRIEF[s].name
}
export function cheilMailAudienceName(a: CheilMailAudience): string {
  return AUDIENCE_BRIEF[a].name
}
export function cheilMailStrengthName(s: CheilMailStrength): string {
  return STRENGTH_BRIEF[s].name
}

/**
 * The situation the last thing in the timeline suggests (plan item 7): a fill
 * or a document → send, a to-do → schedule, a card change → revision.
 */
export function suggestCheilMailSituation(lastKind: string | undefined): CheilMailSituation {
  if (lastKind === 'task') return 'schedule'
  if (lastKind === 'card' || lastKind === 'revise') return 'revision'
  if (lastKind === 'mail') return 'reply'
  return 'send'
}

/** A number with what follows it: amounts, rates, counts, dates ("500,000,000원", "30%", "2027-03-01") */
const VALUE_RE =
  /(?:₩|\$)?\d[\d,.]*(?:[-~/]\d[\d,.]*)*\s?(?:조|억|천만|백만|만|천)?\s?(?:원|달러|%p|%|퍼센트|포인트|개월|개|건|명|회|세트|박스|년|월|일|시|분|주)?/g

/** Each number and date in `text` becomes `{값N}`; the same value keeps its name */
export function maskCheilValues(text: string, values: Map<string, string>): string {
  return text.replace(VALUE_RE, (found) => {
    // a sentence's full stop or comma after the number stays in the sentence
    const tail = /[\s.,]*$/.exec(found)![0]
    const value = found.slice(0, found.length - tail.length)
    if (!value) return found
    let name = [...values].find(([n, v]) => v === value && n.startsWith('값'))?.[0]
    if (!name) {
      name = `값${[...values.keys()].filter((k) => k.startsWith('값')).length + 1}`
      values.set(name, value)
    }
    return `{${name}}${tail}`
  })
}

export interface CheilMailFact {
  /** the token name the model writes inside braces */
  name: string
  /** what it is, for the model */
  label: string
  /** the value the app puts back; never sent */
  value: string
}

/** most history lines and the longest points the model gets */
const HISTORY_MAX = 8
const POINTS_MAX = 2_000

export function buildCheilMailPrompt(input: {
  situation: CheilMailSituation
  audience: CheilMailAudience
  strength: CheilMailStrength
  /** the card's facts and the like; only names and labels go to the model */
  facts: CheilMailFact[]
  /** recent timeline lines, newest last */
  history: string[]
  /** what the person wants said, in their words */
  points: string
}): { system: string; user: string; values: Map<string, string> } {
  const situation = SITUATION_BRIEF[input.situation]
  const audience = AUDIENCE_BRIEF[input.audience]
  const strength = STRENGTH_BRIEF[input.strength]
  const system = [
    '너는 광고대행사 기획 AE 의 업무 메일 초안을 쓰는 도우미다.',
    `상황: ${situation.name}. ${situation.brief}`,
    `받는 사람: ${audience.name}. ${audience.brief}`,
    `강도: ${strength.name}. ${strength.brief}`,
    '규칙:',
    '1. 사실(이름, 날짜, 금액, 수치, 문서 이름)은 직접 쓰지 말고 주어진 자리표시만 중괄호 그대로 쓴다. 예: {캠페인명}, {총예산}, {값2}.',
    '2. 주어진 자리표시에 없는 사실을 지어내지 않는다. 필요한데 없으면 [확인 필요]라고 쓴다.',
    '3. 같은 자리표시를 여러 번 써도 된다. 쓰지 않아도 된다.',
    '4. 출력은 JSON 객체 하나: {"subject": "제목", "body": "본문"}. 본문의 줄바꿈은 \\n. 다른 말을 붙이지 않는다.',
  ].join('\n')
  const values = new Map<string, string>()
  for (const fact of input.facts) if (fact.value.trim()) values.set(fact.name, fact.value.trim())
  const factLines = input.facts
    .filter((f) => f.value.trim())
    .map((f) => `- {${f.name}}: ${f.label}`)
  const history = input.history
    .slice(-HISTORY_MAX)
    .map((line) => `- ${maskCheilValues(line.replace(/\s+/g, ' ').trim(), values)}`)
  const points = maskCheilValues(input.points.trim().slice(0, POINTS_MAX), values)
  const valueLines = [...values.keys()]
    .filter((name) => name.startsWith('값'))
    .map((name) => `- {${name}}: 숫자·날짜 (아래 글에 나온 그대로)`)
  const user = [
    '쓸 수 있는 자리표시:',
    ...(factLines.length ? factLines : ['- (없음)']),
    ...valueLines,
    '',
    '최근 이력(오래된 것부터):',
    ...(history.length ? history : ['- (없음)']),
    '',
    '이번 메일에 꼭 넣을 말:',
    points || '(따로 없음)',
  ].join('\n')
  return { system, user, values }
}

export interface CheilMailDraft {
  subject: string
  body: string
  /** the draft's places the app could not fill: shown as [확인 필요] */
  unknown: number
}

const SUBJECT_MAX = 200
const BODY_MAX = 8_000
const TOKEN_RE = /\{\s*([^{}\n]{1,24}?)\s*\}/g
const squash = (s: string) => s.replace(/\s+/g, '')

/** The model's answer with the values put back; null when it is not a draft */
export function parseCheilMailDraft(
  content: string,
  values: Map<string, string>,
): CheilMailDraft | null {
  const start = content.indexOf('{"') >= 0 ? content.indexOf('{"') : content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(content.slice(start, end + 1))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const { subject, body } = parsed as Record<string, unknown>
  if (typeof body !== 'string' || !body.trim()) return null
  const byName = new Map([...values].map(([name, value]) => [squash(name), value]))
  let unknown = 0
  const fill = (text: string) =>
    text.replace(TOKEN_RE, (_whole, name: string) => {
      const value = byName.get(squash(name))
      if (value !== undefined) return value
      unknown++
      return '[확인 필요]'
    })
  const filledBody = fill(body.replace(/\r\n?/g, '\n').trim()).slice(0, BODY_MAX)
  const filledSubject = fill(typeof subject === 'string' ? subject.replace(/\s+/g, ' ').trim() : '')
  return { subject: filledSubject.slice(0, SUBJECT_MAX), body: filledBody, unknown }
}
