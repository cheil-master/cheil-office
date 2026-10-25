/**
 * Cheil fork: "connect your own API key" (2026-10-25). The deployed app runs on
 * the person's own Claude, GPT or Solar key; a model on this PC comes later.
 *
 * These are the upstream's key providers (`anthropic`, `openai`) and the
 * fork's `upstage`, shown first and by the names people know. Saving a key is
 * the person picking that provider, so it becomes the AI in use; nothing ever
 * moves to a key on its own (the upstream rule: a paid connection only when
 * the person chose it). Requests still pass the confidentiality line
 * (`cheil-grade.ts`): a key's server is outside this PC.
 *
 * Pure functions; `ApiKeyCards.tsx` draws them.
 */
import { AI_PROVIDERS } from '@genoffice/ai-provider/browser'
import type { AiProviderId, AiSettings } from '@genoffice/ai-provider/browser'

export interface CheilApiChoice {
  id: Extract<AiProviderId, 'anthropic' | 'openai' | 'upstage'>
  /** the name people know */
  name: string
  /** whose API it is, and where the key is made */
  vendor: string
  console: string
}

export const CHEIL_API_CHOICES: readonly CheilApiChoice[] = [
  { id: 'anthropic', name: 'Claude', vendor: 'Anthropic', console: 'console.anthropic.com' },
  { id: 'openai', name: 'GPT', vendor: 'OpenAI', console: 'platform.openai.com' },
  { id: 'upstage', name: 'Solar', vendor: 'Upstage', console: 'console.upstage.ai' },
]

export type ApiKeyState = 'in-use' | 'saved' | 'empty'

export function apiKeyOf(settings: AiSettings, id: CheilApiChoice['id']): string {
  return settings.providers[id]?.apiKey?.trim() ?? ''
}

/** in use (saved and chosen), saved but another AI is chosen, or no key */
export function apiKeyState(settings: AiSettings, id: CheilApiChoice['id']): ApiKeyState {
  if (!apiKeyOf(settings, id)) return 'empty'
  return settings.provider === id ? 'in-use' : 'saved'
}

/** The models a choice offers, newest first, and the one it starts on */
export function apiModels(id: CheilApiChoice['id']): { models: string[]; defaultModel: string } {
  const meta = AI_PROVIDERS.find((p) => p.id === id)
  return { models: [...(meta?.models ?? [])], defaultModel: meta?.defaultModel ?? '' }
}

/** The model a choice runs: the stored one, else the provider's default */
export function apiModelOf(settings: AiSettings, id: CheilApiChoice['id']): string {
  return settings.providers[id]?.model?.trim() || apiModels(id).defaultModel
}

/** The key, the model, and this provider as the AI in use */
export function withApiKey(
  settings: AiSettings,
  id: CheilApiChoice['id'],
  key: string,
  model: string,
): AiSettings {
  return {
    ...settings,
    provider: id,
    providers: {
      ...settings.providers,
      [id]: {
        ...settings.providers[id],
        apiKey: key.trim(),
        model: model || apiModels(id).defaultModel,
      },
    },
  }
}

/** Another model for a saved key; which AI is in use does not change */
export function withApiModel(
  settings: AiSettings,
  id: CheilApiChoice['id'],
  model: string,
): AiSettings {
  return {
    ...settings,
    providers: { ...settings.providers, [id]: { ...settings.providers[id], model } },
  }
}

/** A saved key as the AI in use */
export function withApiInUse(settings: AiSettings, id: CheilApiChoice['id']): AiSettings {
  return apiKeyOf(settings, id) ? { ...settings, provider: id } : settings
}

/** The key removed; when it was the AI in use, back to `auto` (nothing paid is picked for the person) */
export function withoutApiKey(settings: AiSettings, id: CheilApiChoice['id']): AiSettings {
  return {
    ...settings,
    provider: settings.provider === id ? 'auto' : settings.provider,
    providers: { ...settings.providers, [id]: { ...settings.providers[id], apiKey: '' } },
  }
}

/** "sk-ant-…9f2c": enough to tell keys apart, never the whole key */
export function maskedKey(key: string): string {
  const k = key.trim()
  if (k.length <= 8) return '•'.repeat(k.length)
  const head = k.slice(0, Math.min(7, k.indexOf('-', 3) > 0 ? k.indexOf('-', 3) + 1 : 3))
  return `${head}…${k.slice(-4)}`
}

/** The home's engine line for a chosen API key: "Claude API" and its model; null otherwise */
export function apiEngineView(settings: AiSettings | null): { name: string; model: string } | null {
  if (!settings) return null
  const choice = CHEIL_API_CHOICES.find((c) => c.id === settings.provider)
  if (!choice || !apiKeyOf(settings, choice.id)) return null
  return { name: `${choice.name} API`, model: apiModelOf(settings, choice.id) }
}
