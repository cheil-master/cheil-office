/**
 * Cheil fork (work tools): counting characters and catching common Korean
 * mistakes, on this PC, as the text is typed. Pure functions only.
 */

export interface TextCount {
  /** characters, spaces included, line breaks not */
  withSpaces: number
  /** characters with every space and line break left out */
  withoutSpaces: number
  /** bytes as forms that count Korean as 2 (EUC-KR style) */
  bytes: number
  /** bytes in UTF-8 */
  utf8: number
  lines: number
  /** 200-character manuscript sheets, line breaks counted as one */
  sheets: number
}

export function countText(text: string): TextCount {
  const normal = text.replace(/\r\n?/g, '\n')
  const chars = Array.from(normal)
  const withSpaces = chars.filter((c) => c !== '\n').length
  const withoutSpaces = chars.filter((c) => !/\s/.test(c)).length
  const bytes = chars.reduce((n, c) => n + (c === '\n' ? 0 : c.charCodeAt(0) < 0x80 ? 1 : 2), 0)
  const utf8 = new TextEncoder().encode(normal.replace(/\n/g, '')).length
  const lines = normal ? normal.split('\n').length : 0
  return {
    withSpaces,
    withoutSpaces,
    bytes,
    utf8,
    lines,
    sheets: chars.length ? Math.ceil(chars.length / 200) : 0,
  }
}

export interface SpellingIssue {
  start: number
  end: number
  found: string
  fix: string
  kind: '자주 틀리는 말' | '띄어쓰기'
}

interface Rule {
  re: RegExp
  fix: (m: RegExpExecArray) => string
  kind: SpellingIssue['kind']
}

const word = (wrong: string, right: string): Rule => ({
  re: new RegExp(wrong, 'g'),
  fix: () => right,
  kind: '자주 틀리는 말',
})

/**
 * Mistakes that are wrong wherever they appear, so a rule never flags a
 * correct sentence. Anything that depends on meaning (결재/결제, 로서/로써)
 * is left to the AI check.
 */
const RULES: Rule[] = [
  word('몇\\s?일(?=[^\\s가-힣]|\\s|$|째|간|이|을|동안|만에|후|뒤|전)', '며칠'),
  word('어떻해', '어떡해'),
  word('됬', '됐'),
  word('되요', '돼요'),
  word('되서', '돼서'),
  word('뵈요', '봬요'),
  word('왠만', '웬만'),
  word('웬지', '왠지'),
  word('금새', '금세'),
  word('일일히', '일일이'),
  word('오랫만', '오랜만'),
  word('역활', '역할'),
  word('희안', '희한'),
  word('어의없', '어이없'),
  word('문안하', '무난하'),
  word('갯수', '개수'),
  word('설겆이', '설거지'),
  word('않되', '안 되'),
  word('구지(?=\\s|$)', '굳이'),
  word('바램(?=입니다|이에요|이다|을|이)', '바람'),
  {
    re: /(할|될|줄|드릴|갈|올|볼|보낼|알려\s?드릴|확인할|전달할|공유할|연락할|말씀드릴)께/g,
    fix: (m) => `${m[1]}게`,
    kind: '자주 틀리는 말',
  },
  {
    re: /(검토|확인|회의|논의|협의|완료|종료|수정|반영|미팅|전달|공유|접수|출시|런칭|오픈|도착|발송)(후|중|시)(?=[\s,.)]|$|에|에는|부터|까지)/g,
    fix: (m) => `${m[1]} ${m[2]}`,
    kind: '띄어쓰기',
  },
  {
    re: /(할|볼|될|갈|줄|알|쓸|올|드릴|받을|보낼)수(있|없)/g,
    fix: (m) => `${m[1]} 수 ${m[2]}`,
    kind: '띄어쓰기',
  },
  {
    re: /(할|볼|될|갈|줄|드릴|받을|보낼)수 (있|없)/g,
    fix: (m) => `${m[1]} 수 ${m[2]}`,
    kind: '띄어쓰기',
  },
]

/** The mistakes the rules find, in order, none overlapping */
export function findSpellingIssues(text: string): SpellingIssue[] {
  const issues: SpellingIssue[] = []
  for (const rule of RULES) {
    rule.re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = rule.re.exec(text))) {
      const fix = rule.fix(m)
      if (fix !== m[0]) {
        issues.push({
          start: m.index,
          end: m.index + m[0].length,
          found: m[0],
          fix,
          kind: rule.kind,
        })
      }
      if (m[0].length === 0) rule.re.lastIndex++
    }
  }
  issues.sort((a, b) => a.start - b.start)
  return issues.filter((issue, i) => i === 0 || issue.start >= issues[i - 1]!.end)
}

/** The text with the chosen issues fixed */
export function applySpellingFixes(text: string, issues: readonly SpellingIssue[]): string {
  let out = ''
  let at = 0
  for (const issue of [...issues].sort((a, b) => a.start - b.start)) {
    if (issue.start < at || text.slice(issue.start, issue.end) !== issue.found) continue
    out += text.slice(at, issue.start) + issue.fix
    at = issue.end
  }
  return out + text.slice(at)
}
