/**
 * @vitest-environment jsdom
 */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAiSettings } from '@genoffice/ai-provider'
import type { AiSettings, CodexModelCatalog } from '@genoffice/ai-provider'
import type { HomeApi } from '../src/shared/home-api'
import { LocaleProvider } from '../src/renderer/src/locale'
import { SettingsModal } from '../src/renderer/src/SettingsModal'

/**
 * Cheil fork: the OpenRouter model field takes a typed id or one picked from
 * OpenRouter's own list (Solar through OpenRouter is not in the built-in list).
 * The list is asked of openrouter.ai without the key, and a failed probe keeps
 * the built-in list.
 */

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
let calls: Array<{
  baseUrl: string
  apiKey: string | undefined
  resolve: (catalog: CodexModelCatalog) => void
}>
let setAiSettings: ReturnType<typeof vi.fn>

beforeEach(() => {
  calls = []
  setAiSettings = vi.fn(async () => undefined)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function storedSettings(model = 'openrouter/auto'): AiSettings {
  const settings = defaultAiSettings()
  settings.provider = 'openrouter'
  settings.providers.openrouter = { apiKey: 'sk-or-test', model }
  return settings
}

function installApi(settings: AiSettings): void {
  window.aiOffice = {
    getTheme: async () => 'system',
    getDefaultSaveDir: async () => '',
    getAiPanelPrefs: async () => ({ fontSize: 'medium', customFontSize: 14, spellcheck: true }),
    setAiPanelPrefs: async (patch: unknown) => patch,
    getUpdateChannel: async () => 'stable',
    getAppVersion: async () => '1.0.0',
    getAiProviders: () => [
      {
        id: 'openrouter',
        label: 'OpenRouter',
        models: ['openrouter/auto', 'anthropic/claude-sonnet-5'],
        defaultModel: 'openrouter/auto',
        keyPlaceholder: 'sk-or-...',
        defaultBaseUrl: '',
      },
    ],
    getAiSettings: async () => settings,
    setAiSettings,
    getCustomModels: (baseUrl: string, apiKey?: string) =>
      new Promise<CodexModelCatalog>((resolve) => calls.push({ baseUrl, apiKey, resolve })),
  } as unknown as HomeApi
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click()
    await Promise.resolve()
  })
}

async function openAiPane(): Promise<void> {
  await act(async () => {
    root.render(
      createElement(
        LocaleProvider,
        { initial: 'en' },
        createElement(SettingsModal, { onClose: vi.fn() }),
      ),
    )
    await Promise.resolve()
  })
  const nav = Array.from(host.querySelectorAll<HTMLButtonElement>('.set-nav-item')).find(
    (button) => button.textContent?.trim() === 'AI',
  )
  await click(nav!)
  await click(host.querySelector<HTMLButtonElement>('.set-adv-toggle')!)
  await act(async () => {
    await Promise.resolve()
  })
}

function listed(): string[] {
  return Array.from(host.querySelectorAll('#set-ai-model-openrouter option')).map(
    (option) => (option as HTMLOptionElement).value,
  )
}

describe('Cheil: OpenRouter model field', () => {
  it('asks openrouter.ai for its list without the key and offers it with the built-in ids', async () => {
    installApi(storedSettings())
    await openAiPane()
    const input = host.querySelector<HTMLInputElement>('#set-ai-model')
    expect(input?.getAttribute('list')).toBe('set-ai-model-openrouter')
    expect(listed()).toEqual(['openrouter/auto', 'anthropic/claude-sonnet-5'])

    expect(calls).toHaveLength(1)
    expect(calls[0].baseUrl).toBe('https://openrouter.ai/api/v1')
    expect(calls[0].apiKey).toBe('')
    await act(async () => {
      calls[0].resolve({ models: ['upstage/solar-pro-test', 'openrouter/auto'], defaultModel: '' })
      await Promise.resolve()
    })
    expect(listed()).toEqual(['openrouter/auto', 'anthropic/claude-sonnet-5', 'upstage/solar-pro-test'])
  })

  it('keeps a typed id that no list has and saves it', async () => {
    installApi(storedSettings('upstage/not-listed'))
    await openAiPane()
    const input = host.querySelector<HTMLInputElement>('#set-ai-model')!
    expect(input.value).toBe('upstage/not-listed')
    await act(async () => {
      calls[0].resolve({ models: [], defaultModel: '' })
      await Promise.resolve()
    })
    expect(listed()).toEqual(['openrouter/auto', 'anthropic/claude-sonnet-5'])
    expect(input.value).toBe('upstage/not-listed')
  })
})
