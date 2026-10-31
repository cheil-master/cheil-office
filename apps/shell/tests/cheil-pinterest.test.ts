/** Cheil fork: untrusted Pinterest metadata and localization boundaries. */
import { describe, it, expect } from 'vitest'
import { LANGS } from '@genoffice/i18n'
import {
  boardsOf,
  pinsOf,
  resourcePage,
  identity,
  pinterestUrl,
  pinterestLoginUrl,
  pinterestVersion,
} from '../src/main/cheil/pinterest-data'
import { pinterestWords } from '../src/renderer/src/cheil/pinterest-words'
describe('Pinterest metadata', () => {
  it('allows only exact HTTPS origins', () => {
    for (const url of [
      'https://www.pinterest.com.evil.test/a',
      'http://www.pinterest.com/a',
      'https://user@www.pinterest.com/a',
      'https://www.pinterest.com:444/a',
      'javascript:alert(1)',
    ])
      expect(pinterestUrl(url)).toBe('')
    expect(pinterestUrl('/demo/board/')).toBe('https://www.pinterest.com/demo/board/')
    expect(pinterestUrl('https://i.pinimg.com/a.jpg', true)).toBeTruthy()
    expect(pinterestUrl('https://evil.test/a.jpg', true)).toBe('')
  })
  it('reads the current session rather than unrelated users', () => {
    const script = (v: unknown) => `<script type="application/json">${JSON.stringify(v)}</script>`
    expect(
      identity(
        script({
          props: {
            initialReduxState: {
              session: { user: { username: 'demo' } },
              users: { other: { username: 'wrong' } },
            },
          },
        }),
      ),
    ).toBe('demo')
    expect(() =>
      identity(
        script({ props: { initialReduxState: { users: { other: { username: 'wrong' } } } } }),
      ),
    ).toThrow('changed')
  })
  it('handles pagination and schema changes explicitly', () => {
    expect(
      resourcePage({
        resource_response: { data: [] },
        resource: { options: { bookmarks: ['next'] } },
      }).next,
    ).toBe('next')
    expect(
      resourcePage({
        resource_response: { data: { results: [] } },
        resource: { options: { bookmarks: ['-end-'] } },
      }).next,
    ).toBeUndefined()
    expect(() => resourcePage({ resource_response: { data: {} } })).toThrow('changed')
    expect(() =>
      resourcePage({ resource_response: { error: { message: 'secret' }, data: [] } }),
    ).toThrow('failed')
  })
  it('does not expose unrelated account metadata or unsafe image sources', () => {
    expect(
      boardsOf([{ id: '123', name: 'Demo', url: '/demo/a/', pin_count: 2, secret: 'hidden' }]),
    ).toEqual([{ id: '123', name: 'Demo', url: 'https://www.pinterest.com/demo/a/', count: 2 }])
    expect(pinsOf([{ id: '1', images: { orig: { url: 'https://evil.test/a' } } }])).toEqual([])
    expect(boardsOf([{ id: '../bad', name: 'Bad', url: '/a/' }])).toEqual([])
  })
  it('has complete localized controls for all supported languages', () => {
    for (const lang of LANGS) expect(Object.values(pinterestWords(lang)).every(Boolean)).toBe(true)
  })
})

describe('Pinterest login navigation', () => {
  it('allows the Korean redirect but rejects lookalikes and local URLs', () => {
    expect(pinterestLoginUrl('https://kr.pinterest.com/login/')).toBe(true)
    expect(pinterestLoginUrl('https://www.pinterest.com/login/')).toBe(true)
    for (const url of [
      'https://kr.pinterest.com.evil.test/login/',
      'https://evil.test/',
      'file:///C:/secret',
      'http://kr.pinterest.com/',
      'https://user@kr.pinterest.com/',
      'https://kr.pinterest.com:444/',
    ])
      expect(pinterestLoginUrl(url)).toBe(false)
  })
})

// Cheil fork: current server bootstrap shapes with only synthetic user data.
it('reads authenticated context and normalized current-user records', () => {
  const script = (v: unknown) => `<script type="application/json">${JSON.stringify(v)}</script>`
  expect(
    identity(script({ context: { is_authenticated: true, user: { username: 'demo' } } })),
  ).toBe('demo')
  expect(
    identity(
      script({
        initialReduxState: {
          session: { isAuthenticated: true, userId: '12' },
          users: { '12': { username: 'current' }, '99': { username: 'wrong' } },
        },
      }),
    ),
  ).toBe('current')
  expect(() =>
    identity(script({ context: { is_authenticated: false, user: { username: 'stale' } } })),
  ).toThrow('changed')
})

it('uses current deployment metadata and response bookmarks', () => {
  expect(
    pinterestVersion('<script type="application/json">{"appVersion":"demo-version"}</script>'),
  ).toBe('demo-version')
  expect(
    pinterestVersion('<script type="application/json">{"appVersion":"bad\\nheader"}</script>'),
  ).toBeUndefined()
  expect(resourcePage({ resource_response: { data: [], bookmark: 'next-page' } }).next).toBe(
    'next-page',
  )
  expect(resourcePage({ resource_response: { data: [], bookmark: '-end-' } }).next).toBeUndefined()
})
