/**
 * Cheil fork: the one-call template fill for workbooks (the media plan).
 *
 * A workbook template has two kinds of blanks:
 *
 * - `[placeholders]` inside cell text ("[광고주명] [캠페인명] 미디어 플랜"),
 *   filled like the documents' blanks (cheil-fill.ts);
 * - input tables: a header row (매체, 상품·지면, ...) over empty rows that a
 *   person types into. Columns whose cells hold formulas (CPM, CTR, ...) are
 *   the template's own and are never written. The model answers one array of
 *   row objects per table, keyed by header text.
 *
 * The app reads the cells, the model answers one JSON object
 * `{ "S1": "...", "T1": [ {...}, ... ] }`, and the app writes plain values
 * with the editor's own cell operations. Pure functions only.
 */
import { buildCheilFillPrompt, findCheilSlots, type CheilSlot } from './cheil-fill'

export type SheetCellValue = string | number | boolean | null

export interface SheetSnapshot {
  id: string
  name: string
  /** A1 address → cell; only cells that hold something */
  cells: Readonly<Record<string, { value: SheetCellValue; formula?: string | undefined }>>
}

export interface CheilSheetTable {
  /** T1, T2, ... */
  id: string
  sheetId: string
  sheetName: string
  /** 1-based header row */
  headerRow: number
  /** 1-based rows a person fills */
  rows: number[]
  /** the columns the model fills: letter and header text */
  columns: Array<{ letter: string; header: string }>
}

export interface CheilSheetSlot extends CheilSlot {
  sheetId: string
  address: string
}

export interface CheilSheetPlan {
  slots: CheilSheetSlot[]
  tables: CheilSheetTable[]
}

/** columns and rows a template is read over */
export const SHEET_SCAN_COLUMNS = 'ABCDEFGHIJKL'.split('')
export const SHEET_SCAN_ROWS = 40
/** most rows one table takes (a table without a total row runs to this) */
const TABLE_ROWS_MAX = 15
/** a row whose first cell says this ends the input rows */
const TOTAL_RE = /^(합계|소계|총계|total)$/i
const SLOT_TEXT_RE = /\[[^[\]\n]{1,80}\]/

/** Every address the snapshot of one sheet reads */
export function sheetScanAddresses(): string[] {
  const out: string[] = []
  for (let row = 1; row <= SHEET_SCAN_ROWS; row++) {
    for (const letter of SHEET_SCAN_COLUMNS) out.push(`${letter}${row}`)
  }
  return out
}

const text = (v: SheetCellValue | undefined): string =>
  v === null || v === undefined ? '' : String(v).trim()

/** The blanks and input tables of a workbook */
export function findCheilSheetBlanks(sheets: readonly SheetSnapshot[]): CheilSheetPlan {
  const tables: CheilSheetTable[] = []
  const tableCells = new Set<string>()
  for (const sheet of sheets) {
    const cell = (letter: string, row: number) => sheet.cells[`${letter}${row}`]
    for (let row = 1; row < SHEET_SCAN_ROWS; row++) {
      // a header: three or more neighbouring text cells without blanks or formulas
      const headers = SHEET_SCAN_COLUMNS.map((letter) => {
        const c = cell(letter, row)
        const value = text(c?.value)
        const isHeader =
          !!value && !c?.formula && typeof c?.value === 'string' && !SLOT_TEXT_RE.test(value)
        return { letter, header: isHeader ? value : '' }
      })
      const run = headers.findIndex((h) => h.header)
      if (run < 0) continue
      const named = headers
        .slice(run)
        .filter((h, i, all) => all.slice(0, i + 1).every((x) => x.header))
      if (named.length < 3) continue
      // the rows under it, up to a total row, a formula-only row or the scan end
      const rows: number[] = []
      for (let r = row + 1; r <= SHEET_SCAN_ROWS && rows.length < TABLE_ROWS_MAX; r++) {
        if (TOTAL_RE.test(text(cell(named[0]!.letter, r)?.value))) break
        const filled = named.filter((h) => {
          const c = cell(h.letter, r)
          return !!c && !c.formula && !!text(c.value) && !SLOT_TEXT_RE.test(text(c.value))
        })
        // a row that already holds content is not an empty input row
        if (filled.length > 0) break
        rows.push(r)
      }
      if (rows.length === 0) continue
      const columns = named.filter((h) => rows.every((r) => !cell(h.letter, r)?.formula))
      if (columns.length === 0) continue
      tables.push({
        id: `T${tables.length + 1}`,
        sheetId: sheet.id,
        sheetName: sheet.name,
        headerRow: row,
        rows,
        columns,
      })
      for (const r of rows) for (const c of columns) tableCells.add(`${sheet.id}!${c.letter}${r}`)
      row = rows[rows.length - 1]!
    }
  }
  // placeholders outside the tables, numbered across the workbook
  const slots: CheilSheetSlot[] = []
  const seen = new Set<string>()
  for (const sheet of sheets) {
    for (let row = 1; row <= SHEET_SCAN_ROWS; row++) {
      for (const letter of SHEET_SCAN_COLUMNS) {
        const address = `${letter}${row}`
        const c = sheet.cells[address]
        if (!c || c.formula || typeof c.value !== 'string') continue
        if (tableCells.has(`${sheet.id}!${address}`)) continue
        for (const found of findCheilSlots(c.value)) {
          if (seen.has(found.placeholder)) continue
          seen.add(found.placeholder)
          slots.push({
            id: `S${slots.length + 1}`,
            placeholder: found.placeholder,
            context: `'${sheet.name}' ${address}: ${c.value}`.slice(0, 160),
            sheetId: sheet.id,
            address,
          })
        }
      }
    }
  }
  return { slots, tables }
}

