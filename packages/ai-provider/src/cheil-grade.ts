/**
 * Cheil fork: the confidentiality check on requests that leave this PC.
 *
 * A rule-only port of the grade check of the earlier Cheil document tool
 * (`oce/src/js/30_grade.js`, rules G1-G7, signals S2-S8, combinations C3 and
 * C5; the client dictionary rules S1/C1/C2/C4 need a dictionary this app does
 * not have). The same text always gets the same verdict; no model is asked.
 *
 * Grades: 0 public, 1 internal, 2 client confidential, 3 top secret. A request
 * to an engine outside this PC is refused at grade 2 or more, or when personal
 * information shows. A model on this PC (loopback address) takes everything.
 * There is no setting that opens this; the regexes miss things, so the last
 * guard stays the person and the company's own controls.
 */
import type { AgentMessage } from '@genoffice/agent-core'

export const GRADE = { PUBLIC: 0, INTERNAL: 1, CLIENT: 2, TOP: 3 } as const
export const GRADE_NAMES = ['공개', '사내 일반', '광고주 기밀', '최고 기밀'] as const

export interface GradeHit {
  code: string
  label: string
  grade: number | null
  start: number
  shown: string
}

interface Signal {
  code: string
  label: string
  start: number
  shown: string
  para?: number
}

export interface GradeResult {
  /** the highest grade a rule or combination gave */
  rule: number
  /** personal information showed */
  pii: boolean
  hits: GradeHit[]
  signals: Signal[]
  combos: Array<{ code: string; label: string; grade: number; shown: string }>
}

// ---- normalization -------------------------------------------------------

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONG = [
  '',
  'ㄱ',
  'ㄲ',
  'ㄳ',
  'ㄴ',
  'ㄵ',
  'ㄶ',
  'ㄷ',
  'ㄹ',
  'ㄺ',
  'ㄻ',
  'ㄼ',
  'ㄽ',
  'ㄾ',
  'ㄿ',
  'ㅀ',
  'ㅁ',
  'ㅂ',
  'ㅄ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
]
const uEsc = (cp: number) => '\\u' + ('000' + cp.toString(16)).slice(-4)
const JAMO_RE = new RegExp('[' + uEsc(0x3131) + '-' + uEsc(0x3163) + ']')
const JAMO_GAP_RE = new RegExp(
  '([' +
    uEsc(0x3131) +
    '-' +
    uEsc(0x3163) +
    '])\\s+(?=[' +
    uEsc(0x3131) +
    '-' +
    uEsc(0x3163) +
    '])',
  'g',
)

/** Letters split into jamo ('ㄱㅏㄹㅐ') are put back into syllables */
function composeJamo(s: string): string {
  if (!JAMO_RE.test(s)) return s
  let out = ''
  let i = 0
  while (i < s.length) {
    const L = CHO.indexOf(s[i]!)
    const V = i + 1 < s.length ? JUNG.indexOf(s[i + 1]!) : -1
    if (L >= 0 && V >= 0) {
      let T = 0
      let used = 2
      if (i + 2 < s.length) {
        const t = JONG.indexOf(s[i + 2]!)
        const nextIsVowel = i + 3 < s.length && JUNG.indexOf(s[i + 3]!) >= 0
        if (t > 0 && !nextIsVowel) {
          T = t
          used = 3
        }
      }
      out += String.fromCharCode(0xac00 + (L * 21 + V) * 28 + T)
      i += used
    } else {
      out += s[i]
      i++
    }
  }
  return out
}

const INVISIBLE_POINTS = [
  0x00ad, 0x034f, 0x115f, 0x1160, 0x17b4, 0x17b5, 0x180e, 0x2800, 0x3164, 0xfeff, 0xffa0,
]
const INVISIBLE_RANGES: Array<[number, number]> = [
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x2069],
]
const INVISIBLE_RE = new RegExp(
  '[' +
    INVISIBLE_POINTS.map(uEsc).join('') +
    INVISIBLE_RANGES.map((r) => uEsc(r[0]) + '-' + uEsc(r[1])).join('') +
    ']|' +
    uEsc(0xdb40) +
    '[' +
    uEsc(0xdc00) +
    '-' +
    uEsc(0xdc7f) +
    ']',
  'g',
)

