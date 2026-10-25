/**
 * Cheil fork: fill a template's placeholders with ONE model call.
 *
 * The editors' AI panels normally run the tool loop (model → tool → model),
 * which on a laptop CPU with a small local model took 24 turns and half an
 * hour without changing the document. A Cheil template is a fixed form whose
 * blanks are written `[what goes here]`, so the app does the orchestration:
 *
 * 1. the app lists the blanks (findCheilSlots), each with its surrounding line;
 * 2. the model gets the request, the material and the list, and answers one
 *    JSON object `{ "S1": "...", ... }` (buildCheilFillPrompt);
 * 3. the app reads the answer (parseCheilFillAnswer) and the editor replaces
 *    each blank through its own undoable find-and-replace.
 *
 * Pure functions only; each editor's panel does the reading and writing.
 */

/** builtin skills whose template is filled this way (apps/shell/resources/builtin-skills) */
export const CHEIL_FILL_SKILLS: ReadonlySet<string> = new Set([
  'cheil-proposal',
  'cheil-monthly-report',
  'cheil-brief',
  'cheil-meeting-notes',
  'cheil-pitch-analysis',
  'cheil-media-plan',
])

/** The Cheil template skill a request's chips name, or null */
export function cheilFillSkillOf(chips: ReadonlyArray<{ id: string }>): string | null {
  for (const chip of chips) {
    const m = /^builtin:(cheil-[a-z-]+)$/.exec(chip.id)
    if (m && CHEIL_FILL_SKILLS.has(m[1]!)) return m[1]!
  }
  return null
}

export interface CheilSlot {
  /** S1, S2, ... in document order */
  id: string
  /** the blank exactly as written, brackets included */
  placeholder: string
  /** the line it sits on, and the line before it */
  context: string
}

/** most blanks one call fills */
export const CHEIL_SLOTS_MAX = 80
/** longest blank text taken as a blank (longer bracketed text is content) */
const SLOT_RE = /\[[^[\]\n]{1,80}\]/g
/** markers the house rules write into a filled document; never blanks to fill */
const MARKER_RE = /^\[\s*(확인 필요|출처 확인 필요|목표 확인 필요)/

/** The document's blanks, each once, in order */
export function findCheilSlots(text: string): CheilSlot[] {
  const lines = text.split('\n')
  const seen = new Set<string>()
  const slots: CheilSlot[] = []
  let previous = ''
  for (const raw of lines) {
    const line = raw.trim()
    SLOT_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = SLOT_RE.exec(line)) !== null) {
      const placeholder = m[0]
      if (!placeholder.slice(1, -1).trim() || MARKER_RE.test(placeholder)) continue
      if (seen.has(placeholder)) continue
      seen.add(placeholder)
      const context = [previous, line].filter(Boolean).join(' / ').slice(0, 160)
      slots.push({ id: `S${slots.length + 1}`, placeholder, context })
      if (slots.length >= CHEIL_SLOTS_MAX) return slots
    }
    if (line) previous = line
  }
  return slots
}

/** longest material and skill text sent (characters) */
const MATERIAL_MAX = 24_000
const SKILL_TEXT_MAX = 4_000

export function buildCheilFillPrompt(input: {
  request: string
  skillText: string
  materials: string
  slots: readonly CheilSlot[]
}): { system: string; user: string } {
  const system = [
    '너는 광고대행사 기획 문서 양식의 빈칸을 채우는 도우미다.',
    '규칙:',
    '1. 요청 글과 자료에 있는 사실만 쓴다. 숫자·날짜·이름·출처를 지어내지 않는다.',
    '2. 자료로 채울 수 없는 칸의 값은 정확히 "[확인 필요]"로 둔다.',
    '3. 값은 칸 설명이 말하는 분량으로 쓴다. 장표·개조식 칸은 명사형으로 끝낸다. 줄바꿈 없이 한 줄.',
    '4. 출력은 JSON 객체 하나뿐이다. 키는 칸 번호(S1, S2, ...), 값은 채울 글. 다른 말을 붙이지 않는다.',
    '',
    '작업 설명서:',
    input.skillText.trim().slice(0, SKILL_TEXT_MAX),
  ].join('\n')
  // no meaning is added to the common blanks: on gemma4:e4b (2026-10-25, the
  // proposal, 2 seeds each) a "(뜻: ...)" after them left the message and
  // concept blanks open in every run, and did not keep client and brand apart
  const slotLines = input.slots.map((s) => `${s.id}: ${s.placeholder} — 문맥: ${s.context}`)
  const user = [
    '요청:',
    input.request.trim(),
    '',
    '자료:',
    input.materials.trim().slice(0, MATERIAL_MAX) || '(첨부 없음. 요청 글에 있는 내용이 자료다)',
    '',
    `채울 칸 ${input.slots.length}개 (번호: 자리 — 문맥):`,
    ...slotLines,
    '',
    `위 ${input.slots.length}개 칸 번호를 모두 키로 가진 JSON 객체 하나로만 답하라.`,
  ].join('\n')
  return { system, user }
}

/** longest value written into one blank */
const VALUE_MAX = 400

function valueText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(', ')
  return ''
}

/** The model's values by slot id; anything not usable is left out */
export function parseCheilFillAnswer(
  content: string,
  slots: readonly CheilSlot[],
): Map<string, string> {
  const values = new Map<string, string>()
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start < 0 || end <= start) return values
  let parsed: unknown
  try {
    parsed = JSON.parse(content.slice(start, end + 1))
  } catch {
    return values
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return values
  const record = parsed as Record<string, unknown>
  for (const slot of slots) {
    const text = valueText(record[slot.id])
      .replace(/\s*\n\s*/g, ' ')
      .trim()
      .slice(0, VALUE_MAX)
    if (!text || text === slot.placeholder) continue
    values.set(slot.id, text)
  }
  return values
}

export interface CheilFillPlan {
  replacements: Array<{ find: string; replace: string }>
  /** blanks written from the material */
  fromMaterial: number
  /** blanks left for a person (the model's "[확인 필요]", or no value) */
  open: string[]
}

export function cheilFillPlan(
  slots: readonly CheilSlot[],
  values: ReadonlyMap<string, string>,
): CheilFillPlan {
  const replacements: CheilFillPlan['replacements'] = []
  const open: string[] = []
  let fromMaterial = 0
  for (const slot of slots) {
    const value = values.get(slot.id)
    if (!value) {
      open.push(slot.placeholder)
      continue
    }
    if (MARKER_RE.test(value)) open.push(slot.placeholder)
    else fromMaterial++
    replacements.push({ find: slot.placeholder, replace: value })
  }
  return { replacements, fromMaterial, open }
}

/** The panel's reply after a fill */
export function cheilFillSummary(
  lang: string,
  input: { total: number; fromMaterial: number; open: readonly string[] },
): string {
  const ko = lang === 'ko'
  const head = ko
    ? `양식 칸 ${input.total}개 중 ${input.fromMaterial}개를 자료로 채웠습니다.`
    : `Filled ${input.fromMaterial} of the template's ${input.total} blanks from the material.`
  if (input.open.length === 0) return head
  const list = input.open.slice(0, 10).join(', ')
  const more =
    input.open.length > 10
      ? ko
        ? ` 외 ${input.open.length - 10}개`
        : ` and ${input.open.length - 10} more`
      : ''
  return ko
    ? `${head}\n자료에 없어 [확인 필요]로 둔 칸 ${input.open.length}개: ${list}${more}`
    : `${head}\nLeft for you (not in the material), ${input.open.length}: ${list}${more}`
}
