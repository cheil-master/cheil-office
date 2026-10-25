import { defaultAiSettings, type AiSettings } from '@genoffice/ai-provider'

/**
 * Cheil fork: until 2026-10-25 fresh settings started on this PC's Ollama, and
 * the upstream tests that import this built the upstream `auto` defaults from
 * it. Fresh settings are those defaults again; this stays so the tests keep
 * saying which settings they assume.
 */
export function upstreamAiSettings(): AiSettings {
  const s = defaultAiSettings()
  return {
    ...s,
    provider: 'auto',
    providers: { ...s.providers, ollama: { ...s.providers.ollama, baseUrl: '' } },
  }
}
