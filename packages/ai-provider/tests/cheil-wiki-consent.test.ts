/** Cheil fork: an explicit preview grant never opens general AI egress. */
import { afterEach, expect, it, vi } from 'vitest'
import { assertWikiEgress, consentForWikiExcerpts } from '../src/cheil-consent'
afterEach(() => vi.useRealTimers())
const system = 'Use supplied excerpts only',
  user = '대외비 가상전자 캠페인'
it('refuses the ordinary call, accepts exact approved text once, then rejects replay', () => {
  expect(() => assertWikiEgress('', system, user)).toThrow()
  const c = consentForWikiExcerpts(system, user)
  expect(() => assertWikiEgress('', system, user, c)).not.toThrow()
  expect(() => assertWikiEgress('', system, user, c)).toThrow()
})
it('rejects a renderer-forged token and text changed after the preview', () => {
  expect(() => assertWikiEgress('', system, user, { kind: 'wiki-excerpts' })).toThrow()
  const c = consentForWikiExcerpts(system, user)
  expect(() => assertWikiEgress('', system, user + ' 추가', c)).toThrow()
})
it('expires and cannot authorize personal or highest-grade material', () => {
  vi.useFakeTimers()
  const c = consentForWikiExcerpts(system, user)
  vi.advanceTimersByTime(300001)
  expect(() => assertWikiEgress('', system, user, c)).toThrow()
  expect(() => consentForWikiExcerpts(system, '010-1234-5678')).toThrow()
  expect(() => consentForWikiExcerpts(system, '극비 가상제품')).toThrow()
})
