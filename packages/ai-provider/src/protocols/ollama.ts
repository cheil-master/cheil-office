/**
 * Ollama's native chat API (`POST /api/chat`), for a model running on this PC.
 *
 * Cheil fork: the OpenAI-compatible `/v1` route of Ollama ignores the context
 * size, so every request ran with the model's 4096-token default and the
 * editors' system prompts were cut. The native route takes `options.num_ctx`.
 * The stream is one JSON object per line; a tool call arrives whole, with its
 * arguments already an object.
 */
import type { AgentMessage, AgentToolDef } from '@genoffice/agent-core'
import { aiFetch } from '../fetch'
import { httpBodyDetail } from '../http-error'
import type { AiChatResponse, AiProviderConfig, AiTokenUsage } from '../types'
import { AI_WATCHDOG_MAX_TIMEOUT_MS, createStreamWatchdog, type StreamWatchdog } from '../watchdog'
import {
  endpointUrl,
  isPlainObject,
  readCappedResponseText,
  sseLines,
  throwIfToolCountOverBudget,
  usageCount,
  type StreamCallbacks,
} from './shared'

export const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
/** Context window asked of the model; the editors' prompts and tools need more than 4096 */
export const OLLAMA_NUM_CTX = 16384
/** Keep the model loaded between turns: a cold load on a laptop CPU takes a minute or more */
export const OLLAMA_KEEP_ALIVE = '30m'
/** How often an open request tells the renderer the local server is still working */
export const OLLAMA_HEARTBEAT_MS = 15_000
/** Models that think before answering unless told not to (the thinking is slow and in English) */
const THINKING_MODELS = /^(qwen3|deepseek-r1|gpt-oss|magistral)/i

function ollamaMessages(system: string, messages: AgentMessage[]): unknown[] {
  const out: unknown[] = [{ role: 'system', content: system }]
  const toolNames = new Map<string, string>()
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({
        role: 'user',
        content: m.text,
        ...(m.images?.length ? { images: m.images.map((img) => img.base64) } : {}),
      })
    } else if (m.role === 'assistant') {
      for (const call of m.toolCalls ?? []) toolNames.set(call.id, call.name)
      out.push({
        role: 'assistant',
        content: m.text,
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((call) => ({
                function: { name: call.name, arguments: call.input },
              })),
            }
          : {}),
      })
    } else {
      for (const r of m.results) {
        out.push({
          role: 'tool',
          tool_name: r.name || toolNames.get(r.id) || '',
          content: r.isError ? `Error: ${r.output}` : r.output,
        })
      }
    }
  }
  return out
}

function requestBody(
  config: AiProviderConfig,
  messages: unknown[],
  tools: AgentToolDef[],
  maxTokens: number,
  stream: boolean,
  json = false,
): string {
  return JSON.stringify({
    model: config.model,
    messages,
    // grammar-constrained output: even a small model answers well-formed JSON
    ...(json ? { format: 'json' } : {}),
    ...(tools.length > 0
      ? {
          tools: tools.map((t) => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.inputSchema },
          })),
        }
      : {}),
    ...(THINKING_MODELS.test(config.model) ? { think: false } : {}),
    options: { num_ctx: OLLAMA_NUM_CTX, num_predict: maxTokens, temperature: 0.3 },
    keep_alive: OLLAMA_KEEP_ALIVE,
    stream,
  })
}

interface OllamaChunk {
  message?: {
    content?: string
    thinking?: string
    tool_calls?: Array<{ function?: { name?: string; arguments?: unknown } }>
  }
  done?: boolean
  done_reason?: string
  prompt_eval_count?: unknown
  eval_count?: unknown
  error?: string
}

function ollamaError(text: string): string {
  return `Ollama: ${text}`
}

export async function streamOllama(
  baseUrl: string,
  config: AiProviderConfig,
  system: string,
  messages: AgentMessage[],
  tools: AgentToolDef[],
  maxTokens: number,
  cb: StreamCallbacks,
): Promise<void> {
  // nothing streams until the whole prompt is read, which on a laptop CPU takes
  // minutes (about 35 tokens a second measured): the first byte gets the
  // longest budget the watchdog allows
  const wd = createStreamWatchdog(cb.signal, AI_WATCHDOG_MAX_TIMEOUT_MS)
  // The renderer's silence watchdog (4 min) only hears wire activity. The
  // server on this PC is reading the prompt meanwhile, so say so while the
  // request is open; a server that really stalls is still caught by `wd`.
  const heartbeat = setInterval(() => cb.onActivity?.(), OLLAMA_HEARTBEAT_MS)
  try {
    return await wd.guard(() =>
      ollamaTurn(baseUrl, config, system, messages, tools, maxTokens, cb, wd),
    )
  } finally {
    clearInterval(heartbeat)
  }
}

