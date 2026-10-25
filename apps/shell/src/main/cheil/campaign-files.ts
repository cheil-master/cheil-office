/**
 * Cheil fork (plan item 5): a campaign's documents are the Word, PowerPoint
 * and Excel files in its folder. A set writes its templates' copies there; a
 * tab belongs to the campaign whose folder holds its file, so it still does
 * after a close, a reopen or a restart; a card change looks there for the
 * closed ones. Paths only: the shell does the file and tab work.
 */
import { basename, dirname, extname, resolve } from 'node:path'
import { isCampaignId } from './campaign-store'

/** the documents a card change reaches: the editors that answer one */
export const CAMPAIGN_DOCUMENT_RE = /\.(docx|pptx|xlsx)$/i

/** most closed documents one card change opens again */
export const REOPEN_MAX = 12

const comparable = (path: string) => {
  const full = resolve(path)
  return process.platform === 'win32' ? full.toLowerCase() : full
}

/** A document file's name, not an Office lock file ("~$…") or a hidden one */
export function isCampaignDocumentName(name: string): boolean {
  return CAMPAIGN_DOCUMENT_RE.test(name) && !name.startsWith('~$') && !name.startsWith('.')
}

/** The title a document shows in the lists: its file name without the extension */
export function campaignDocumentTitle(name: string): string {
  return name.slice(0, name.length - extname(name).length)
}

/** The campaign and title of a document right in a campaign's folder; null for any other file */
export function campaignDocumentOf(
  root: string,
  filePath: string,
): { id: string; title: string } | null {
  const name = basename(filePath)
  if (!isCampaignDocumentName(name)) return null
  const folder = dirname(resolve(filePath))
  const id = basename(folder)
  if (!isCampaignId(id) || comparable(dirname(folder)) !== comparable(root)) return null
  return { id, title: campaignDocumentTitle(name) }
}

/** A name no file in the folder has yet: "제안서.pptx", then "제안서 (2).pptx", … */
export function freeFileName(fileName: string, taken: (name: string) => boolean): string {
  if (!taken(fileName)) return fileName
  const extension = extname(fileName)
  const stem = fileName.slice(0, fileName.length - extension.length)
  for (let i = 2; ; i++) {
    const next = `${stem} (${i})${extension}`
    if (!taken(next)) return next
  }
}