export function normalizeForCheck(text: string): string {
  let s = String(text || '').replace(INVISIBLE_RE, '')
  // jamo first: NFKC turns a lone jamo into a leading consonant and loses the final
  s = s.replace(JAMO_GAP_RE, '$1')
  s = composeJamo(s)
  s = s.normalize('NFKC')
  return s.replace(INVISIBLE_RE, '')
}

/** Marks with spaces, dots or hyphens between the letters ('대 외 비', '극-비'), not inside a word */
function looseMark(words: string[]): string {
  const S = '[\\s.\\-_·•]'
  return words
    .map((w) => {
      const c = w.split('')
      const alts: string[] = []
      for (let g = 1; g < c.length; g++) {
        alts.push(c.map((ch, i) => (i === 0 ? ch : (i === g ? S + '+' : S + '*') + ch)).join(''))
      }
      return '(?<![가-힣a-z])(?:' + alts.join('|') + ')(?![가-힣a-z])'
    })
    .join('|')
}

// ---- rules ---------------------------------------------------------------

interface GRule {
  code: string
  label: string
  grade: number
  lower?: boolean
  re?: RegExp
  special?: 'mailhead'
}

const G_RULES: GRule[] = [
  {
    code: 'G1',
    label: '기밀 표지',
    grade: 2,
    lower: true,
    re: new RegExp(
      '대외비(?!즈|용)|사내\\s*한정|사내한(?![가-힣])|(?<!차량\\s?|실\\s?|건물\\s?|제품\\s?|기기\\s?)내부용|confidential(?!ity)|internal[\\s\\-_]*(?:use[\\s\\-_]*)?only|do[\\s\\-_]*not[\\s\\-_]*distribute|' +
        looseMark(['대외비', '사내한', '내부용', 'confidential']),
      'g',
    ),
  },
  {
    code: 'G2',
    label: '최고 기밀 표지',
    grade: 3,
    lower: true,
    re: new RegExp(
      '극비|엠바고|embargo|미출시|보안\\s*유지(?!\\s*보수)|strictly\\s*confidential|' +
        looseMark(['극비', '엠바고', '미출시']),
      'g',
    ),
  },
  {
    code: 'G3',
    label: '코드명 표현',
    grade: 3,
    re: /코드\s*(?:명(?!함)|네임)|[Cc]ode\s*-?\s*[Nn]ame|(?<![A-Za-z])[Pp]\.?[Jj]\.?[Tt](?![A-Za-z])|(?:프로젝트|Project|PROJECT|project)\s*(?:명\s*[:：]\s*)?(?:["'“”‘’「『][^"'“”‘’」』\n]{1,20}["'“”‘’」』]|[A-Z][A-Z0-9-]*(?![A-Za-z])|[A-Za-z]+\d[A-Za-z0-9-]*|\d+[A-Za-z][A-Za-z0-9-]*)/g,
  },
  { code: 'G6', label: '메일·메신저 머리', grade: 2, special: 'mailhead' },
  {
    code: 'G7',
    label: '가명화 흔적',
    grade: 2,
    re: new RegExp(
      '고객사\\s*[A-Z](?![A-Za-z])|고객사\\s*[갑을병정](?![가-힣])|(?<![A-Za-z0-9가-힣])[A-Z]사(?!업|이트|이즈|용|무|원|진)|브랜드\\s*[A-Z](?![A-Za-z])|[Oo○◯ㅇ' +
        String.fromCharCode(0x110b) +
        ']{2}전자|○○(?!님|씨)|\\*{3,}',
      'g',
    ),
  },
]

/** Everyday work phrases G3 lets pass ('프로젝트 KPI', 'PROJECT OVERVIEW', '프로젝트 A안') */
const G3_EXCLUDE =
  /^(프로젝트|project)\s*((관리|매니저|팀|명(?!\s*[:：])|기간|단위|별)|(19|20)\d{2}(?![\dA-Za-z])|(kpi|okr|tft?|pmo?|pl|mou|nda|r&r|roi|rfp|sns|qa|ppt|overview|plan|schedule|status|summary|team|scope|goal|management|manager|office|kickoff|review|report|retrospective)(?![a-z0-9])|[a-z](?=안))/i