async function ollamaTurn(
  baseUrl: string,
  config: AiProviderConfig,
  system: string,
  messages: AgentMessage[],
  tools: AgentToolDef[],
  maxTokens: number,
  cb: StreamCallbacks,
  wd: StreamWatchdog,
): Promise<void> {
  const onBytes = () => {
    wd.touch()
    cb.onActivity?.()
  }
  const response = await aiFetch(endpointUrl(baseUrl, 'api/chat'), {
    method: 'POST',
    signal: wd.signal,
    headers: { 'Content-Type': 'application/json' },
    body: requestBody(config, ollamaMessages(system, messages), tools, maxTokens, true),
  })
  onBytes()
  if (!response.ok || !response.body) {
    throw new Error(
      `HTTP ${response.status}: ${httpBodyDetail(await readCappedResponseText(response, onBytes))}`,
    )
  }
  let emitted = false
  let sawDone = false
  let toolCount = 0
  let usage: AiTokenUsage | undefined
  let stopReason: string | undefined
  for await (const line of sseLines(response.body, onBytes)) {
    if (!line.trim()) continue
    let chunk: OllamaChunk
    try {
      chunk = JSON.parse(line) as OllamaChunk
    } catch {
      continue
    }
    if (chunk.error) throw new Error(ollamaError(chunk.error))
    const msg = chunk.message
    if (msg?.thinking) {
      emitted = true
      cb.onReasoningDelta?.(msg.thinking)
    }
    if (msg?.content) {
      emitted = true
      cb.onDelta(msg.content)
    }
    for (const tc of msg?.tool_calls ?? []) {
      const name = tc.function?.name
      if (!name) continue
      toolCount++
      throwIfToolCountOverBudget(toolCount, 'ollama')
      emitted = true
      let args = tc.function?.arguments
      if (typeof args === 'string') {
        const raw = args
        try {
          args = JSON.parse(raw)
        } catch {
          cb.onToolCall({
            id: crypto.randomUUID(),
            name,
            input: {},
            inputError: `tool input is not JSON; raw: ${raw.slice(0, 500)}`,
          })
          continue
        }
      }
      cb.onToolCall({
        id: crypto.randomUUID(),
        name,
        input: isPlainObject(args) ? args : {},
        ...(isPlainObject(args) ? {} : { inputError: 'tool input must be a JSON object' }),
      })
    }
    if (chunk.done) {
      sawDone = true
      if (chunk.done_reason === 'length') stopReason = 'max_tokens'
      const input = usageCount(chunk.prompt_eval_count)
      const output = usageCount(chunk.eval_count)
      if (input !== undefined || output !== undefined) {
        usage = {}
        if (input !== undefined) usage.inputTokens = input
        if (output !== undefined) usage.outputTokens = output
      }
      break
    }
  }
  // the loop's retry looks for this exact phrase
  if (!emitted && !sawDone) throw new Error('The model returned no content (empty stream)')
  if (!sawDone) throw new Error('The model stream ended before Ollama reported done')
  if (stopReason) cb.onStopReason?.(stopReason)
  if (usage) cb.onUsage?.(usage)
}

export async function chatOllama(
  wd: StreamWatchdog,
  baseUrl: string,
  config: AiProviderConfig,
  system: string,
  user: string,
  options: { json?: boolean | undefined } = {},
): Promise<AiChatResponse> {
  // streamed, so every token feeds the watchdog's idle timer: a whole answer
  // at a laptop's 8 tokens a second outlasts any fixed budget
  const response = await aiFetch(endpointUrl(baseUrl, 'api/chat'), {
    method: 'POST',
    signal: wd.signal,
    headers: { 'Content-Type': 'application/json' },
    body: requestBody(
      config,
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      [],
      4096,
      true,
      options.json === true,
    ),
  })
  wd.touch()
  if (!response.ok || !response.body) {
    const bodyText = await readCappedResponseText(response, () => wd.touch())
    return { ok: false, error: `HTTP ${response.status}: ${httpBodyDetail(bodyText)}` }
  }
  let content = ''
  for await (const line of sseLines(response.body, () => wd.touch())) {
    if (!line.trim()) continue
    let chunk: OllamaChunk
    try {
      chunk = JSON.parse(line) as OllamaChunk
    } catch {
      continue
    }
    if (chunk.error) return { ok: false, error: ollamaError(chunk.error) }
    content += chunk.message?.content ?? ''
    if (chunk.done) break
  }
  if (!content) return { ok: false, error: 'AI returned an empty response' }
  return { ok: true, content }
}
