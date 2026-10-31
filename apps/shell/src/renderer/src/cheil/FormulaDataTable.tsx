/** Cheil fork: manual/clipboard sample input, independent of the sheet editor. */
import type { ClipboardEvent } from 'react'
import {
  cellAddress,
  columnName,
  pasteFormulaTable,
  TABLE_CELL_MAX,
  TABLE_COLS_MAX,
  TABLE_ROWS_MAX,
} from './tools/formula-table'
import type { FormulaWords } from './tools/formula-words'
export interface FormulaTableState {
  grid: string[][]
  start: string
  target: string
  headers: boolean
  includeValues: boolean
}
export const emptyFormulaTable = (): FormulaTableState => ({
  grid: Array.from({ length: 5 }, () => Array<string>(4).fill('')),
  start: 'A1',
  target: 'E2',
  headers: true,
  includeValues: false,
})
export function FormulaDataTable({
  value,
  onChange,
  onError,
  onExample,
  w,
}: {
  value: FormulaTableState
  onChange: (value: FormulaTableState) => void
  onError: (message: string) => void
  onExample: () => void
  w: FormulaWords
}) {
  const { grid } = value,
    start = cellAddress(value.start)
  const update = (r: number, c: number, text: string) =>
    onChange({
      ...value,
      grid: grid.map((row, ri) => row.map((v, ci) => (r === ri && c === ci ? text : v))),
    })
  const paste = (event: ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = event.clipboardData.getData('text/plain')
    if (!/[\t\r\n]/.test(text)) return
    event.preventDefault()
    const next = pasteFormulaTable(grid, text, r, c)
    if (!next) {
      onError(w.pasteBad)
      return
    }
    onChange({ ...value, grid: next })
  }
  return (
    <div className="cheil-formula-table">
      <div className="cheil-formula-heading">
        <h3>{w.table}</h3>
        <button className="btn" onClick={onExample} data-testid="formula-table-example">
          {w.tableExample}
        </button>
      </div>
      <p className="cheil-formula-help">{w.tableHint}</p>
      <div className="cheil-formula-top">
        <label>
          {w.start}
          <input
            value={value.start}
            maxLength={12}
            data-testid="formula-table-start"
            onChange={(e) => onChange({ ...value, start: e.target.value })}
          />
        </label>
        <label>
          {w.target}
          <input
            value={value.target}
            maxLength={12}
            data-testid="formula-table-target"
            onChange={(e) => onChange({ ...value, target: e.target.value })}
          />
        </label>
      </div>
      <div className="cheil-formula-grid-scroll">
        <table style={{ minWidth: (grid[0]!.length + 1) * 64 }}>
          <thead>
            <tr>
              <th aria-label="row" />
              {grid[0]!.map((_, c) => (
                <th key={c}>{columnName((start?.column ?? 1) + c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                <th>{(start?.row ?? 1) + r}</th>
                {row.map((cell, c) => (
                  <td key={c}>
                    <input
                      maxLength={TABLE_CELL_MAX}
                      aria-label={`${columnName((start?.column ?? 1) + c)}${(start?.row ?? 1) + r}`}
                      data-testid={`formula-cell-${r}-${c}`}
                      value={cell}
                      onChange={(e) => update(r, c, e.target.value)}
                      onPaste={(e) => paste(e, r, c)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cheil-formula-inline">
        <button
          className="btn"
          disabled={grid.length >= TABLE_ROWS_MAX}
          onClick={() =>
            onChange({ ...value, grid: [...grid, Array<string>(grid[0]!.length).fill('')] })
          }
        >
          {w.addRow}
        </button>
        <button
          className="btn"
          disabled={grid[0]!.length >= TABLE_COLS_MAX}
          onClick={() => onChange({ ...value, grid: grid.map((row) => [...row, '']) })}
        >
          {w.addCol}
        </button>
      </div>
      <label className="cheil-formula-check">
        <input
          type="checkbox"
          checked={value.headers}
          onChange={(e) => onChange({ ...value, headers: e.target.checked })}
        />
        {w.headers}
      </label>
      <label className="cheil-formula-check">
        <input
          type="checkbox"
          data-testid="formula-include-values"
          checked={value.includeValues}
          onChange={(e) => onChange({ ...value, includeValues: e.target.checked })}
        />
        {w.include}
      </label>
      <p className="cheil-formula-help">{value.includeValues ? w.includeNote : w.excludeNote}</p>
    </div>
  )
}
