/** Cheil fork: explain recommendations, inspect exact parts, and compare revisions. */
import { useState } from 'react'
import { formulaDifference, type FormulaMode, type FormulaReply } from './tools/formula-tools'
import type { FormulaWords } from './tools/formula-words'
export function FormulaResult({
  reply,
  mode,
  original,
  stale,
  busy,
  answers,
  onAnswer,
  onFollowup,
  onCopy,
  w,
}: {
  reply: FormulaReply | null
  mode: FormulaMode
  original: string
  stale: boolean
  busy: boolean
  answers: string[]
  onAnswer: (index: number, answer: string) => void
  onFollowup: () => void
  onCopy: (formula: string) => void
  w: FormulaWords
}) {
  const [selectedPart, setSelectedPart] = useState('')
  const shown = reply?.formula ?? '',
    at = selectedPart ? shown.indexOf(selectedPart) : -1
  const different =
    reply && original && shown && (mode === 'fix' || mode === 'improve')
      ? formulaDifference(original, shown)
      : null
  const changedLine = (value: { prefix: string; changed: string; suffix: string }) => (
    <>
      {value.prefix}
      {value.changed ? <mark>{value.changed}</mark> : null}
      {value.suffix}
    </>
  )
  return (
    <section className="cheil-formula-result" data-testid="formula-result" aria-busy={busy}>
      {reply ? (
        <>
          {reply.questions.length ? (
            <div className="cheil-formula-questions" data-testid="formula-questions">
              <h3>{w.questions}</h3>
              <p>{reply.explanation}</p>
              {reply.questions.map((question, i) => (
                <label key={i}>
                  {question}
                  <textarea
                    rows={2}
                    maxLength={1000}
                    disabled={busy || stale}
                    data-testid={`formula-answer-${i}`}
                    value={answers[i] ?? ''}
                    placeholder={w.answerHint}
                    onChange={(e) => onAnswer(i, e.target.value)}
                  />
                </label>
              ))}
              <button
                className="btn btn-primary"
                data-testid="formula-followup"
                disabled={busy || stale || !answers.some((a) => a.trim())}
                onClick={onFollowup}
              >
                {w.followup}
              </button>
            </div>
          ) : (
            <>
              {shown ? (
                <>
                  <div className="cheil-formula-heading">
                    <h3>{mode === 'explain' ? w.explained : w.generated}</h3>
                    <button
                      className="btn"
                      disabled={stale || busy}
                      onClick={() => onCopy(shown)}
                      data-testid="formula-copy"
                    >
                      {w.copy}
                    </button>
                  </div>
                  <pre>
                    <code data-testid="formula-output">
                      {at >= 0 ? (
                        <>
                          {shown.slice(0, at)}
                          <mark>{selectedPart}</mark>
                          {shown.slice(at + selectedPart.length)}
                        </>
                      ) : (
                        shown
                      )}
                    </code>
                  </pre>
                </>
              ) : null}
              <h3>{w.meaning}</h3>
              <p>{reply.explanation}</p>
              {different ? (
                <section data-testid="formula-difference">
                  <h3>{w.beforeAfter}</h3>
                  {different.identical ? (
                    <p>{w.identical}</p>
                  ) : (
                    <div className="cheil-formula-comparison">
                      <div>
                        <span>{w.before}</span>
                        <pre>
                          <code>{changedLine(different.before)}</code>
                        </pre>
                      </div>
                      <div>
                        <span>{w.after}</span>
                        <pre>
                          <code>{changedLine(different.after)}</code>
                        </pre>
                      </div>
                    </div>
                  )}
                </section>
              ) : null}
              {reply.changes.length && (mode === 'fix' || mode === 'improve') ? (
                <>
                  <h3>{w.changes}</h3>
                  <ul>
                    {reply.changes.map((change, i) => (
                      <li key={i}>
                        <strong>{change.what}</strong>
                        <p>{change.why}</p>
                        <p>
                          {w.effect}: {change.effect}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {reply.parts.length ? (
                <>
                  <h3>{w.parts}</h3>
                  <ol className="cheil-formula-parts" data-testid="formula-parts">
                    {reply.parts.map((part, i) => (
                      <li key={i}>
                        <button
                          className="btn"
                          aria-pressed={selectedPart === part.expression}
                          onClick={() =>
                            setSelectedPart(selectedPart === part.expression ? '' : part.expression)
                          }
                        >
                          <code>{part.expression}</code>
                        </button>
                        <p>{part.meaning}</p>
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}
              {reply.steps.length ? (
                <>
                  <h3>{w.steps}</h3>
                  <ol>
                    {reply.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </>
              ) : null}
              {reply.alternatives.length ? (
                <>
                  <h3>{w.alternatives}</h3>
                  <div className="cheil-formula-alternatives" data-testid="formula-alternatives">
                    {reply.alternatives.map((a, i) => (
                      <section key={i}>
                        <div className="cheil-formula-heading">
                          <h4>{a.label}</h4>
                          <button
                            className="btn"
                            data-testid={`formula-copy-alternative-${i}`}
                            disabled={stale || busy}
                            onClick={() => onCopy(a.formula)}
                          >
                            {w.copy}
                          </button>
                        </div>
                        <pre>
                          <code>{a.formula}</code>
                        </pre>
                        <p>
                          <strong>{w.when}</strong> · {a.when}
                        </p>
                        <p>
                          <strong>{w.tradeoff}</strong> · {a.tradeoff}
                        </p>
                        <p className="cheil-formula-help">{a.compatibility}</p>
                      </section>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
          {reply.notes.length ? (
            <>
              <h3>{w.notes}</h3>
              <ul>
                {reply.notes.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          ) : null}
          {reply.compatibility ? (
            <>
              <h3>{w.compatible}</h3>
              <p>{reply.compatibility}</p>
            </>
          ) : null}
        </>
      ) : (
        <div className="cheil-formula-empty">
          <h3>{busy ? w.busy : w.empty}</h3>
          {!busy ? <p>{w.emptySub}</p> : null}
        </div>
      )}
    </section>
  )
}
