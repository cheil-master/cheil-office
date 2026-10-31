/** Cheil fork: real failure modes reproduced with fictional local materials. */
import { expect, it } from 'vitest'
import { searchWiki } from '../src/shared/wiki-search'
import type { WikiPage } from '../src/shared/cheil-wiki-api'
const page = (id: string, title: string, body: string) =>
  ({ id, title, body, version: 'v1' }) as WikiPage
it('finds an inflected Korean query without forcing every question word into the document', () => {
  const pages = [
    page('one', '에어린 피드백', '아기 매트 표현은 소비자 워딩으로 수정: 40mm 매트도 거뜬하게'),
  ]
  expect(searchWiki(pages, '아기 매트를 소비자 말로 어떻게 바꾸라고 했어?')[0]?.text).toContain(
    '40mm',
  )
})
it('retrieves a late spreadsheet row rather than an early common heading', () => {
  const p = page(
    'one',
    '에어린 운영 보고',
    '# 집행현황\n전체 광고 집행\n' +
      '일반 광고 | 집행 | 3\n'.repeat(3000) +
      '\n# TVC data\n[row 1] 소재 | 매체 | 날짜\n' +
      '기타 | 일반 | 1\n'.repeat(100) +
      '[row 760] 에어린 | 가상방송미디어 | 2026-10-01\n',
  )
  const e = searchWiki([p], '집행현황 가상방송미디어의 광고 집행 내역을 찾아줘')
  expect(e[0]?.text).toContain('가상방송미디어')
  expect(e[0]?.text).toContain('소재 | 매체 | 날짜')
})
it('does not treat an unknown requested identifier as an ordinary campaign question', () => {
  expect(
    searchWiki(
      [page('one', '캠페인', '다른 캠페인 승인 완료')],
      '캠페인 MISSING-20261028-ABC의 승인 근거를 찾아줘',
    ),
  ).toEqual([])
})
it('preserves product metadata and quantity in the same passage', () => {
  const e = searchWiki(
    [page('one', '소품 요청', '보관통 3개 구매\n- 제품 정보: 에어린 안심 통 8L 1개 (상품 단위)')],
    '보관통은 어떤 제품을 몇 개 준비해?',
  )
  expect(e[0]?.text).toContain('3개 구매')
  expect(e[0]?.text).toContain('상품 단위')
})

it('keeps a bounded worksheet through the final row', () => {
  const p = page(
    'one',
    '에어린 예산',
    '# 예산표\n[row 2] 구분 | TV | Digital\n' +
      Array.from({ length: 14 }, (_, i) => `[row ${i + 3}] 항목${i} | ${i} | 2`).join('\n') +
      '\n[row 20] 마지막 합계 | 30 | 10',
  )
  const e = searchWiki([p], '에어린 예산표를 보여줘')
  expect(e[0]?.text).toContain('[row 20] 마지막 합계')
})
it('carries data headers after a pivot metadata block', () => {
  const body =
    '# TVC data\n[row 1] Market | Target | Product | Platform\n[row 2] 지역 | 전체 | 에어린 | 전체\n[row 3] 합계: GRP\n[row 4] CopyLine | Channel | Date | Insertions | GRP\n' +
    '광고 | 보통 | 2026-10-01 | 3 | 1.5\n'.repeat(300) +
    '[row 760] 광고 | 가상방송미디어 | 2026-10-01 | 19 | 0'
  const e = searchWiki([page('one', '미디어 집행', body)], '가상방송미디어 집행')
  expect(e[0]?.text).toContain('Insertions | GRP')
})
