/**
 * Cheil fork (plan item 13, step ②): a new deck in the shape of the person's
 * own template, as long as its content needs. Each slide of the template is a
 * sample (its look, places and blanks). One model call answers which sample
 * each new slide uses, in order, and what goes into its blanks; the app
 * copies the samples through the deck's own operations (duplicate, move to
 * the end, replace the blanks on that slide only) and then removes the
 * samples. The design stays the template's: the model only picks samples and
 * writes the words. Pure functions only.
 */

export interface CheilDeckSample {
  /** 1-based, as the model sees it */
  number: number
  /** the slide's text, its blanks in brackets */
  text: string
  /** the distinct blanks on it */
  blanks: string[]
}

export interface CheilDeckPlanSlide {
  /** 1-based sample number */
  sample: number
  /** blank → its text */
  fill: Record<string, string>
}

/** most slides a plan makes, the longest material and value taken */
export const CHEIL_DECK_MAX = 30
const MATERIAL_MAX = 24_000
const SKILL_TEXT_MAX = 4_000
const VALUE_MAX = 600

const BLANK_RE = /\[[^[\]\n]{1,40}\]/g

/** The samples of a deck, from each slide's text */
export function cheilDeckSamples(slideTexts: readonly string[]): CheilDeckSample[] {
  return slideTexts.map((text, i) => ({
    number: i + 1,
    text: text.trim(),
    blanks: [...new Set(text.match(BLANK_RE) ?? [])].filter((b) => b !== '[확인 필요]'),
  }))
}

export function buildCheilDeckPrompt(input: {
  request: string
  skillText: string
  materials: string
  samples: readonly CheilDeckSample[]
}): { system: string; user: string } {
  const system = [
    '너는 광고대행사 기획 AE 의 발표 자료를 사람이 만든 양식의 견본 슬라이드로 짜는 도우미다.',
    '견본 슬라이드마다 모양과 [칸]이 정해져 있다. 너는 어떤 견본을 몇 번 쓸지와 각 [칸]에 들어갈 글만 정한다.',
    '규칙:',
    '1. 견본 순서를 지킨다. 내용이 많으면 같은 견본을 이어서 여러 번 쓰고, 자료에 내용이 없는 견본은 건너뛴다. 표지와 맺음 견본은 한 번만.',
    `2. 모두 ${CHEIL_DECK_MAX}장을 넘기지 않는다.`,
    '3. [칸]의 글은 자료에 있는 사실로만, 칸 이름이 묻는 길이로 쓴다. 자료에 없으면 "[확인 필요]". 숫자·날짜·이름을 지어내지 않는다.',
    '4. fill 에는 그 견본에 있는 [칸] 이름만 대괄호까지 그대로 쓴다.',
    '5. 출력은 JSON 객체 하나: {"slides": [{"sample": 견본번호, "fill": {"[칸 이름]": "글"}}]}. 다른 말을 붙이지 않는다.',
  ].join('\n')
  const user = [
    `요청: ${input.request.trim()}`,
    ...(input.skillText.trim()
      ? ['', '양식 안내:', input.skillText.trim().slice(0, SKILL_TEXT_MAX)]
      : []),
    '',
    '견본 슬라이드:',
    ...input.samples.map((s) => `[견본 ${s.number}]\n${s.text}`),
    '',
    '자료:',
    input.materials.trim().slice(0, MATERIAL_MAX) || '(첨부 없음)',
  ].join('\n')
  return { system, user }
}

/** The model's plan, checked against the samples; null when nothing usable came back */
export function parseCheilDeckPlan(
  content: string,
  samples: readonly CheilDeckSample[],
): CheilDeckPlanSlide[] | null {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(content.slice(start, end + 1))
  } catch {
    return null
  }
  const list = (parsed as { slides?: unknown } | null)?.slides
  if (!Array.isArray(list)) return null
  const plan: CheilDeckPlanSlide[] = []
  for (const item of list) {
    if (plan.length >= CHEIL_DECK_MAX) break
    if (!item || typeof item !== 'object') continue
    const { sample, fill } = item as { sample?: unknown; fill?: unknown }
    const found = samples.find((s) => s.number === Number(sample))
    if (!found) continue
    const values: Record<string, string> = {}
    if (fill && typeof fill === 'object') {
      for (const [blank, value] of Object.entries(fill as Record<string, unknown>)) {
        if (!found.blanks.includes(blank) || typeof value !== 'string') continue
        const text = value.replace(/\s+/g, ' ').trim().slice(0, VALUE_MAX)
        if (text) values[blank] = text
      }
    }
    plan.push({ sample: found.number, fill: values })
  }
  return plan.length > 0 ? plan : null
}

export type CheilDeckOp =
  | { op: 'duplicateSlide'; target: { slide: number } }
  | { op: 'moveSlide'; target: { slide: number }; to: number }
  | { op: 'findReplace'; find: string; replace: string; slideIndex: number }
  | { op: 'deleteSlide'; target: { slide: number } }

/**
 * The deck operations for a plan over a deck of `sampleCount` samples, as
 * transactions in order: each new slide is a copy of its sample moved to the
 * end (so the samples keep their places), its blanks replaced on that slide
 * only; then the samples go. Indexes are 0-based. A transaction checks its
 * operations against the deck as it was before it, so the copy is made in one
 * and moved in the next (the copy of the last sample does not exist before).
 */
export function cheilDeckOps(
  plan: readonly CheilDeckPlanSlide[],
  sampleCount: number,
): CheilDeckOp[][] {
  const batches: CheilDeckOp[][] = []
  plan.forEach((slide, j) => {
    const source = slide.sample - 1
    const end = sampleCount + j
    batches.push([{ op: 'duplicateSlide', target: { slide: source } }])
    const ops: CheilDeckOp[] = [{ op: 'moveSlide', target: { slide: source + 1 }, to: end }]
    // longer blanks first: one that holds another ("[본문 1]" in "[본문 10]") goes first
    for (const [blank, value] of Object.entries(slide.fill).sort(
      (a, b) => b[0].length - a[0].length,
    )) {
      ops.push({ op: 'findReplace', find: blank, replace: value, slideIndex: end })
    }
    batches.push(ops)
  })
  const removals: CheilDeckOp[] = []
  for (let i = sampleCount - 1; i >= 0; i--)
    removals.push({ op: 'deleteSlide', target: { slide: i } })
  batches.push(removals)
  return batches
}

/** The panel's line once the deck is made */
export function cheilDeckSummary(
  lang: string,
  input: { samples: number; slides: number; filled: number; open: number },
): string {
  return lang === 'ko'
    ? `내 양식의 견본 ${input.samples}장으로 ${input.slides}장을 만들었습니다. 칸 ${input.filled}개를 자료로 채웠고${input.open ? `, ${input.open}개는 [확인 필요]로 남겼습니다` : ''}. 저장하기 전에 확인하세요.`
    : `Made ${input.slides} slides from your template’s ${input.samples} samples; filled ${input.filled} blanks from the material${input.open ? `, ${input.open} left as [확인 필요]` : ''}. Check before saving.`
}
