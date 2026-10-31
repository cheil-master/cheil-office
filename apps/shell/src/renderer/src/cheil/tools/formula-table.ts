/** Cheil fork: bounded sample tables; values leave this module only by explicit opt-in. */
export const TABLE_ROWS_MAX = 20
export const TABLE_COLS_MAX = 8
export const TABLE_CELL_MAX = 256
export interface FormulaTable {
  range: string
  target: string
  firstRowHeaders: boolean
  columns: Array<{ column: string; header?: string }>
  dataStartRow: number
  dataRowCount: number
  valuesIncluded: boolean
  sampleRows?: string[][]
}
export function columnName(index: number): string {
  let text = ''
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26))
    text = String.fromCharCode(65 + ((n - 1) % 26)) + text
  return text
}
export function cellAddress(text: string): { column: number; row: number; address: string } | null {
  const match = /^\$?([A-Z]{1,3})\$?([1-9]\d{0,6})$/i.exec(text.trim())
  if (!match) return null
  const column = [...match[1]!.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
  const row = Number(match[2])
  return column <= 16384 && row <= 1048576
    ? { column, row, address: `${columnName(column)}${row}` }
    : null
}
export function buildFormulaTable(
  grid: string[][],
  start: string,
  target: string,
  headers: boolean,
  includeValues: boolean,
): FormulaTable | null {
  const at = cellAddress(start),
    to = cellAddress(target),
    width = grid[0]?.length ?? 0
  if (
    !at ||
    !to ||
    !width ||
    width > TABLE_COLS_MAX ||
    grid.length < 1 ||
    grid.length > TABLE_ROWS_MAX ||
    at.column + width - 1 > 16384 ||
    at.row + grid.length - 1 > 1048576
  )
    return null
  if (
    grid.some(
      (row) =>
        row.length !== width || row.some((v) => typeof v !== 'string' || v.length > TABLE_CELL_MAX),
    )
  )
    return null
  return {
    range: `${at.address}:${columnName(at.column + width - 1)}${at.row + grid.length - 1}`,
    target: to.address,
    firstRowHeaders: headers,
    columns: grid[0]!.map((value, c) => ({
      column: columnName(at.column + c),
      ...(headers ? { header: value } : {}),
    })),
    dataStartRow: at.row + (headers ? 1 : 0),
    dataRowCount: grid.length - (headers ? 1 : 0),
    valuesIncluded: includeValues,
    ...(includeValues ? { sampleRows: grid.slice(headers ? 1 : 0).map((row) => [...row]) } : {}),
  }
}
/** Read Excel clipboard TSV, including quoted cells, without silently truncating it. */
export function parseTablePaste(text: string): string[][] | null {
  if (!text || text.length > 50000) return null
  const rows: string[][] = [],
    row: string[] = []
  let value = '',
    quoted = false,
    closed = false
  const cell = () => {
    row.push(value)
    value = ''
    closed = false
  }
  const line = () => {
    cell()
    rows.push([...row])
    row.length = 0
  }
  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          value += '"'
          i++
        } else {
          quoted = false
          closed = true
        }
      } else value += ch
    } else if (ch === '\t') cell()
    else if (ch === '\n') line()
    else if (ch === '"' && !value && !closed) quoted = true
    else {
      if (closed) return null
      value += ch
    }
    if (
      value.length > TABLE_CELL_MAX ||
      row.length > TABLE_COLS_MAX ||
      rows.length > TABLE_ROWS_MAX
    )
      return null
  }
  if (quoted) return null
  if (value || row.length || !source.endsWith('\n')) line()
  if (!rows.length || rows.length > TABLE_ROWS_MAX || rows.some((r) => r.length > TABLE_COLS_MAX))
    return null
  const width = Math.max(...rows.map((r) => r.length))
  return rows.map((r) => [...r, ...Array<string>(width - r.length).fill('')])
}
export function pasteFormulaTable(
  grid: string[][],
  text: string,
  row: number,
  col: number,
): string[][] | null {
  const values = parseTablePaste(text)
  if (
    !values ||
    row < 0 ||
    col < 0 ||
    row + values.length > TABLE_ROWS_MAX ||
    col + values[0]!.length > TABLE_COLS_MAX
  )
    return null
  const height = Math.max(grid.length, row + values.length),
    width = Math.max(grid[0]?.length ?? 0, col + values[0]!.length)
  const next = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => grid[r]?.[c] ?? ''),
  )
  values.forEach((line, r) =>
    line.forEach((v, c) => {
      next[row + r]![col + c] = v
    }),
  )
  return next
}
