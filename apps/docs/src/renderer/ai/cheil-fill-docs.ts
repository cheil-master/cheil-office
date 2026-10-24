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
  const { state } = editor
  const hits: Array<{ from: number; to: number; text: string; marks: readonly Mark[] }> = []
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    for (const pair of pairs) {
      let at = node.text.indexOf(pair.find)
      while (at !== -1) {
        hits.push({
          from: pos + at,
          to: pos + at + pair.find.length,
          text: pair.replace,
          marks: node.marks,
        })
        at = node.text.indexOf(pair.find, at + pair.find.length)
      }
    }
  })
  if (hits.length === 0) return 0
  const tr = state.tr
  // back to front, so earlier positions stay valid
  for (const hit of hits.sort((a, b) => b.from - a.from)) {
    if (hit.text) tr.replaceWith(hit.from, hit.to, state.schema.text(hit.text, hit.marks))
    else tr.delete(hit.from, hit.to)
  }
  editor.view.dispatch(tr)
  return hits.length
}