/** Markdown bold italic (***text***) is not a G7 masking mark */
const EMPHASIS_RE = /(^|[\s(])\*{3}(?=\S)[^*\n]{1,80}?(?<=\S)\*{3}(?=$|[\s.,!?)])/gm

const PII_RULES: Array<{ label: string; re: RegExp }> = [
  { label: '이메일', re: /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}/g },
  {
    label: '휴대전화',
    re: /(?<!\d)(?:(?:\+|00)\s?82[-.\s]?0?|0)1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g,
  },
  {
    label: '일반전화',
    re: /(?<!\d)(?:(?:\+|00)\s?82[-.\s]?0?|0)(?:2|[3-6][1-5]|70)[-.\s)]\s?\d{3,4}[-.\s]\d{4}(?!\d)/g,
  },
  {
    label: '주민등록번호',
    re: /(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\s*-?\s*[1-8]\d{6}(?!\d)/g,
  },
  { label: '계좌번호', re: /(?<!\d)(?!0\d{1,2}-)\d{3,6}-\d{2,6}-\d{2,7}(?!\d)/g },
]

const HEAD_LINE_RE =
  /^[ \t]*(보낸\s*사람|받는\s*사람|보낸\s*날짜|숨은\s*참조|참조|제목|from|to|cc|sent|date|subject)[ \t]*[:：][ \t]*([^\n]*)$/gim
const MSG_LINE_RES = [
  /^\[[^\]\n]{1,20}\]\s*\[(?:오전|오후)\s*\d{1,2}:\d{2}\]/gm,
  /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*(?:오전|오후)\s*\d{1,2}:\d{2},\s*[^:\n]{1,20}\s:/gm,
]

function mailHeadHit(text: string): { at: number; shown: string } | null {
  const keys: Record<string, true> = {}
  let first = -1
  let m: RegExpExecArray | null
  HEAD_LINE_RE.lastIndex = 0
  while ((m = HEAD_LINE_RE.exec(text)) !== null) {
    const k = m[1]!.toLowerCase().replace(/\s+/g, '')
    const v = m[2]!.trim()
    // 'from: 10시' is a time, not a header
    if ((k === 'from' || k === 'to') && /^[\d\s:시분~\-.]*$/.test(v)) continue
    keys[k] = true
    if (first < 0) first = m.index
  }
  if (/-----\s*original message\s*-----/i.test(text)) {
    keys.original = true
    if (first < 0) first = text.toLowerCase().indexOf('original message')
  }
  const names = Object.keys(keys)
  const sender = names.some((k) => ['보낸사람', '받는사람', 'from', 'to', 'original'].includes(k))
  if (names.length >= 2 && sender) return { at: first, shown: names.slice(0, 3).join(' ') }
  let msgLines = 0
  let mfirst = -1
  for (const re of MSG_LINE_RES) {
    re.lastIndex = 0
    let mm: RegExpExecArray | null
    while ((mm = re.exec(text)) !== null) {
      msgLines++
      if (mfirst < 0) mfirst = mm.index
    }
  }
  if (msgLines >= 2) return { at: mfirst, shown: `메신저 대화 머리 ${msgLines}줄` }
  return null
}

