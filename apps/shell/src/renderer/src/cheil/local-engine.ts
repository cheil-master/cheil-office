/**
 * Cheil fork: the home's connection entry names the subscription programs
 * only, so with the default engine (this PC's Ollama) it read "not
 * connected". This is what it shows instead while Ollama is the chosen
 * provider. Whether Ollama answers is found out on the first request.
 */
import type { AiSettings } from '@genoffice/ai-provider/browser'
import type { Lang } from '@genoffice/i18n'

export interface LocalEngineView {
  name: string
  model: string
}

export function localEngineView(settings: AiSettings | null, lang: Lang): LocalEngineView | null {
  if (!settings || settings.provider !== 'ollama') return null
  const model = settings.providers?.ollama?.model?.trim()
  if (!model) return null
  return { name: lang === 'ko' ? '이 PC의 AI' : 'AI on this PC', model: `Ollama · ${model}` }
}
