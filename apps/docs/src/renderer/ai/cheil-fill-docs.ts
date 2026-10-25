/**
 * Cheil fork: the docs side of the one-call template fill.
 *
 * The `findReplace` op scans the text of top-level blocks only, so a blank in
 * a table cell (the brief's header table, the deliverables table) stays. After
 * the op has run, this writes the replacements wherever the blank still
 * appears, table cells included, as one transaction (one undo step). Each
 * replacement keeps the marks of the text it replaces.
 */
import type { Editor } from '@tiptap/core'
import type { Mark } from '@tiptap/pm/model'

export function replaceLeftoverBlanks(
  editor: Editor,
  pairs: ReadonlyArray<{ find: string; replace: string }>,
): number {
  return replaceEverywhere(editor, pairs).reduce((sum, n) => sum + n, 0)
}

/**
 * Every occurrence of each pair's `find` in the document's text, table cells
 * included, replaced in one transaction (one undo step); how many places each
 * pair changed, in order. Where two finds overlap (a brand inside a campaign
 * name), the longer one wins, so no text is replaced twice. Plan item 5 (a
 * campaign card change) uses it as it is.
 */
export function replaceEverywhere(
  editor: Editor,
  pairs: ReadonlyArray<{ find: string; replace: string }>,
): number[] {
  const { state } = editor
  const counts = pairs.map(() => 0)
  const hits: Array<{
    from: number
    to: number
    text: string
    marks: readonly Mark[]
    pair: number
  }> = []
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    pairs.forEach((pair, index) => {
      if (!pair.find) return
      let at = node.text!.indexOf(pair.find)
      while (at !== -1) {
        hits.push({
          from: pos + at,
          to: pos + at + pair.find.length,
          text: pair.replace,
          marks: node.marks,
          pair: index,
        })
        at = node.text!.indexOf(pair.find, at + pair.find.length)
      }
    })
  })
  // longer finds first; a hit overlapping one already taken is dropped
  const taken: typeof hits = []
  for (const hit of [...hits].sort((a, b) => b.to - b.from - (a.to - a.from))) {
    if (taken.some((t) => hit.from < t.to && t.from < hit.to)) continue
    taken.push(hit)
  }
  if (taken.length === 0) return counts
  const tr = state.tr
  // back to front, so earlier positions stay valid
  for (const hit of taken.sort((a, b) => b.from - a.from)) {
    if (hit.text) tr.replaceWith(hit.from, hit.to, state.schema.text(hit.text, hit.marks))
    else tr.delete(hit.from, hit.to)
    counts[hit.pair]!++
  }
  editor.view.dispatch(tr)
  return counts
}
