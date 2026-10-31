/** Cheil fork: pairing never reveals a key until the local office approves the matching request. */
import { describe, expect, it } from 'vitest'
import { JournalPairing } from '../src/main/cheil/journal-pairing'
const first = { id: 'a'.repeat(32), nonce: '1'.repeat(64) }
describe('office-confirmed extension pairing', () => {
  it('waits for approval and consumes approval once', () => {
    const pairing = new JournalPairing()
    const request = pairing.request(first, `chrome-extension://${first.id}`)
    expect(pairing.complete(first).pending).toBe(true)
    expect(pairing.approve('wrong')).toBe(false)
    expect(pairing.approve(request.code)).toBe(true)
    expect(pairing.complete(first)).toEqual({ pending: false, code: request.code })
    expect(() => pairing.complete(first)).toThrow('pair-expired')
  })
  it('rejects another extension, nonce and website origin', () => {
    const pairing = new JournalPairing()
    pairing.request(first)
    expect(() => pairing.request({ ...first, id: 'b'.repeat(32) })).toThrow('pair-busy')
    expect(() => pairing.complete({ ...first, nonce: '2'.repeat(64) })).toThrow('pair-expired')
    expect(() => pairing.request(first, 'https://example.com')).toThrow('invalid-pair')
  })
  it('expires an unapproved request without weakening authentication', () => {
    let now = 0
    const pairing = new JournalPairing(() => now)
    const { code } = pairing.request(first)
    now = 90_001
    expect(pairing.code()).toBeNull()
    expect(pairing.approve(code)).toBe(false)
    expect(() => pairing.complete(first)).toThrow('pair-expired')
  })
})
