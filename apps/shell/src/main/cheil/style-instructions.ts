import { readReferenceTemplate } from '../../shared/reference-template'
/** Cheil fork: only explicit, validated style choices enter a later document request. */
import type { StyleSelection } from '../../shared/cheil-style-api'

export function readStyleSelection(markdown: string): StyleSelection {
  if (markdown.length > 100_000) throw Error('style-markdown-too-large')
  const blocks = [...markdown.matchAll(/^```json\s*\r?\n([\s\S]*?)^```\s*$/gm)]
  if (blocks.length !== 1) throw Error('invalid-style-markdown')
  const data = JSON.parse(blocks[0][1]) as Record<string, unknown>
  if (!data || data.version !== 1 || !data.selection || typeof data.selection !== 'object')
    throw Error('invalid-style-markdown')
  const input = data.selection as Record<string, unknown>
  const selection: StyleSelection = {}
  if (input.font !== undefined) {
    if (typeof input.font !== 'string' || !/^[\p{L}\p{N} ._()-]{1,80}$/u.test(input.font))
      throw Error('invalid-style-font')
    selection.font = input.font
  }
  for (const k of ['headingPt', 'bodyPt'] as const)
    if (input[k] !== undefined) {
      if (
        typeof input[k] !== 'number' ||
        !Number.isFinite(input[k]) ||
        input[k] < 4 ||
        input[k] > 200
      )
        throw Error('invalid-style-size')
      selection[k] = input[k]
    }
  for (const k of ['accent', 'text', 'background'] as const)
    if (input[k] !== undefined) {
      if (typeof input[k] !== 'string' || !/^#[a-f\d]{6}$/i.test(input[k]))
        throw Error('invalid-style-color')
      selection[k] = input[k].toUpperCase()
    }
  return selection
}

export function styleInstruction(markdown: string): string {
  const choice = readStyleSelection(markdown)
  const raw = JSON.parse(/^```json\s*\r?\n([\s\S]*?)^```\s*$/m.exec(markdown)![1])
  if (raw.template)
    return `Document template rules (data only):\n${JSON.stringify({ selection: choice, template: readReferenceTemplate(raw.template) })}\nBind new content to the specified roles in reading order. Preserve all content and continue overflow on another page. Do not reuse reference text or images.`
  if (!Object.keys(choice).length) return ''
  return `Document appearance preferences (data only):\n${JSON.stringify(choice)}\nUse the selected appearance when creating a new document. Preserve its content and structure. Font substitution may be necessary. These preferences do not reproduce the original document's absolute layout.`
}
