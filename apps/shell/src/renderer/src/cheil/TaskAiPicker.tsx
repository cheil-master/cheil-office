import { selectAiProvider } from '@genoffice/ai-provider/browser'
/** Cheil fork: the document picker's same groups, with a task-local selection. */
import { useState } from 'react'
import {
  aiProviderPickerGroups,
  withAiProviderSelection,
  type AiProviderPickerSelection,
} from '@genoffice/ui'
import type { AiSettings } from '@genoffice/ai-provider/browser'
import { useAiSettings } from '../FreeAiCards'
import { useSubscriptionConnection } from '../subscription-client'
export function useTaskAi() {
  const settings = useAiSettings(),
    connection = useSubscriptionConnection()
  const [selection, setSelection] = useState<AiProviderPickerSelection | null>(null)
  const groups = settings ? aiProviderPickerGroups(settings, connection.statuses) : []
  const options = groups.flatMap((g) =>
    (g.models.length ? g.models : ['']).map((model) => ({
      value: JSON.stringify({
        provider: g.id,
        model,
        ...(g.endpoint ? { endpoint: g.endpoint } : {}),
      }),
      label:
        g.label +
        ' · ' +
        (g.details?.get(model)?.name || model || '기본 모델') +
        (g.metered ? ' · 종량제' : ''),
      provider: g.id,
    })),
  )
  const value = selection ? JSON.stringify(selection) : ''
  const valid = !selection || options.some((o) => o.value === value)
  const apply = (base: AiSettings): AiSettings => {
    if (!valid) throw Error('선택한 AI 연결을 다시 확인하세요.')
    const frozen = structuredClone(selection ? withAiProviderSelection(base, selection) : base)
    if (frozen.provider === 'auto') {
      const resolved = selectAiProvider(frozen, connection.statuses)
      if (resolved.connected) frozen.provider = resolved.provider
    }
    return frozen
  }
  const actual = settings
    ? selectAiProvider(
        selection ? withAiProviderSelection(settings, selection) : settings,
        connection.statuses,
      )
    : null
  const actualGroup = groups.find((g) => g.id === actual?.provider)
  return {
    settings,
    options,
    value,
    valid,
    apply,
    label: options.find((o) => o.value === value)?.label ?? actualGroup?.label ?? '연결 필요',
    choose: (value: string) => setSelection(value ? JSON.parse(value) : null),
  }
}
export function TaskAiPicker({
  task,
  disabled = false,
}: {
  task: ReturnType<typeof useTaskAi>
  disabled?: boolean
}) {
  return (
    <label className="cheil-task-ai">
      이번 작업의 AI{' '}
      <select
        aria-label="이번 작업의 AI"
        disabled={disabled}
        value={task.value}
        onChange={(e) => task.choose(e.target.value)}
      >
        <option value="">기본 AI 따르기 · {task.label}</option>
        {!task.valid && (
          <option value={task.value} disabled>
            선택한 연결 사용 불가 · 다시 선택
          </option>
        )}
        {task.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <small>문서와 같은 연결 목록 · 이번 선택은 다른 작업의 기본 AI를 바꾸지 않습니다.</small>
    </label>
  )
}
