import { defaultAiSettings, type AiSettings } from '@genoffice/ai-provider'

/**
 * Cheil fork: fresh settings start on this PC's Ollama. The upstream tests
 * that import this describe the `auto` selection with nothing filled in, so
 * they build their settings from it instead of the fork's defaults.
 */
export function upstreamAiSettings(): AiSettings {
  const s = defaultAiSettings()
  return {
    ...s,
    provider: 'auto',
    providers: { ...s.providers, ollama: { ...s.providers.ollama, baseUrl: '' } },
  }
}
