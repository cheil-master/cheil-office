/** Cheil fork: short-lived requests require approval in the office before returning a key. */
import { randomInt } from 'node:crypto'
type Identity = { id: string; nonce: string }
type Pending = Identity & { code: string; expires: number; approved: boolean }
export class JournalPairing {
  private pending: Pending | null = null
  constructor(private now = () => Date.now()) {}
  private current() {
    if (this.pending && this.pending.expires <= this.now()) this.pending = null
    return this.pending
  }
  private identity(raw: unknown, origin?: string): Identity {
    const value = raw as Partial<Identity> | null
    if (
      !value ||
      !/^[a-p]{32}$/.test(value.id ?? '') ||
      !/^[a-f0-9]{64}$/.test(value.nonce ?? '') ||
      (origin && origin !== `chrome-extension://${value.id}`)
    )
      throw Error('invalid-pair')
    return { id: value.id!, nonce: value.nonce! }
  }
  code(): string | null {
    return this.current()?.code ?? null
  }
  request(raw: unknown, origin?: string) {
    const identity = this.identity(raw, origin)
    const pending = this.current()
    if (pending && (pending.id !== identity.id || pending.nonce !== identity.nonce))
      throw Error('pair-busy')
    this.pending ??= {
      ...identity,
      code: String(randomInt(100000, 1000000)),
      expires: this.now() + 90_000,
      approved: false,
    }
    return { pending: true, code: this.pending.code }
  }
  approve(code: string): boolean {
    const pending = this.current()
    if (!pending || pending.code !== code) return false
    pending.approved = true
    return true
  }
  complete(raw: unknown, origin?: string): { pending: boolean; code: string } {
    const identity = this.identity(raw, origin)
    const pending = this.current()
    if (!pending || pending.id !== identity.id || pending.nonce !== identity.nonce)
      throw Error('pair-expired')
    if (!pending.approved) return { pending: true, code: pending.code }
    this.pending = null
    return { pending: false, code: pending.code }
  }
}
