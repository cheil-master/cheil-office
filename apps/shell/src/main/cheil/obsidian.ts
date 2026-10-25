/**
 * Cheil fork (plan item 13, with the person's request of 10-26): campaigns as
 * Obsidian notes. Once the person picks their vault, the app keeps a "Cheil"
 * folder there in step with the campaigns:
 *
 *   Cheil/<campaign>/<campaign>.md        card, timeline, links to the rest
 *   Cheil/<campaign>/문서/<title>.md       each document in the campaign folder, as text
 *   Cheil/<campaign>/주고받은 메일.md        received mails pasted in and drafts copied, appended
 *   Cheil/내 양식/<title>.md               the report a template of the person's own came from
 *
 * The vault is a folder on this PC; nothing is sent anywhere (a vault the
 * person syncs to a cloud is their choice). Notes are written whole, so an
 * edit the person makes in a campaign or document note is replaced on the
 * next change; the mail note is only appended to. No Electron.
 */
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CampaignDetail } from '../../shared/cheil-campaign-api'
import { CARD_LABELS, localTime } from './campaign-store'

export const OBSIDIAN_ROOT = 'Cheil'
export const MAIL_NOTE = '주고받은 메일'
export const TEMPLATE_NOTES = '내 양식'

/** A note name Obsidian and Windows both take */
export function obsidianNoteName(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')
      .slice(0, 120) || '노트'
  )
}

const yamlValue = (v: string) => JSON.stringify(v)

/**
 * A document's text (file-parse's form) as Markdown: "a | b" rows become a
 * table, '#' headings and '- ' items stay, other lines become paragraphs
 */
export function obsidianText(text: string): string {
  const out: string[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes(' | ')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i]!.includes(' | ')) {
        rows.push(lines[i]!.split(' | ').map((c) => c.trim().replace(/\|/g, '\\|')))
        i++
      }
      i--
      const width = Math.max(...rows.map((r) => r.length))
      const row = (cells: string[]) =>
        `| ${Array.from({ length: width }, (_, k) => cells[k] ?? '').join(' | ')} |`
      out.push('', row(rows[0]!), `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(row), '')
    } else {
      out.push(line)
    }
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** The campaign note: what Obsidian shows for one campaign */
export function campaignNote(
  detail: CampaignDetail,
  documents: string[],
  hasMail: boolean,
): string {
  const { card } = detail
  const base = `${OBSIDIAN_ROOT}/${obsidianNoteName(detail.id)}`
  const lines = [
    '---',
    `campaign: ${yamlValue(card.campaign)}`,
    `client: ${yamlValue(card.client)}`,
    ...(card.start || card.end
      ? [`period: ${yamlValue(`${card.start} ~ ${card.end}`.trim())}`]
      : []),
    `updated: ${yamlValue(localTime(detail.updatedAt))}`,
    'tags: [cheil/campaign]',
    '---',
    '',
    `# ${card.client ? `${card.client} · ` : ''}${card.campaign}`,
    '',
    '| 항목 | 내용 |',
    '| --- | --- |',
  ]
  for (const key of Object.keys(CARD_LABELS) as Array<keyof typeof CARD_LABELS>) {
    const value = (card[key] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
    if (value) lines.push(`| ${CARD_LABELS[key]} | ${value} |`)
  }
  if (documents.length || hasMail) {
    lines.push('', '## 문서와 메일', '')
    for (const title of documents) {
      lines.push(`- [[${base}/문서/${obsidianNoteName(title)}|${title}]]`)
    }
    if (hasMail) lines.push(`- [[${base}/${MAIL_NOTE}|${MAIL_NOTE}]]`)
  }
  lines.push('', `## 타임라인 (${detail.timeline.length}건)`, '')
  for (const event of detail.timeline) {
    const due = event.due ? ` (마감 ${event.due})` : ''
    lines.push(`- ${localTime(event.at)} · ${event.text.replace(/\n/g, ' ')}${due}`)
  }
  lines.push('', `_Cheil 기획 오피스가 쓰는 노트입니다. 고친 내용은 다음 변경 때 다시 쓰여요._`, '')
  return lines.join('\n')
}

/** A document's note */
export function documentNote(input: {
  title: string
  source: string
  campaign: string
  text: string
  updatedAt: string
}): string {
  return [
    '---',
    `source: ${yamlValue(input.source)}`,
    ...(input.campaign ? [`campaign: ${yamlValue(input.campaign)}`] : []),
    `updated: ${yamlValue(input.updatedAt)}`,
    'tags: [cheil/document]',
    '---',
    '',
    `# ${input.title}`,
    '',
    obsidianText(input.text),
    '',
  ].join('\n')
}