/** The part of the user message that lists the tables to fill */
export function cheilTableLines(tables: readonly CheilSheetTable[]): string[] {
  const lines: string[] = []
  for (const t of tables) {
    lines.push(
      `${t.id}: '${t.sheetName}' 시트 ${t.rows[0]}~${t.rows[t.rows.length - 1]}행, 최대 ${t.rows.length}줄. ` +
        `열: ${t.columns.map((c) => c.header).join(', ')}`,
    )
  }
  if (tables.length > 0) {
    lines.push(
      '표는 줄 객체의 배열로 답한다. 키는 위 열 이름 그대로. 자료에 있는 줄만 쓰고 줄을 지어내지 않는다. ' +
        '금액·노출·클릭 같은 숫자 열은 숫자만(쉼표·단위 없이), 날짜는 YYYY-MM-DD. 자료에 없는 값은 빈 문자열.',
    )
  }
  return lines
}

/** One cell write */
export interface CheilCellWrite {
  sheetId: string
  address: string
  value: string | number
}

const NUMBER_RE = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$|^[+-]?\d+(\.\d+)?$/
const DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/

/** Excel's serial day number of a calendar date (1900 date system) */
export function excelDateSerial(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000)
}

/** A model value as the cell should hold it: numbers as numbers, ISO dates as date serials */
export function cheilCellValue(raw: unknown): string | number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null
  const bare = value.replace(/\s*(원|명|건|회|%)$/, '')
  if (NUMBER_RE.test(bare)) return Number(bare.replace(/,/g, ''))
  const d = DATE_RE.exec(value)
  if (d) {
    const [y, m, day] = [Number(d[1]), Number(d[2]), Number(d[3])]
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) return excelDateSerial(y, m, day)
  }
  return value
}

export interface CheilSheetFillResult {
  writes: CheilCellWrite[]
  /** placeholders written from the material */
  fromMaterial: number
  /** placeholders left for a person */
  open: string[]
  /** table rows written, in all */
  rowsWritten: number
  /** table rows written, per table in plan order */
  rowsByTable: Array<{ sheetName: string; rows: number }>
}

/**
 * The writes an answer makes: each placeholder cell rewritten with its blanks
 * replaced, and each table row's input cells. A sample placeholder in a
 * table's first input row ("[매체]") is overwritten by the first row, and
 * stays for a person when the model wrote no row.
 */
export function cheilSheetWrites(
  sheets: readonly SheetSnapshot[],
  plan: CheilSheetPlan,
  content: string,
): CheilSheetFillResult {
  const result: CheilSheetFillResult = {
    writes: [],
    fromMaterial: 0,
    open: [],
    rowsWritten: 0,
    rowsByTable: [],
  }
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  let answer: Record<string, unknown> = {}
  if (start >= 0 && end > start) {
    try {
      const parsed: unknown = JSON.parse(content.slice(start, end + 1))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        answer = parsed as Record<string, unknown>
      }
    } catch {
      answer = {}
    }
  }
  const byId = new Map(sheets.map((s) => [s.id, s]))
  // placeholder cells: one rewrite per cell, every blank in it replaced
  const cellText = new Map<string, { sheetId: string; address: string; text: string }>()
  for (const slot of plan.slots) {
    const raw = answer[slot.id]
    const value =
      typeof raw === 'string' || typeof raw === 'number'
        ? String(raw)
            .replace(/\s*\n\s*/g, ' ')
            .trim()
        : ''
    if (!value || value === slot.placeholder || /^\[\s*확인 필요/.test(value)) {
      result.open.push(slot.placeholder)
      if (!value || value === slot.placeholder) continue
    } else {
      result.fromMaterial++
    }
    const key = `${slot.sheetId}!${slot.address}`
    const current =
      cellText.get(key)?.text ?? text(byId.get(slot.sheetId)?.cells[slot.address]?.value)
    cellText.set(key, {
      sheetId: slot.sheetId,
      address: slot.address,
      text: current.split(slot.placeholder).join(value),
    })
  }
  for (const c of cellText.values()) {
    result.writes.push({ sheetId: c.sheetId, address: c.address, value: c.text })
  }
  // tables
  for (const table of plan.tables) {
    const raw = answer[table.id]
    const rows = Array.isArray(raw) ? raw.slice(0, table.rows.length) : []
    let written = 0
    rows.forEach((item, i) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return
      const record = item as Record<string, unknown>
      let wrote = false
      for (const column of table.columns) {
        const value = cheilCellValue(record[column.header])
        if (value === null) continue
        result.writes.push({
          sheetId: table.sheetId,
          address: `${column.letter}${table.rows[i]}`,
          value,
        })
        wrote = true
      }
      if (wrote) written++
    })
    result.rowsWritten += written
    result.rowsByTable.push({ sheetName: table.sheetName, rows: written })
  }
  return result
}

/** The model request for a workbook: the documents' prompt plus the tables */
export function buildCheilSheetFillPrompt(input: {
  request: string
  skillText: string
  materials: string
  plan: CheilSheetPlan
}): { system: string; user: string } {
  const base = buildCheilFillPrompt({
    request: input.request,
    skillText: input.skillText,
    materials: input.materials,
    slots: input.plan.slots,
  })
  const keys = [...input.plan.slots.map((s) => s.id), ...input.plan.tables.map((t) => t.id)]
  const tableLines = cheilTableLines(input.plan.tables)
  // the documents' closing line names the slots only: replace it with one that
  // names every key, tables included, after the table list
  const lines = base.user.split('\n').slice(0, -1)
  const user = [
    ...lines,
    ...(tableLines.length ? ['채울 표:', ...tableLines, ''] : []),
    `JSON 객체 하나로만 답하라. 키: ${keys.join(', ')}.`,
  ].join('\n')
  return { system: base.system, user }
}
