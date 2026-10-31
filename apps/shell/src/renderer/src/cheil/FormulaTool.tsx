/** Cheil fork: standalone six-task formula assistant, independent of open sheets. */
import { useRef, useState } from 'react'
import type { Lang } from '@genoffice/i18n'
import { FormulaDataTable, emptyFormulaTable, type FormulaTableState } from './FormulaDataTable'
import { FormulaDictionary } from './FormulaDictionary'
import { FormulaResult } from './FormulaResult'
import { buildFormulaTable } from './tools/formula-table'
import { functionSupported, type FormulaFunction } from './tools/formula-dictionary'
import { formulaWords } from './tools/formula-words'
import {
  FORMULA_EXAMPLES,
  FORMULA_INPUT_MAX,
  MEDIA_FORMULA_EXAMPLE,
  buildFormulaPrompt,
  parseFormulaReply,
  type Clarification,
  type ExcelVersion,
  type FormulaInput,
  type FormulaMode,
  type FormulaReply,
  type FormulaView,
} from './tools/formula-tools'
import './FormulaTool.css'
type Ask = (system: string, user: string) => Promise<{ content: string } | { error: string }>
const VIEWS: FormulaView[] = ['create', 'data', 'explain', 'fix', 'improve', 'dictionary']
export function FormulaTool({ lang, ask }: { lang: Lang; ask: Ask }) {
  const ko = lang === 'ko',
    w = formulaWords(lang)
  const [view, setView] = useState<FormulaView>('create'),
    [version, setVersion] = useState<ExcelVersion>('365')
  const [request, setRequest] = useState(''),
    [formula, setFormula] = useState(''),
    [context, setContext] = useState(''),
    [error, setError] = useState('')
  const [table, setTable] = useState<FormulaTableState>(emptyFormulaTable)
  const [reply, setReply] = useState<FormulaReply | null>(null),
    [submitted, setSubmitted] = useState<FormulaInput | null>(null)
  const [answers, setAnswers] = useState<string[]>([]),
    [clarifications, setClarifications] = useState<Clarification[]>([])
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [stale, setStale] = useState(false)
  const running = useRef(false)
  const change = () => {
    setStale(true)
    setMessage('')
    setClarifications([])
    setAnswers([])
  }
  const pick = (next: FormulaView) => {
    if (running.current) return
    setView(next)
    setReply(null)
    setSubmitted(null)
    setAnswers([])
    setClarifications([])
    setStale(false)
    setMessage('')
  }
  const example = (task: string, layout: string) => {
    pick('create')
    setRequest(task)
    setContext(layout)
    setFormula('')
    setError('')
  }
  const dataExample = () => {
    setTable({
      grid: ko
        ? [
            ['담당자', '상태', '금액', ''],
            ['가상 A', '완료', '300000', ''],
            ['가상 B', '진행', '500000', ''],
            ['가상 A', '완료', '200000', ''],
            ['', '', '', ''],
          ]
        : [
            ['Owner', 'Status', 'Amount', ''],
            ['Alex', 'Done', '300000', ''],
            ['Taylor', 'Open', '500000', ''],
            ['Alex', 'Done', '200000', ''],
            ['', '', '', ''],
          ],
      start: 'A1',
      target: 'E2',
      headers: true,
      includeValues: false,
    })
    setRequest(
      ko ? '상태가 완료인 행의 금액을 합산해 주세요.' : 'Sum amounts where the status is Done.',
    )
    setContext('')
    change()
  }
  const useFunction = (entry: FormulaFunction) => {
    const supported = functionSupported(entry, version)
    example(
      ko
        ? `${entry.name}의 예시를 내 데이터에 맞게 바꾸고 싶어요.${supported ? '' : ` Excel ${version}에서 사용할 수 있는 대안으로 제안해 주세요.`}`
        : `Adapt this ${entry.name} example to my data.${supported ? '' : ` Use an alternative compatible with Excel ${version}.`}`,
      '',
    )
    setRequest(
      ko
        ? `${entry.name}의 예시를 내 데이터에 맞게 바꾸고 싶어요: ${entry.example}${supported ? '' : `\nExcel ${version}에서 사용할 수 있는 대안으로 제안해 주세요.`}`
        : `Adapt this example to my data: ${entry.example}${supported ? '' : `\nUse an alternative compatible with Excel ${version}.`}`,
    )
  }
  const run = async (followup = false) => {
    if (running.current || view === 'dictionary') return
    const mode: FormulaMode = view,
      creation = mode === 'create' || mode === 'data'
    if (creation ? !request.trim() : !formula.trim()) {
      setMessage(w.noInput)
      return
    }
    if (!creation && !formula.trim().startsWith('=')) {
      setMessage(w.invalid)
      return
    }
    const data =
      mode === 'data'
        ? buildFormulaTable(
            table.grid,
            table.start,
            table.target,
            table.headers,
            table.includeValues,
          )
        : undefined
    if (mode === 'data' && !data) {
      setMessage(w.tableBad)
      return
    }
    const history =
      followup && reply && !stale
        ? [
            ...clarifications,
            ...reply.questions.flatMap((question, i) =>
              answers[i]?.trim() ? [{ question, answer: answers[i]!.trim() }] : [],
            ),
          ].slice(-20)
        : []
    const input: FormulaInput = {
      mode,
      version,
      request: creation ? request : '',
      formula: creation ? '' : formula.trim(),
      context,
      error: mode === 'fix' ? error : '',
      language: ko ? 'ko' : 'en',
      ...(data ? { table: data } : {}),
      ...(history.length ? { clarifications: history } : {}),
    }
    running.current = true
    setBusy(true)
    setMessage('')
    setReply(null)
    setStale(false)
    setSubmitted(input)
    setClarifications(history)
    setAnswers([])
    try {
      const prompt = buildFormulaPrompt(input),
        answer = await ask(prompt.system, prompt.user)
      if ('error' in answer) {
        setMessage(answer.error ? `${w.failed} ${answer.error}` : w.failed)
        return
      }
      const result = parseFormulaReply(answer.content, mode)
      if (!result) {
        setMessage(w.broken)
        return
      }
      if (result.questions.length) {
        result.formula = ''
        result.alternatives = []
        result.parts = []
        result.changes = []
      }
      if (mode === 'explain' && !result.questions.length) {
        result.formula = input.formula
        result.parts = result.parts.filter((part) => input.formula.includes(part.expression))
      }
      setReply(result)
    } catch {
      setMessage(w.failed)
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  const copy = async (text: string) => {
    if (!text || stale || busy || reply?.questions.length) return
    try {
      await navigator.clipboard.writeText(text)
      setMessage(w.copied)
    } catch {
      setMessage(w.copyFailed)
    }
  }
  const creation = view === 'create' || view === 'data'
  return (
    <div className="cheil-formula" data-testid="cheil-formula">
      <div className="cheil-formula-topline">
        <p className="cheil-set-desc">{w.intro}</p>
        <label className="cheil-formula-version">
          {w.version}
          <select
            disabled={busy}
            value={version}
            data-testid="formula-version"
            onChange={(e) => {
              setVersion(e.target.value as ExcelVersion)
              change()
            }}
          >
            <option value="365">Microsoft 365</option>
            <option value="2021">Excel 2021</option>
            <option value="2019">Excel 2019</option>
            <option value="2016">Excel 2016</option>
          </select>
        </label>
      </div>
      <div
        className="cheil-formula-tabs"
        role="tablist"
        aria-label={ko ? '수식 도우미 기능' : 'Formula tasks'}
      >
        {VIEWS.map((id) => (
          <button
            type="button"
            className="btn"
            id={`formula-tab-${id}`}
            data-testid={`formula-tab-${id}`}
            data-view={id}
            key={id}
            disabled={busy}
            role="tab"
            aria-selected={view === id}
            aria-controls="formula-panel"
            onClick={() => pick(id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
              e.preventDefault()
              const next =
                VIEWS[
                  (VIEWS.indexOf(id) + (e.key === 'ArrowRight' ? 1 : VIEWS.length - 1)) %
                    VIEWS.length
                ]!
              pick(next)
              e.currentTarget.parentElement
                ?.querySelector<HTMLButtonElement>(`[data-view="${next}"]`)
                ?.focus()
            }}
          >
            {w.modes[id]}
          </button>
        ))}
      </div>
      <div id="formula-panel" role="tabpanel" aria-labelledby={`formula-tab-${view}`}>
        {view === 'dictionary' ? (
          <FormulaDictionary version={version} ko={ko} w={w} onUse={useFunction} />
        ) : (
          <div className="cheil-formula-workspace">
            <section className="cheil-formula-input-panel">
              <fieldset disabled={busy} className="cheil-formula-fields">
                {view === 'data' ? (
                  <FormulaDataTable
                    value={table}
                    w={w}
                    onChange={(value) => {
                      setTable(value)
                      change()
                    }}
                    onError={setMessage}
                    onExample={dataExample}
                  />
                ) : null}
                {creation ? (
                  <label>
                    {w.request}
                    <textarea
                      rows={4}
                      maxLength={FORMULA_INPUT_MAX}
                      value={request}
                      data-testid="formula-request"
                      placeholder={w.requestHint}
                      onChange={(e) => {
                        setRequest(e.target.value)
                        change()
                      }}
                    />
                  </label>
                ) : (
                  <label>
                    {w.formula}
                    <textarea
                      rows={4}
                      spellCheck={false}
                      maxLength={FORMULA_INPUT_MAX}
                      className="cheil-formula-code"
                      value={formula}
                      data-testid="formula-input"
                      placeholder={w.formulaHint}
                      onChange={(e) => {
                        setFormula(e.target.value)
                        change()
                      }}
                    />
                  </label>
                )}
                {view === 'fix' ? (
                  <label>
                    {w.error}
                    <input
                      maxLength={2000}
                      value={error}
                      data-testid="formula-error"
                      placeholder={w.errorHint}
                      onChange={(e) => {
                        setError(e.target.value)
                        change()
                      }}
                    />
                  </label>
                ) : null}
                <label>
                  {w.context}
                  <textarea
                    rows={2}
                    maxLength={FORMULA_INPUT_MAX}
                    value={context}
                    data-testid="formula-context"
                    placeholder={w.contextHint}
                    onChange={(e) => {
                      setContext(e.target.value)
                      change()
                    }}
                  />
                </label>
                {view === 'create' ? (
                  <div className="cheil-formula-examples">
                    <span>{w.examples}</span>
                    <div>
                      {FORMULA_EXAMPLES.map((e) => (
                        <button
                          className="btn"
                          key={e.id}
                          onClick={() =>
                            example(ko ? e.taskKo : e.taskEn, ko ? e.contextKo : e.contextEn)
                          }
                        >
                          {ko ? e.ko : e.en}
                        </button>
                      ))}
                    </div>
                    <details>
                      <summary>{w.media}</summary>
                      <button
                        className="btn"
                        onClick={() =>
                          example(
                            ko ? MEDIA_FORMULA_EXAMPLE.taskKo : MEDIA_FORMULA_EXAMPLE.taskEn,
                            ko ? MEDIA_FORMULA_EXAMPLE.contextKo : MEDIA_FORMULA_EXAMPLE.contextEn,
                          )
                        }
                      >
                        {w.ctr}
                      </button>
                    </details>
                  </div>
                ) : null}
                <div className="cheil-formula-send">
                  <button
                    className="btn btn-primary"
                    data-testid="formula-run"
                    onClick={() => void run()}
                    disabled={creation ? !request.trim() : !formula.trim()}
                  >
                    {busy ? w.busy : w.run}
                  </button>
                  <span>{w.note}</span>
                </div>
              </fieldset>
              <p className="cheil-formula-status" role="status" aria-live="polite">
                {busy ? w.busy : message || (reply && stale ? w.changed : '')}
              </p>
            </section>
            <FormulaResult
              key={`${submitted?.mode ?? view}-${submitted?.formula ?? ''}-${reply?.formula ?? ''}-${reply?.questions.join('|') ?? ''}`}
              reply={reply}
              mode={submitted?.mode ?? view}
              original={submitted?.formula ?? ''}
              stale={stale}
              busy={busy}
              answers={answers}
              onAnswer={(i, answer) =>
                setAnswers((previous) => {
                  const next = [...previous]
                  next[i] = answer
                  return next
                })
              }
              onFollowup={() => void run(true)}
              onCopy={(text) => void copy(text)}
              w={w}
            />
          </div>
        )}
      </div>
    </div>
  )
}
