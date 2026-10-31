/** @vitest-environment jsdom */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { it, expect, vi } from 'vitest'
import { useTaskAi } from '../src/renderer/src/cheil/TaskAiPicker'
import type { AiSettings } from '@genoffice/ai-provider/browser'
vi.mock('../src/renderer/src/FreeAiCards', () => ({
  useAiSettings: () => ({
    provider: 'openai',
    providers: {
      openai: { apiKey: 'test-key', model: 'gpt-test' },
      anthropic: { apiKey: 'test-key', model: 'claude-test' },
      gemini: { apiKey: 'test-key', model: 'gemini-test' },
    },
  }),
}))
vi.mock('../src/renderer/src/subscription-client', () => ({
  useSubscriptionConnection: () => ({
    statuses: { codex: { provider: 'codex', state: 'ready', meteredAccepted: false } },
  }),
}))
it('uses the document inventory and isolates task choices from each other and stored settings', async () => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  let tasks: ReturnType<typeof useTaskAi>[] = []
  function App() {
    tasks = [useTaskAi(), useTaskAi()]
    return null
  }
  const host = document.createElement('div'),
    root = createRoot(host)
  await act(async () => root.render(createElement(App)))
  expect(tasks[0].options.some((o) => o.provider === 'codex')).toBe(true)
  for (const p of ['openai', 'anthropic', 'gemini'])
    expect(tasks[0].options.some((o) => o.provider === p)).toBe(true)
  const chosen = tasks[0].options.find((o) => o.provider === 'gemini')!
  await act(async () => tasks[0].choose(chosen.value))
  const base = tasks[0].settings! as AiSettings
  expect(tasks[0].apply(base).provider).toBe('gemini')
  expect(tasks[1].apply(base).provider).toBe('openai')
  expect(base.provider).toBe('openai')
  await act(async () => root.unmount())
})
