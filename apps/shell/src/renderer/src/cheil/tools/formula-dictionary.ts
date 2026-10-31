/** Cheil fork: locally searchable, curated Excel functions. Original examples; Microsoft version markers. */
import type { ExcelVersion } from './formula-tools'
export const FORMULA_REFERENCE_URL =
  'https://support.microsoft.com/en-us/excel/excel-functions-alphabetical'
export const FUNCTION_CATEGORIES = [
  'all',
  'aggregate',
  'logic',
  'lookup',
  'text',
  'date',
  'array',
] as const
export type FunctionCategory = (typeof FUNCTION_CATEGORIES)[number]
export interface FormulaFunction {
  name: string
  category: Exclude<FunctionCategory, 'all'>
  since: ExcelVersion
  ko: string
  en: string
  syntax: string
  example: string
}
export const FORMULA_FUNCTIONS: readonly FormulaFunction[] = [
  {
    name: 'SUM',
    category: 'aggregate',
    since: '2016',
    ko: '숫자 합계',
    en: 'Sum numbers',
    syntax: 'SUM(number1, [number2], ...)',
    example: '=SUM(C2:C100)',
  },
  {
    name: 'SUMIF',
    category: 'aggregate',
    since: '2016',
    ko: '조건 하나로 합계',
    en: 'Sum with one condition',
    syntax: 'SUMIF(range, criteria, [sum_range])',
    example: '=SUMIF(B2:B100,"완료",C2:C100)',
  },
  {
    name: 'SUMIFS',
    category: 'aggregate',
    since: '2016',
    ko: '여러 조건으로 합계',
    en: 'Sum with multiple conditions',
    syntax: 'SUMIFS(sum_range, criteria_range1, criteria1, ...)',
    example: '=SUMIFS(C2:C100,A2:A100,E2,B2:B100,"완료")',
  },
  {
    name: 'COUNTIF',
    category: 'aggregate',
    since: '2016',
    ko: '조건에 맞는 개수',
    en: 'Count matching cells',
    syntax: 'COUNTIF(range, criteria)',
    example: '=COUNTIF(A2:A100,A2)',
  },
  {
    name: 'COUNTIFS',
    category: 'aggregate',
    since: '2016',
    ko: '여러 조건의 개수',
    en: 'Count multiple conditions',
    syntax: 'COUNTIFS(criteria_range1, criteria1, ...)',
    example: '=COUNTIFS(A2:A100,E2,B2:B100,"완료")',
  },
  {
    name: 'AVERAGEIF',
    category: 'aggregate',
    since: '2016',
    ko: '조건에 맞는 평균',
    en: 'Average matching values',
    syntax: 'AVERAGEIF(range, criteria, [average_range])',
    example: '=AVERAGEIF(B2:B100,"완료",C2:C100)',
  },
  {
    name: 'IF',
    category: 'logic',
    since: '2016',
    ko: '조건에 따라 분기',
    en: 'Choose by condition',
    syntax: 'IF(logical_test, value_if_true, [value_if_false])',
    example: '=IF(A2="","",IF(A2>=80,"통과","검토"))',
  },
  {
    name: 'IFS',
    category: 'logic',
    since: '2019',
    ko: '여러 조건을 순서대로',
    en: 'Check conditions in order',
    syntax: 'IFS(logical_test1, value_if_true1, ...)',
    example: '=IFS(A2>=90,"A",A2>=80,"B",TRUE,"C")',
  },
  {
    name: 'IFERROR',
    category: 'logic',
    since: '2016',
    ko: '오류일 때 대체',
    en: 'Replace an error',
    syntax: 'IFERROR(value, value_if_error)',
    example: '=IFERROR(INDEX(B2:B100,MATCH(D2,A2:A100,0)),"찾을 수 없음")',
  },
  {
    name: 'AND',
    category: 'logic',
    since: '2016',
    ko: '모든 조건 충족',
    en: 'All conditions true',
    syntax: 'AND(logical1, [logical2], ...)',
    example: '=IF(AND(A2>=80,B2="제출"),"완료","검토")',
  },
  {
    name: 'OR',
    category: 'logic',
    since: '2016',
    ko: '하나 이상 충족',
    en: 'Any condition true',
    syntax: 'OR(logical1, [logical2], ...)',
    example: '=IF(OR(B2="완료",B2="승인"),"종료","진행")',
  },
  {
    name: 'VLOOKUP',
    category: 'lookup',
    since: '2016',
    ko: '첫 열에서 조회',
    en: 'Look up first column',
    syntax: 'VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])',
    example: '=VLOOKUP(D2,A2:B100,2,FALSE)',
  },
  {
    name: 'INDEX',
    category: 'lookup',
    since: '2016',
    ko: '위치로 값 조회',
    en: 'Return by position',
    syntax: 'INDEX(array, row_num, [column_num])',
    example: '=INDEX(B2:B100,MATCH(D2,A2:A100,0))',
  },
  {
    name: 'MATCH',
    category: 'lookup',
    since: '2016',
    ko: '값의 위치 찾기',
    en: 'Find a position',
    syntax: 'MATCH(lookup_value, lookup_array, [match_type])',
    example: '=MATCH(D2,A2:A100,0)',
  },
  {
    name: 'XLOOKUP',
    category: 'lookup',
    since: '2021',
    ko: '검색·반환 범위 분리',
    en: 'Separate lookup and return',
    syntax:
      'XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])',
    example: '=XLOOKUP(D2,A2:A100,B2:B100,"찾을 수 없음")',
  },
  {
    name: 'TRIM',
    category: 'text',
    since: '2016',
    ko: '불필요한 공백 정리',
    en: 'Trim extra spaces',
    syntax: 'TRIM(text)',
    example: '=TRIM(A2)',
  },
  {
    name: 'SUBSTITUTE',
    category: 'text',
    since: '2016',
    ko: '지정한 텍스트 치환',
    en: 'Replace specified text',
    syntax: 'SUBSTITUTE(text, old_text, new_text, [instance_num])',
    example: '=SUBSTITUTE(A2,CHAR(10)," ")',
  },
  {
    name: 'LEFT',
    category: 'text',
    since: '2016',
    ko: '왼쪽 문자 추출',
    en: 'Extract left characters',
    syntax: 'LEFT(text, [num_chars])',
    example: '=LEFT(A2,3)',
  },
  {
    name: 'MID',
    category: 'text',
    since: '2016',
    ko: '중간 문자 추출',
    en: 'Extract middle characters',
    syntax: 'MID(text, start_num, num_chars)',
    example: '=MID(A2,4,2)',
  },
  {
    name: 'TEXT',
    category: 'text',
    since: '2016',
    ko: '서식을 적용한 텍스트',
    en: 'Format as text',
    syntax: 'TEXT(value, format_text)',
    example: '=TEXT(A2,"yyyy-mm-dd")',
  },
  {
    name: 'TEXTJOIN',
    category: 'text',
    since: '2019',
    ko: '구분자로 텍스트 합치기',
    en: 'Join with delimiter',
    syntax: 'TEXTJOIN(delimiter, ignore_empty, text1, ...)',
    example: '=TEXTJOIN(", ",TRUE,A2:A10)',
  },
  {
    name: 'WORKDAY',
    category: 'date',
    since: '2016',
    ko: '영업일 뒤 날짜',
    en: 'Offset by workdays',
    syntax: 'WORKDAY(start_date, days, [holidays])',
    example: '=WORKDAY(A2,5,$H$2:$H$20)',
  },
  {
    name: 'NETWORKDAYS',
    category: 'date',
    since: '2016',
    ko: '두 날짜의 영업일',
    en: 'Count workdays between dates',
    syntax: 'NETWORKDAYS(start_date, end_date, [holidays])',
    example: '=NETWORKDAYS(A2,B2,$H$2:$H$20)',
  },
  {
    name: 'FILTER',
    category: 'array',
    since: '2021',
    ko: '조건에 맞는 행',
    en: 'Filter matching rows',
    syntax: 'FILTER(array, include, [if_empty])',
    example: '=FILTER(A2:C100,B2:B100="완료","")',
  },
  {
    name: 'UNIQUE',
    category: 'array',
    since: '2021',
    ko: '중복 없는 목록',
    en: 'List unique values',
    syntax: 'UNIQUE(array, [by_col], [exactly_once])',
    example: '=UNIQUE(A2:A100)',
  },
  {
    name: 'SORT',
    category: 'array',
    since: '2021',
    ko: '배열 정렬',
    en: 'Sort an array',
    syntax: 'SORT(array, [sort_index], [sort_order], [by_col])',
    example: '=SORT(A2:C100,3,-1)',
  },
  {
    name: 'LET',
    category: 'logic',
    since: '2021',
    ko: '수식 안 이름 지정',
    en: 'Name formula expressions',
    syntax: 'LET(name1, name_value1, calculation)',
    example: '=LET(total,SUM(C2:C100),total*1.1)',
  },
  {
    name: 'TEXTSPLIT',
    category: 'text',
    since: '365',
    ko: '구분자로 텍스트 분리',
    en: 'Split by delimiter',
    syntax:
      'TEXTSPLIT(text, col_delimiter, [row_delimiter], [ignore_empty], [match_mode], [pad_with])',
    example: '=TEXTSPLIT(A2,",")',
  },
]
export function functionSupported(entry: FormulaFunction, version: ExcelVersion): boolean {
  const rank: Record<ExcelVersion, number> = { '2016': 0, '2019': 1, '2021': 2, '365': 3 }
  return rank[version] >= rank[entry.since]
}
export function findFormulaFunctions(query: string, category: FunctionCategory): FormulaFunction[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return FORMULA_FUNCTIONS.filter(
    (f) =>
      (category === 'all' || category === f.category) &&
      words.every((word) => `${f.name} ${f.ko} ${f.en}`.toLocaleLowerCase().includes(word)),
  )
}
