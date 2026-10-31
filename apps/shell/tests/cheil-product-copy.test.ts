/** Cheil fork: product identity must not redirect support to the upstream maintainer. */
import { describe, expect, it } from 'vitest'
import { LANGS, PRODUCT_CONTACT_EMAIL, PRODUCT_REPO_SLUG } from '@genoffice/i18n'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  PRODUCT_COPY,
  productCopyOverrides,
  programConnectionHint,
} from '../src/renderer/src/cheil/product-copy'
import { cheilHelpBody } from '../src/renderer/src/i18n/help/product-help'

describe('Cheil product communication', () => {
  it('provides complete product wording and local-login explanations in all languages', () => {
    const keys = Object.keys(PRODUCT_COPY.ko).sort()
    for (const lang of LANGS) {
      expect(Object.keys(PRODUCT_COPY[lang]).sort()).toEqual(keys)
      expect(Object.values(PRODUCT_COPY[lang]).every((s) => s.trim().length > 0)).toBe(true)
      expect(programConnectionHint(lang)).not.toBe('')
      expect(productCopyOverrides(lang).setSecAccount).toBe(productCopyOverrides(lang).setSecAi)
      for (const topic of [
        'install',
        'getting-started',
        'home-screen',
        'subscription',
        'ai-models',
        'settings-integrations',
      ]) {
        const guide = cheilHelpBody(topic, lang)!
        expect(guide).toMatch(/^# /)
        expect(guide).not.toMatch(/pblsketch@gmail|docs\.google\.com\/forms/)
      }
    }
    expect(programConnectionHint('ko')).toContain('대화·메모리 동기화가 아닙니다')
  })
  it('uses this project for support and leaves original attribution intact', () => {
    expect(PRODUCT_REPO_SLUG).toBe('cheil-master/cheil-office')
    expect(PRODUCT_CONTACT_EMAIL).toBe('champ.lee@samsung.com')
    const notice = readFileSync(resolve(import.meta.dirname, '../../../NOTICE'), 'utf8')
    expect(notice).toContain('CheilOffice distribution notice')
    expect(notice).toContain('IeumOffice modifications')
    expect(notice).toContain('GenOffice')
    expect(notice).toContain('Pretendard')
  })
})
