/**
 * Cheil fork (work tools): the prompts of the tools that ask a model once
 * (a closer spelling check, translation). Every number and date in the text
 * goes as {값N} and comes back from this PC (`maskCheilValues`), and the
 * request still passes the confidentiality line. Pure functions only.
 */
import { maskCheilValues } from '@genoffice/ui'

const TEXT_MAX = 8_000

const restore = (text: string, values: Map<string, string>) =>
  text.replace(/\{\s*(값\d+)\s*\}/g, (whole, name: string) => values.get(name) ?? whole)

function jsonOf(content: string): Record<string, unknown> | null {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed: unknown = JSON.parse(content.slice(start, end + 1))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export interface SpellingFix {
  find: string
  fix: string
  why: string
}

export function buildSpellingPrompt(text: string): {
  system: string
  user: string
  values: Map<string, string>
} {
  const values = new Map<string, string>()
  const system = [
    '너는 한국어 업무 문서의 맞춤법·띄어쓰기·문법을 고치는 교정자다.',
    '규칙:',
    '1. 틀린 곳만 고친다. 말투·내용·순서는 바꾸지 않는다.',
    '2. find 는 원문에 있는 그대로의 짧은 구절(2~20자), fix 는 고친 구절, why 는 짧은 이유.',
    '3. {값1} 같은 자리표시는 숫자·날짜다. 그대로 둔다.',
    '4. 출력은 JSON 객체 하나: {"fixes": [{"find": "...", "fix": "...", "why": "..."}]}. 고칠 곳이 없으면 {"fixes": []}.',
  ].join('\n')
  const user = maskCheilValues(text.slice(0, TEXT_MAX), values)
  return { system, user, values }
}

/** The fixes the model found that are really in the text */
export function parseSpellingFixes(
  content: string,
  text: string,
  values: Map<string, string>,
): SpellingFix[] | null {
  const parsed = jsonOf(content)
  if (!parsed || !Array.isArray(parsed.fixes)) return null
  const fixes: SpellingFix[] = []
  for (const item of parsed.fixes) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (typeof r.find !== 'string' || typeof r.fix !== 'string') continue
    const find = restore(r.find, values)
    const fix = restore(r.fix, values)
    if (!find || find === fix || !text.includes(find)) continue
    if (fixes.some((f) => f.find === find)) continue
    fixes.push({ find, fix, why: typeof r.why === 'string' ? r.why.slice(0, 100) : '' })
    if (fixes.length >= 50) break
  }
  return fixes
}

export const TRANSLATE_LANGS = {
  ko: '한국어',
  en: '영어',
  ja: '일본어',
  zh: '중국어(간체)',
} as const
export type TranslateLang = keyof typeof TRANSLATE_LANGS

export function buildTranslatePrompt(
  text: string,
  to: TranslateLang,
  tone: 'business' | 'plain',
): { system: string; user: string; values: Map<string, string> } {
  const values = new Map<string, string>()
  const system = [
    `너는 광고대행사의 업무 번역가다. 글을 ${TRANSLATE_LANGS[to]}로 옮긴다.`,
    tone === 'business'
      ? '격식 있는 업무 문체로 옮긴다(메일·제안서에 그대로 쓸 수 있게).'
      : '뜻이 잘 통하는 자연스러운 문체로 옮긴다.',
    '규칙:',
    '1. 뜻을 더하거나 빼지 않는다. 고유명사·브랜드 이름은 그대로 둔다.',
    '2. {값1} 같은 자리표시는 숫자·날짜다. 중괄호까지 그대로 옮겨 쓴다.',
    '3. 줄바꿈과 목록 모양을 지킨다.',
    '4. 출력은 JSON 객체 하나: {"translation": "옮긴 글"}. 줄바꿈은 \\n.',
  ].join('\n')
  const user = maskCheilValues(text.slice(0, TEXT_MAX), values)
  return { system, user, values }
}

export function parseTranslation(content: string, values: Map<string, string>): string | null {
  const parsed = jsonOf(content)
  const translation = parsed?.translation
  return typeof translation === 'string' && translation.trim()
    ? restore(translation.trim(), values)
    : null
}
