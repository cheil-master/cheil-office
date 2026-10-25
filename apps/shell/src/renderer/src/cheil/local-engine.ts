/**
 * Cheil fork: the home's connection entry names the subscription programs
 * only, so an AI chosen in another way read "not connected". This is what it
 * shows instead: the person's own API key ("Claude API · claude-sonnet-5"),
 * or this PC's Ollama when that is chosen. Whether either answers is found
 * out on the first request.
 */
import type { AiSettings } from '@genoffice/ai-provider/browser'
import type { Lang } from '@genoffice/i18n'
import { apiEngineView } from './api-keys'

export interface LocalEngineView {
  name: string
  model: string
}

export function localEngineView(settings: AiSettings | null, lang: Lang): LocalEngineView | null {
  const api = apiEngineView(settings)
  if (api) return api
  if (!settings || settings.provider !== 'ollama') return null
  const model = settings.providers?.ollama?.model?.trim()
  if (!model) return null
  return { name: lang === 'ko' ? '이 PC의 AI' : 'AI on this PC', model: `Ollama · ${model}` }
}
