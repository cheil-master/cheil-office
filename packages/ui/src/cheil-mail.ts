/**
 * Cheil fork (plan item 3): to-dos and due days read out of a received mail.
 *
 * The person pastes a mail into a campaign; one model call (the shared
 * `ai:chat`, so the confidentiality line applies) answers one JSON object of
 * tasks; the app checks every field and the person confirms the list before
 * anything is recorded. Pure functions only.
 */

export interface CheilMailTask {
  task: string
  /** who does it, when the mail says; else empty */
  owner: string
  /** YYYY-MM-DD, or empty when the mail gives no day the model could be sure of */
  due: string
}

/** longest mail sent, most tasks kept, longest task and owner */
const MAIL_MAX = 12_000
const TASKS_MAX = 20
const TASK_MAX = 300
const OWNER_MAX = 60

export function buildCheilTaskPrompt(input: {
  mail: string
  /** YYYY-MM-DD: the day relative dates ("다음 주 화요일") are read from */
  today: string
  campaign: string
  client: string
}): { system: string; user: string } {
  const system = [
    '너는 광고대행사 기획 AE 가 받은 메일에서 할 일과 마감을 뽑는 도우미다.',
    '규칙:',
    '1. 메일에 적힌 요청·약속·일정만 뽑는다. 메일에 없는 일을 지어내지 않는다.',
    '2. task 는 무엇을 하는지 한 줄(40자 안팎, "~하기" 또는 명사형).',
    '3. owner 는 메일에 담당(이름·팀·회사)이 적혀 있을 때만. 없으면 빈 문자열.',
    '4. due 는 메일에 날짜가 있을 때만 YYYY-MM-DD. 연도가 없거나 "다음 주 화요일"처럼 상대 날짜면 오늘을 기준으로 바꾼다. 확실하지 않으면 빈 문자열.',
    '5. 출력은 JSON 객체 하나: {"tasks": [{"task": "...", "owner": "...", "due": "..."}]}. 할 일이 없으면 {"tasks": []}. 다른 말을 붙이지 않는다.',
  ].join('\n')
  const user = [
    `오늘: ${input.today}`,
    `캠페인: ${input.campaign}${input.client ? ` (광고주 ${input.client})` : ''}`,
    '',
    '받은 메일:',
    input.mail.trim().slice(0, MAIL_MAX),
  ].join('\n')
  return { system, user }
}

function isRealDay(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

const oneLine = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')

/** The tasks in the model's answer, each checked; anything unusable is left out */
export function parseCheilTasks(content: string): CheilMailTask[] {
  const start = content.search(/[[{]/)
  const end = Math.max(content.lastIndexOf('}'), content.lastIndexOf(']'))
  if (start < 0 || end <= start) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(content.slice(start, end + 1))
  } catch {
    return []
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { tasks?: unknown }).tasks)
      ? (parsed as { tasks: unknown[] }).tasks
      : []
  const tasks: CheilMailTask[] = []
  const seen = new Set<string>()
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const task = oneLine(r.task).slice(0, TASK_MAX)
    if (!task || seen.has(task)) continue
    seen.add(task)
    const due = oneLine(r.due)
    tasks.push({
      task,
      owner: oneLine(r.owner).slice(0, OWNER_MAX),
      due: isRealDay(due) ? due : '',
    })
    if (tasks.length >= TASKS_MAX) break
  }
  return tasks
}