const S_RULES: Array<{ code: string; label: string; re: RegExp }> = [
  {
    code: 'S2',
    label: '금액',
    re: /(?:₩|\$|krw|usd)\s?\d[\d,.]{0,20}|\d[\d,.]{0,20}\s?(?:조|억|천만|백만|만|천)?\s?(?:원|달러)(?!칙|인|래|형|점|격|본|작)|\d[\d,.]{0,20}\s?(?:억|천만|백만)(?!\s?(?:명|건|회|대|개|뷰|원))|\d[\d,.]{0,20}\s?만(?!\s?(?:명|건|회|뷰|개|대|가구|부|장|원|달러))(?=\s|$|[,.)])|\d[\d,.]{0,20}\s?(?:m|mn|bn|k)\s?(?:usd|krw)/gi,
  },
  {
    code: 'S3',
    label: '비율',
    re: /\d{1,6}(?:\.\d{1,4})?\s?(?:%p|%|퍼센트|포인트)|전년\s*대비|목표\s*대비|전월\s*대비|전년비/gi,
  },
  { code: 'S3', label: '비율', re: /\b(?:YoY|MoM|YOY|MOM)\b/g },
  {
    code: 'S4',
    label: '물량',
    re: /\d[\d,.]{0,20}\s?(?:[만천백]\s?)?(?:대(?!비|상|응|학|표|형|규|안|신|체|부|해|한|로|화)|ea(?![a-z])|units?(?![a-z])|개(?!월|선|발|요|인|최|념|편|정)|세트|박스)/gi,
  },
  {
    code: 'S7',
    label: '내부 문서 표현',
    re: /품의|결재|보고\s*드립니다|회의록|참석자|내부\s*리뷰|가칭/g,
  },
  {
    code: 'S8',
    label: '광고주 업무 표현',
    re: /\brfp\b|(?<![a-z])ot(?![a-z])|경쟁\s*pt|브리프|집행\s*결과|달성률|매체\s*단가/gi,
  },
]
/** '20대 여성', '3대 핵심 메시지': an age band or a ranking, not a quantity */
const S4_NOT_QTY =
  /^\s*(?:여성|남성|남녀|고객|소비자|직장인|이상|초반|중반|후반|층|타깃|타겟|모델|핵심|전략|과제|트렌드|메시지|원칙|기업|도시|매체|그룹)/

const LAUNCH_RE =
  /(출시|런칭|론칭|온에어|on-air|공개|발매|선보일)\s*(예정|전|계획)|(출시|런칭|론칭|발매)\s*(?:할|될|하기로|되기로|합니다|됩니다|한다|된다)|공개될|선보일\s*예정/i
const FUTURE_RE =
  /\d\s?q(?![a-z])|(?<![a-z])q\s?[1-4](?![0-9])|[1-4]\s?분기|상반기|하반기|연말|연내|다음\s?(?:달|주)|담달|내달|내주|내년|이번\s?달\s?말|d-\d+|\d{1,2}\s?월|20\d{2}\s?년|(?<![\d./])\d{1,2}\/\d{1,2}(?![\d/])|20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/i
const PAST_RE =
  /^(?!.*(?:연기|변경|미뤄|조정)).*(?:(?:출시|런칭|론칭|온에어|공개|발매)\s*(?:예정|계획)\s*(?:이었|였|이던)|(?:출시|런칭|론칭|발매)\s*(?:됐|되었|했))/
const REPORT_PUBLISH_RE = /(보고서|자료|결과|리포트)[^.\n]{0,10}공개\s*(예정|전|될)/

function isLaunchSentence(s: string): boolean {
  if (!LAUNCH_RE.test(s)) return false
  // '보고서 공개 예정' talks about publishing a document; look again without it
  if (REPORT_PUBLISH_RE.test(s)) return LAUNCH_RE.test(s.replace(REPORT_PUBLISH_RE, ' '))
  return true
}

function futureText(sentence: string): string {
  return sentence
    .replace(
      /(\d{1,2})\s?월(?=\s*(?:에|중|중순|초|말)?\s*(?:진행한|진행했|실시한|했던|열린|있었던|나온|발표한))/g,
      ' ',
    )
    .replace(/(?:지난|작년|지난해)\s*\d{1,2}\s?월/g, ' ')
}

function scanSentences(text: string): Array<{ start: number; text: string }> {
  const out: Array<{ start: number; text: string }> = []
  const re = /(?:[^.!?。\n]|(?<=\d)\.(?=\d))+[.!?。]?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[0].trim()) out.push({ start: m.index, text: m[0] })
  }
  return out
}

function splitRow(line: string): string[] {
  if (line.includes('\t')) return line.split('\t')
  if ((line.match(/\|/g) || []).length >= 2) {
    return line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
  }
  return line.trim().split(/\s{2,}/)
}

const NUM_CELL_RE =
  /^[+\-−(]?[₩$]?\s?[\d,.]+\s?(%p?|원|만\s?원|억\s?원?|천만\s?원?|백만\s?원?|건|회|대|개|명|만|억)?\)?$/i

