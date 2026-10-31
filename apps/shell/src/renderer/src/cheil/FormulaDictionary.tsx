/** Cheil fork: offline function lookup and an explicit handoff to formula creation. */
import { useState } from 'react'
import {
  findFormulaFunctions,
  FORMULA_FUNCTIONS,
  FUNCTION_CATEGORIES,
  functionSupported,
  type FormulaFunction,
  type FunctionCategory,
} from './tools/formula-dictionary'
import type { ExcelVersion } from './tools/formula-tools'
import type { FormulaWords } from './tools/formula-words'
export function FormulaDictionary({
  version,
  ko,
  w,
  onUse,
}: {
  version: ExcelVersion
  ko: boolean
  w: FormulaWords
  onUse: (entry: FormulaFunction) => void
}) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState<FunctionCategory>('all')
  const [selected, setSelected] = useState('SUMIFS')
  const found = findFormulaFunctions(query, category)
  const entry = found.find((f) => f.name === selected) ?? found[0]
  const supported = entry ? functionSupported(entry, version) : false
  return (
    <div className="cheil-formula-workspace" data-testid="formula-dictionary">
      <section>
        <label>
          {w.search}
          <input
            value={query}
            data-testid="formula-dictionary-search"
            placeholder={w.searchHint}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          {w.category}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FunctionCategory)}
          >
            {FUNCTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {w.categories[c]}
              </option>
            ))}
          </select>
        </label>
        <div className="cheil-formula-function-list">
          {found.map((f) => (
            <button
              className="btn"
              key={f.name}
              aria-pressed={entry?.name === f.name}
              onClick={() => setSelected(f.name)}
            >
              <strong>{f.name}</strong>
              <span>{ko ? f.ko : f.en}</span>
            </button>
          ))}
        </div>
        <p className="cheil-formula-help">
          {found.length} / {FORMULA_FUNCTIONS.length} · {w.dictionaryNote}
        </p>
      </section>
      <section className="cheil-formula-result">
        {entry ? (
          <>
            <h3>{entry.name}</h3>
            <p>{ko ? entry.ko : entry.en}</p>
            <p className="cheil-formula-compat" data-testid="formula-function-compat">
              {supported ? w.supported : w.unsupported}
            </p>
            <h3>{w.syntax}</h3>
            <pre>
              <code>{entry.syntax}</code>
            </pre>
            <h3>{w.functionExample}</h3>
            <pre>
              <code>{entry.example}</code>
            </pre>
            <button
              className="btn btn-primary"
              data-testid="formula-function-use"
              onClick={() => onUse(entry)}
            >
              {supported ? w.useFunction : w.useCompatible}
            </button>
            <p className="cheil-formula-help">{w.source}</p>
          </>
        ) : (
          <p>{w.noFunctions}</p>
        )}
      </section>
    </div>
  )
}
