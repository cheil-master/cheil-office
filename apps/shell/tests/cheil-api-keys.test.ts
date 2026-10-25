import { describe, expect, it } from 'vitest'
import { defaultAiSettings, getProviderAdapter } from '@genoffice/ai-provider'
import {
  CHEIL_API_CHOICES,
  apiEngineView,
  apiKeyState,
  apiModelOf,
  maskedKey,
  withApiInUse,
  withApiKey,
  withApiModel,
  withoutApiKey,
} from '../src/renderer/src/cheil/api-keys'
import { localEngineView } from '../src/renderer/src/cheil/local-engine'

describe('Cheil fork: your own API key', () => {
  it('offers Claude, GPT and Solar on their key providers', () => {
    expect(CHEIL_API_CHOICES.map((c) => [c.name, c.id])).toEqual([
      ['Claude', 'anthropic'],
      ['GPT', 'openai'],
      ['Solar', 'upstage'],
    ])
    expect(
      getProviderAdapter('upstage').resolveEndpoint({ apiKey: 'up_x', model: 'solar-pro3' }),
    ).toEqual({ protocol: 'openai-compatible', baseUrl: 'https://api.upstage.ai/v1' })
  })

  it('starts fresh settings on no key and no engine of their own', () => {
    const fresh = defaultAiSettings()
    expect(fresh.provider).toBe('auto')
    for (const c of CHEIL_API_CHOICES) expect(apiKeyState(fresh, c.id)).toBe('empty')
    expect(apiEngineView(fresh)).toBeNull()
    expect(localEngineView(fresh, 'ko')).toBeNull()
  })

  it('makes a saved key the AI in use, with the chosen model', () => {
    const saved = withApiKey(defaultAiSettings(), 'upstage', '  up_secret_1234  ', 'solar-pro2')
    expect(saved.provider).toBe('upstage')
    expect(saved.providers.upstage).toMatchObject({ apiKey: 'up_secret_1234', model: 'solar-pro2' })
    expect(apiKeyState(saved, 'upstage')).toBe('in-use')
    expect(localEngineView(saved, 'ko')).toEqual({ name: 'Solar API', model: 'solar-pro2' })
  })

  it('keeps the AI in use when another key is only changed, and switches on request', () => {
    const claude = withApiKey(defaultAiSettings(), 'anthropic', 'sk-ant-api03-abcdef9f2c', '')
    expect(apiModelOf(claude, 'anthropic')).toBe('claude-sonnet-5')
    const both = withApiKey(claude, 'openai', 'sk-proj-xyz', '')
    expect(both.provider).toBe('openai')
    expect(apiKeyState(both, 'anthropic')).toBe('saved')
    const back = withApiInUse(both, 'anthropic')
    expect(back.provider).toBe('anthropic')
    const remodel = withApiModel(back, 'openai', 'gpt-x')
    expect(remodel.provider).toBe('anthropic')
    expect(remodel.providers.openai.model).toBe('gpt-x')
    // a provider without a key is not picked
    expect(withApiInUse(defaultAiSettings(), 'upstage').provider).toBe('auto')
  })

  it('goes back to auto when the key in use is removed, never to another paid key', () => {
    const both = withApiKey(
      withApiKey(defaultAiSettings(), 'openai', 'sk-proj-xyz', ''),
      'anthropic',
      'sk-ant-1',
      '',
    )
    const removed = withoutApiKey(both, 'anthropic')
    expect(removed.provider).toBe('auto')
    expect(removed.providers.anthropic.apiKey).toBe('')
    expect(apiKeyState(removed, 'openai')).toBe('saved')
    // removing a key not in use leaves the choice alone
    expect(withoutApiKey(both, 'openai').provider).toBe('anthropic')
  })

  it('shows a key masked, never whole', () => {
    expect(maskedKey('sk-ant-api03-abcdefghij9f2c')).toBe('sk-ant-…9f2c')
    expect(maskedKey('up_abcdefghijkl1234')).toBe('up_…1234')
    expect(maskedKey('short')).toBe('•••••')
  })
})