/** A pasted table: 3+ rows of 3+ cells where 40% or more of the cells are numbers */
function tableShape(text: string): number {
  const lines = text.split('\n')
  let pos = 0
  let count = 0
  let first = -1
  for (const l of lines) {
    const cells = splitRow(l)
      .map((c) => c.trim())
      .filter((c) => c)
    if (cells.length >= 3) {
      const nums = cells.filter((c) => NUM_CELL_RE.test(c)).length
      if (nums / cells.length >= 0.4) {
        count++
        if (first < 0) first = pos
      }
    }
    pos += l.length + 1
  }
  return count >= 3 ? first : -1
}

function paragraphStarts(text: string): number[] {
  const starts = [0]
  const re = /\n\s*\n/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) starts.push(m.index + m[0].length)
  return starts
}

function paragraphOf(starts: number[], pos: number): number {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid]! <= pos) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Grade one text by rule */
export function gradeText(rawText: string): GradeResult {
  const text = normalizeForCheck(rawText)
  const lower = text.toLowerCase()
  const res: GradeResult = { rule: 0, pii: false, hits: [], signals: [], combos: [] }
  const addHit = (
    code: string,
    label: string,
    grade: number | null,
    start: number,
    shown: string,
  ) => {
    res.hits.push({ code, label, grade, start, shown })
    if (grade !== null && grade > res.rule) res.rule = grade
  }

  const emphasis: Array<[number, number]> = []
  EMPHASIS_RE.lastIndex = 0
  let em: RegExpExecArray | null
  while ((em = EMPHASIS_RE.exec(text)) !== null) emphasis.push([em.index, em.index + em[0].length])

  for (const r of G_RULES) {
    if (r.special === 'mailhead') {
      const mh = mailHeadHit(text)
      if (mh) addHit(r.code, r.label, r.grade, mh.at, mh.shown)
      continue
    }
    const re = r.re!
    const src = r.lower ? lower : text
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      if (m[0] === '') {
        re.lastIndex++
        continue
      }
      if (r.code === 'G3' && G3_EXCLUDE.test(src.slice(m.index, m.index + m[0].length + 4)))
        continue
      const at = m.index
      if (r.code === 'G7' && m[0][0] === '*' && emphasis.some((e) => at >= e[0] && at < e[1]))
        continue
      addHit(r.code, r.label, r.grade, m.index, m[0].trim())
    }
  }

  for (const r of PII_RULES) {
    r.re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = r.re.exec(text)) !== null) {
      if (r.label === '계좌번호') {
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(m[0])) continue
        const before = text.slice(Math.max(0, m.index - 20), m.index)
        if (
          !/(계좌|입금|은행|예금주|송금)/.test(before) &&
          (m[0].replace(/\D/g, '').length < 10 ||
            /^(19|20)\d{2}-/.test(m[0]) ||
            /^\d{3}-\d{2}-\d{5}$/.test(m[0]))
        )
          continue
      }
      res.pii = true
      addHit('G5', `개인정보 형태(${r.label})`, null, m.index, r.label)
    }
  }

  const addSig = (code: string, label: string, start: number, shown: string) => {
    res.signals.push({ code, label, start, shown })
  }
  for (const r of S_RULES) {
    r.re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = r.re.exec(text)) !== null) {
      if (/^\s*(19|20)\d{2}\s*$/.test(m[0])) continue
      if (
        r.code === 'S4' &&
        /^\d{1,2}\s?대$/.test(m[0]) &&
        S4_NOT_QTY.test(text.slice(m.index + m[0].length))
      )
        continue
      addSig(r.code, r.label, m.index, m[0].trim())
    }
  }
  for (const s of scanSentences(text)) {
    if (isLaunchSentence(s.text) && FUTURE_RE.test(futureText(s.text)) && !PAST_RE.test(s.text)) {
      addSig('S5', '출시 예정', s.start, s.text.trim().slice(0, 30))
    }
  }
  const shape = tableShape(text)
  if (shape >= 0) addSig('S6', '붙여 넣은 표 모양', shape, '표 3줄 이상')

  // combinations: same paragraph or within 300 characters
  const starts = paragraphStarts(text)
  const paraOf = (s: Signal) => {
    if (s.para === undefined) s.para = paragraphOf(starts, s.start)
    return s.para
  }
  const near = (a: Signal, b: Signal) =>
    Math.abs(a.start - b.start) <= 300 || paraOf(a) === paraOf(b)
  const sig = (code: string) => res.signals.filter((s) => s.code === code)
  const anyNear = (as: Signal[], bs: Signal[]): Signal[] | null => {
    for (const a of as) for (const b of bs) if (near(a, b)) return [a, b]
    return null
  }
  const addCombo = (code: string, label: string, grade: number, pair: Signal[]) => {
    res.combos.push({
      code,
      label,
      grade,
      shown: pair.map((p) => `${p.label} "${p.shown}"`).join(' + '),
    })
    if (grade > res.rule) res.rule = grade
  }
  const amt = sig('S2').concat(sig('S3'), sig('S4'))
  // C3: S6 only fires on rows that are 40% numbers, so it is already "table + numbers"
  const s6 = sig('S6')
  if (s6.length) addCombo('C3', '표 모양 + 숫자', 2, anyNear(s6, amt) ?? [s6[0]!])
  const pool = res.signals
  if (new Set(pool.map((s) => s.code)).size >= 3) {
    for (const a of pool) {
      const kinds = new Set<string>()
      const members: Signal[] = []
      for (const b of pool) {
        if (!kinds.has(b.code) && near(a, b)) {
          kinds.add(b.code)
          members.push(b)
        }
      }
      if (members.length >= 3) {
        addCombo('C5', '서로 다른 신호 3종 이상', 2, members.slice(0, 3))
        break
      }
    }
  }
  return res
}