export interface ObsidianDeps {
  /** the JSON file that keeps the vault folder */
  settingsPath(): string
  /** a document's text; null when it cannot be read */
  readText(path: string): Promise<string | null>
  campaign(id: string): Promise<CampaignDetail | null>
  /** the documents in a campaign's folder */
  documents(id: string): Promise<Array<{ path: string; title: string }>>
  /** wait before writing a campaign's notes after a change (ms) */
  delayMs?: number
}

export function createObsidianLink(deps: ObsidianDeps) {
  /** a document's last written time, so an unchanged one is not read again */
  const written = new Map<string, number>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  async function vault(): Promise<string | null> {
    try {
      const raw = JSON.parse(await readFile(deps.settingsPath(), 'utf8')) as {
        obsidianVault?: unknown
      }
      return typeof raw.obsidianVault === 'string' && raw.obsidianVault ? raw.obsidianVault : null
    } catch {
      return null
    }
  }

  async function writeNote(path: string, text: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, text, 'utf8')
  }

  const exists = (path: string) =>
    stat(path).then(
      () => true,
      () => false,
    )

  /** Write a campaign's notes into the vault; false when no vault is set or it failed */
  async function syncCampaign(id: string): Promise<boolean> {
    const root = await vault()
    if (!root) return false
    const detail = await deps.campaign(id)
    if (!detail) return false
    const folder = join(root, OBSIDIAN_ROOT, obsidianNoteName(id))
    try {
      const docs = await deps.documents(id)
      for (const doc of docs) {
        const info = await stat(doc.path).catch(() => null)
        if (!info) continue
        const note = join(folder, '문서', `${obsidianNoteName(doc.title)}.md`)
        if (written.get(doc.path) === info.mtimeMs && (await exists(note))) continue
        const text = await deps.readText(doc.path).catch(() => null)
        if (text === null) continue
        await writeNote(
          note,
          documentNote({
            title: doc.title,
            source: doc.path,
            campaign: detail.card.campaign,
            text,
            updatedAt: localTime(info.mtime.toISOString()),
          }),
        )
        written.set(doc.path, info.mtimeMs)
      }
      const hasMail = await exists(join(folder, `${MAIL_NOTE}.md`))
      await writeNote(
        join(folder, `${obsidianNoteName(id)}.md`),
        campaignNote(
          detail,
          docs.map((d) => d.title),
          hasMail,
        ),
      )
      return true
    } catch {
      return false
    }
  }

  return {
    vault,
    async setVault(path: string | null): Promise<void> {
      let raw: Record<string, unknown> = {}
      try {
        raw = JSON.parse(await readFile(deps.settingsPath(), 'utf8')) as Record<string, unknown>
      } catch {
        // a first setting
      }
      if (path) raw.obsidianVault = path
      else delete raw.obsidianVault
      written.clear()
      await mkdir(dirname(deps.settingsPath()), { recursive: true })
      await writeFile(deps.settingsPath(), `${JSON.stringify(raw, null, 2)}\n`, 'utf8')
    },
    syncCampaign,
    /** a change to a campaign: its notes are written a moment later, once */
    schedule(id: string): void {
      clearTimeout(timers.get(id))
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id)
          void syncCampaign(id)
        }, deps.delayMs ?? 800),
      )
    },
    /** a mail pasted in or a draft copied: appended to the campaign's mail note */
    async appendMail(
      id: string,
      entry: { kind: 'received' | 'draft'; title: string; text: string; at: string },
    ): Promise<boolean> {
      const root = await vault()
      if (!root || !entry.text.trim()) return false
      const path = join(root, OBSIDIAN_ROOT, obsidianNoteName(id), `${MAIL_NOTE}.md`)
      try {
        await mkdir(dirname(path), { recursive: true })
        if (!(await exists(path))) {
          await writeFile(
            path,
            `---\ncampaign: ${yamlValue(id)}\ntags: [cheil/mail]\n---\n\n# ${MAIL_NOTE}\n`,
            'utf8',
          )
        }
        const head = entry.kind === 'received' ? '받은 메일' : '보낸 메일 초안'
        const title = entry.title ? ` — ${entry.title.replace(/\n/g, ' ')}` : ''
        await appendFile(
          path,
          `\n## ${localTime(entry.at)} · ${head}${title}\n\n${entry.text.trim()}\n`,
          'utf8',
        )
        return true
      } catch {
        return false
      }
    },
    /** the report a template of the person's own came from, as a note */
    async writeTemplateSource(title: string, source: string, text: string): Promise<boolean> {
      const root = await vault()
      if (!root) return false
      try {
        await writeNote(
          join(root, OBSIDIAN_ROOT, TEMPLATE_NOTES, `${obsidianNoteName(title)}.md`),
          documentNote({
            title,
            source,
            campaign: '',
            text,
            updatedAt: localTime(new Date().toISOString()),
          }),
        )
        return true
      } catch {
        return false
      }
    },
  }
}

export type ObsidianLink = ReturnType<typeof createObsidianLink>
