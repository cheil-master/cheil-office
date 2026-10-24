import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentMessage, AgentToolCall } from '@genoffice/agent-core'
import { streamForProvider } from '../src/stream'
import { chatForProvider } from '../src/chat'
import { defaultAiSettings, CHEIL_OLLAMA_BASE_URL } from '../src/providers'
import { isKeyProviderConfigured } from '../src/provider-selection'
import { getProviderAdapter } from '../src/registry'
import { OLLAMA_NUM_CTX } from '../src/protocols/ollama'
import { okResponse, sseStream } from './test-utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

function collector() {
  const deltas: string[] = []
  const toolCalls: AgentToolCall[] = []
  const usage: unknown[] = []
  return {
    deltas,
    toolCalls,
    usage,
    cb: {
      signal: new AbortController().signal,
      onDelta: (text: string) => deltas.push(text),
      onToolCall: (call: AgentToolCall) => toolCalls.push(call),
      onUsage: (u: unknown) => usage.push(u),
    },
  }
}

const config = { apiKey: '', model: 'gemma4:e4b', baseUrl: CHEIL_OLLAMA_BASE_URL }

describe('Cheil fork: Ollama provider', () => {
  it('is the default engine of fresh settings, configured without a key', () => {
    const settings = defaultAiSettings()
    expect(settings.provider).toBe('ollama')
    expect(settings.providers.ollama).toMatchObject({
      apiKey: '',
      model: 'gemma4:e4b',
      baseUrl: 'http://127.0.0.1:11434',
    })
    expect(isKeyProviderConfigured(settings, 'ollama')).toBe(true)
  })

  it('routes to the native chat API, tolerating a pasted /v1 base', () => {
    const adapter = getProviderAdapter('ollama')
    expect(adapter.resolveEndpoint(config)).toEqual({
      protocol: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
    })
    expect(
      adapter.resolveEndpoint({ ...config, baseUrl: 'http://localhost:11434/v1/' }).baseUrl,
    ).toBe('http://localhost:11434')
    expect(adapter.resolveEndpoint({ ...config, baseUrl: '' }).baseUrl).toBe(
      'http://127.0.0.1:11434',
    )
  })

  it('sends the context size and streams text, tool calls and usage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse(
        sseStream([
          JSON.stringify({ message: { role: 'assistant', content: '제목을 ' }, done: false }),
          JSON.stringify({ message: { role: 'assistant', content: '바꿉니다.' }, done: false }),
          JSON.stringify({
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  function: {
                    name: 'replace_block_text',
                    arguments: { blockId: 'b1', text: '새 제목' },
                  },
                },
              ],
            },
            done: false,
          }),
          JSON.stringify({
            done: true,
            done_reason: 'stop',
            prompt_eval_count: 900,
            eval_count: 40,
          }),
        ]),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const c = collector()
    const messages: AgentMessage[] = [
      { role: 'user', text: '제목을 바꿔 줘' },
      {
        role: 'assistant',
        text: '',
        toolCalls: [{ id: 't1', name: 'read_document', input: {} }],
      },
      { role: 'tool', results: [{ id: 't1', name: 'read_document', output: 'b1: 옛 제목' }] },
    ]
    await streamForProvider(
      'ollama',
      config,
      'system',
      messages,
      [{ name: 'replace_block_text', description: 'd', inputSchema: { type: 'object' } }],
      2048,
      c.cb,
    )
    expect(c.deltas.join('')).toBe('제목을 바꿉니다.')
    expect(c.toolCalls).toHaveLength(1)
    expect(c.toolCalls[0]).toMatchObject({
      name: 'replace_block_text',
      input: { blockId: 'b1', text: '새 제목' },
    })
    expect(c.usage).toEqual([{ inputTokens: 900, outputTokens: 40 }])

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:11434/api/chat')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.options).toMatchObject({ num_ctx: OLLAMA_NUM_CTX, num_predict: 2048 })
    expect(body.stream).toBe(true)
    expect(body.keep_alive).toBe('30m')
    expect(body).not.toHaveProperty('think')
    const sent = body.messages as Array<Record<string, unknown>>
    expect(sent[0]).toEqual({ role: 'system', content: 'system' })
    expect(sent[2]).toMatchObject({
      role: 'assistant',
      tool_calls: [{ function: { name: 'read_document', arguments: {} } }],
    })
    expect(sent[3]).toEqual({ role: 'tool', tool_name: 'read_document', content: 'b1: 옛 제목' })
  })

  it('turns thinking off for models that think by default', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okResponse(
          sseStream([
            JSON.stringify({ message: { content: '네' }, done: false }),
            JSON.stringify({ done: true }),
          ]),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    await streamForProvider(
      'ollama',
      { ...config, model: 'qwen3:4b' },
      's',
      [{ role: 'user', text: 'q' }],
      [],
      512,
      collector().cb,
    )
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))
    expect(body.think).toBe(false)
  })

  it('keeps the renderer told while the local server reads a long prompt', async () => {
    vi.useFakeTimers()
    try {
      let release: (r: Response) => void = () => undefined
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(
          () =>
            new Promise<Response>((resolve) => {
              release = resolve
            }),
        ),
      )
      const c = collector()
      let activity = 0
      const run = streamForProvider('ollama', config, 's', [{ role: 'user', text: 'q' }], [], 512, {
        ...c.cb,
        onActivity: () => {
          activity++
        },
      })
      await vi.advanceTimersByTimeAsync(61_000)
      expect(activity).toBeGreaterThanOrEqual(4)
      release(
        okResponse(
          sseStream([
            JSON.stringify({ message: { content: '끝' } }),
            JSON.stringify({ done: true }),
          ]),
        ),
      )
      await run
      const after = activity
      await vi.advanceTimersByTimeAsync(60_000)
      // the heartbeat stops with the request
      expect(activity).toBe(after)
      expect(c.deltas.join('')).toBe('끝')
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports an Ollama error line', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(okResponse(sseStream([JSON.stringify({ error: 'model not found' })]))),
    )
    await expect(
      streamForProvider(
        'ollama',
        config,
        's',
        [{ role: 'user', text: 'q' }],
        [],
        512,
        collector().cb,
      ),
    ).rejects.toThrow('Ollama: model not found')
  })

  it('answers a one-shot chat, streamed, and asks for JSON when told to', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okResponse(
          sseStream([
            JSON.stringify({ message: { role: 'assistant', content: '{"S1": ' } }),
            JSON.stringify({ message: { role: 'assistant', content: '"가상전자"}' } }),
            JSON.stringify({ done: true }),
          ]),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      chatForProvider('ollama', config, 's', 'u', undefined, { json: true }),
    ).resolves.toEqual({ ok: true, content: '{"S1": "가상전자"}' })
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))
    expect(body.format).toBe('json')
    expect(body.stream).toBe(true)
  })
})