// ---- the gate ------------------------------------------------------------

/** A base URL on this PC: the request never leaves it */
export function isLoopbackBaseUrl(baseUrl: string): boolean {
  let host: string
  try {
    host = new URL(baseUrl).hostname.toLowerCase()
  } catch {
    return false
  }
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '[::1]' ||
    host === '::1' ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  )
}

/** The text of a request the check reads: what the person and their documents put in */
export function requestTextOf(messages: AgentMessage[], extra: string[] = []): string[] {
  const parts: string[] = [...extra]
  for (const m of messages) {
    if (m.role === 'user') parts.push(m.text)
    else if (m.role === 'assistant') parts.push(m.text)
    else for (const r of m.results) parts.push(r.output)
  }
  return parts.filter((p) => p && p.trim())
}

export class CheilConfidentialError extends Error {
  readonly verdict: GradeResult
  constructor(verdict: GradeResult) {
    const reasons = [
      ...verdict.hits
        .filter((h) => h.grade === null || h.grade >= GRADE.CLIENT)
        .map((h) => h.label),
      ...verdict.combos.map((c) => c.label),
    ]
    const unique = [...new Set(reasons)].slice(0, 4).join(', ')
    super(
      `이 요청에 ${verdict.pii ? '개인정보' : (GRADE_NAMES[verdict.rule] ?? '기밀')}로 보이는 내용이 있어 ` +
        `이 PC 밖의 AI로 보내지 않았습니다(${unique}). ` +
        'AI 설정에서 이 PC의 sLLM(Ollama)을 골라 다시 보내세요.',
    )
    this.name = 'CheilConfidentialError'
    this.verdict = verdict
  }
}

/** The verdict on texts bound for an engine outside this PC */
export function gradeOutbound(texts: string[]): GradeResult {
  const merged: GradeResult = { rule: 0, pii: false, hits: [], signals: [], combos: [] }
  for (const t of texts) {
    const r = gradeText(t)
    merged.rule = Math.max(merged.rule, r.rule)
    merged.pii = merged.pii || r.pii
    merged.hits.push(...r.hits)
    merged.signals.push(...r.signals)
    merged.combos.push(...r.combos)
  }
  return merged
}

/**
 * Throw when a request to `baseUrl` would carry client-confidential, top
 * secret or personal content off this PC. `baseUrl` is '' for the
 * subscription programs, which always send to their vendor.
 */
export function assertCheilEgressAllowed(baseUrl: string, texts: string[]): void {
  if (baseUrl && isLoopbackBaseUrl(baseUrl)) return
  const verdict = gradeOutbound(texts)
  if (verdict.pii || verdict.rule >= GRADE.CLIENT) throw new CheilConfidentialError(verdict)
}
