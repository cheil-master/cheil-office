import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentToolCall } from '@genoffice/agent-core'
import {
  assertCheilEgressAllowed,
  CheilConfidentialError,
  gradeText,
  isLoopbackBaseUrl,
  normalizeForCheck,
} from '../src/cheil-grade'
import { streamForProvider } from '../src/stream'
import { chatForProvider } from '../src/chat'
import { okResponse, sseStream } from './test-utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

const cb = () => ({
  signal: new AbortController().signal,
  onDelta: () => undefined,
  onToolCall: (_c: AgentToolCall) => undefined,
})

describe('Cheil fork: grade check', () => {
  it('passes an ordinary planning sentence as public', () => {
    const r = gradeText('20대 여성 타깃의 봄 캠페인 아이디어를 세 가지 정리해 줘.')
    expect(r.rule).toBe(0)
    expect(r.pii).toBe(false)
  })

  it('marks confidentiality labels, including spaced-out ones', () => {
    expect(gradeText('본 자료는 대외비입니다').rule).toBe(2)
    expect(gradeText('대 외 비 자료').rule).toBe(2)
    expect(gradeText('INTERNAL USE ONLY').rule).toBe(2)
    expect(gradeText('미출시 제품 사양').rule).toBe(3)
    expect(gradeText('엠바고 해제 전').rule).toBe(3)
  })

  it('rejoins split jamo and strips invisible characters before checking', () => {
    expect(normalizeForCheck('ㄷㅐㅇㅚㅂㅣ')).toBe('대외비')
    expect(gradeText('대' + String.fromCharCode(0x200b) + '외비').rule).toBe(2)
  })

  it('flags personal information', () => {
    expect(gradeText('담당자 010-1234-5678').pii).toBe(true)
    expect(gradeText('메일 kim@example.com 으로').pii).toBe(true)
  })

  it('flags a pasted table of numbers', () => {
    const table = [
      '매체\t노출\t클릭',
      '검색\t120000\t3400',
      '영상\t98000\t2100',
      '배너\t45000\t900',
    ].join('\n')
    expect(gradeText(table).rule).toBe(2)
  })

  it('does not flag age bands or project words used in everyday planning', () => {
    expect(gradeText('20대 여성과 30대 남성을 잇는 프로젝트 KPI 정리').rule).toBe(0)
  })

  it('knows loopback addresses', () => {
    expect(isLoopbackBaseUrl('http://127.0.0.1:11434')).toBe(true)
    expect(isLoopbackBaseUrl('http://localhost:11434/v1')).toBe(true)
    expect(isLoopbackBaseUrl('http://[::1]:8080')).toBe(true)
    expect(isLoopbackBaseUrl('https://openrouter.ai/api/v1')).toBe(false)
    expect(isLoopbackBaseUrl('')).toBe(false)
  })
})

describe('Cheil fork: egress gate', () => {
  it('lets anything go to a model on this PC', () => {
    expect(() =>
      assertCheilEgressAllowed('http://127.0.0.1:11434', ['대외비 실적표']),
    ).not.toThrow()
  })

  it('refuses confidential or personal content bound off this PC, subscriptions included', () => {
    expect(() =>
      assertCheilEgressAllowed('https://openrouter.ai/api/v1', ['대외비 실적표']),
    ).toThrow(CheilConfidentialError)
    expect(() => assertCheilEgressAllowed('', ['연락처 010-1234-5678'])).toThrow(
      CheilConfidentialError,
    )
    expect(() => assertCheilEgressAllowed('', ['봄 캠페인 아이디어'])).not.toThrow()
  })

  it('stops a streaming turn to an outside engine before any request is made', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      streamForProvider(
        'openrouter',
        { apiKey: 'k', model: 'm' },
        's',
        [{ role: 'user', text: '이 대외비 자료를 요약해 줘' }],
        [],
        512,
        cb(),
      ),
    ).rejects.toThrow(/이 PC 밖의 AI로 보내지 않았습니다/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('checks tool results too: a document read back into the conversation counts', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      streamForProvider(
        'openrouter',
        { apiKey: 'k', model: 'm' },
        's',
        [
          { role: 'user', text: '문서를 다듬어 줘' },
          {
            role: 'assistant',
            text: '',
            toolCalls: [{ id: 't', name: 'read_document', input: {} }],
          },
          {
            role: 'tool',
            results: [{ id: 't', name: 'read_document', output: '[극비] 신제품 사양' }],
          },
        ],
        [],
        512,
        cb(),
      ),
    ).rejects.toThrow(CheilConfidentialError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lets the same confidential turn through to Ollama', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          okResponse(
            sseStream([
              JSON.stringify({ message: { content: '요약' } }),
              JSON.stringify({ done: true }),
            ]),
          ),
        ),
    )
    await expect(
      streamForProvider(
        'ollama',
        { apiKey: '', model: 'gemma4:e4b', baseUrl: 'http://127.0.0.1:11434' },
        's',
        [{ role: 'user', text: '이 대외비 자료를 요약해 줘' }],
        [],
        512,
        cb(),
      ),
    ).resolves.toBeUndefined()
  })

  it('answers a one-shot chat refusal as a failed reply', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const reply = await chatForProvider(
      'openrouter',
      { apiKey: 'k', model: 'm' },
      's',
      '대외비 요약',
    )
    expect(reply.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
