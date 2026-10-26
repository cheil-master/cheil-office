/**
 * Cheil fork (the person's request of 10-26): "내 지식 베이스" — one place to
 * put material in and to look things up.
 *
 * Drop files (or pick them, or paste a mail or memo): the main process turns
 * each into Markdown and files it by itself under Cheil/지식/<광고주>/<종류>
 * in the Obsidian vault. Search reads the vault's notes on this PC; only
 * "AI 요약" sends the found pieces to a model, through the shared `ai:chat`
 * (the confidentiality line).
 */
import { useCallback, useEffect, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import type { Lang } from '@genoffice/i18n'
import { readAiSettings } from '../settings-ai'
import type {
  CheilCampaignApi,
  KnowledgeAdded,
  KnowledgeHit,
  KnowledgeOverview,
} from '../../../shared/cheil-campaign-api'

const WORDS = {
  ko: {
    title: '내 지식 베이스',
    noVault:
      '먼저 옵시디언 볼트 폴더를 고르세요. 넣은 자료는 그 볼트의 Cheil/지식 폴더에 md 노트로 쌓입니다.',
    pickVault: '볼트 고르기',
    vaultIs: (name: string) => `볼트: ${name}`,
    dropTitle: '관련 자료를 여기에 넣으세요',
    dropHint: '파일을 끌어다 놓거나, 메일·메모를 붙여 넣으면(Ctrl+V) 알아서 md 로 바꿔 분류합니다.',
    pick: '파일 고르기',
    adding: '넣는 중…',
    added: (name: string, adv: string, kind: string) => `${name} → ${adv} › ${kind}`,
    failed: (name: string, why: string) => `${name}: ${why}`,
    reasons: {
      unreadable: '읽지 못했습니다(DRM·암호가 걸렸으면 풀어서 넣어 주세요)',
      unsupported: '넣을 수 없는 형식입니다',
      empty: '글이 없습니다',
      failed: '볼트에 쓰지 못했습니다',
    },
    tree: '분류된 자료',
    treeEmpty: '아직 넣은 자료가 없습니다.',
    searchPlaceholder: '지식 베이스에서 찾기 — 예: 오로라7 예산',
    search: '찾기',
    searched: (hits: number, notes: number) => `볼트 노트 ${notes}개 중 ${hits}개`,
    noHits: '맞는 노트가 없습니다.',
    summarize: 'AI 요약',
    summarizing: 'AI 가 읽는 중…',
    summaryTitle: (n: number) => `AI 요약 · 노트 ${n}개에서`,
    summaryFailed: (why: string) => `AI 에 묻지 못했습니다${why ? `: ${why}` : '.'}`,
    summaryNote:
      '찾은 노트의 발췌만 보냅니다. 대외비·개인정보 표지가 있으면 이 PC 밖 AI 로는 나가지 않습니다.',
  },
  en: {
    title: 'My knowledge base',
    noVault:
      'Pick your Obsidian vault folder first. What you put in is kept as notes in its Cheil/지식 folder.',
    pickVault: 'Pick vault',
    vaultIs: (name: string) => `Vault: ${name}`,
    dropTitle: 'Put related material here',
    dropHint:
      'Drop files, or paste a mail or memo (Ctrl+V): it becomes Markdown and is filed by itself.',
    pick: 'Pick files',
    adding: 'Adding…',
    added: (name: string, adv: string, kind: string) => `${name} → ${adv} › ${kind}`,
    failed: (name: string, why: string) => `${name}: ${why}`,
    reasons: {
      unreadable: 'could not be read (remove DRM or a password first)',
      unsupported: 'not a format it takes',
      empty: 'no text',
      failed: 'could not be written to the vault',
    },
    tree: 'Filed material',
    treeEmpty: 'Nothing put in yet.',
    searchPlaceholder: 'Search the knowledge base',
    search: 'Search',
    searched: (hits: number, notes: number) => `${hits} of ${notes} notes in the vault`,
    noHits: 'No note matches.',
    summarize: 'AI summary',
    summarizing: 'The AI is reading…',
    summaryTitle: (n: number) => `AI summary · from ${n} notes`,
    summaryFailed: (why: string) => `Could not ask the AI${why ? `: ${why}` : '.'}`,
    summaryNote:
      'Only the excerpts found are sent. Marked confidential material never goes to an AI off this PC.',
  },
}
type Words = (typeof WORDS)['ko']

/** how many found notes the AI summary reads */
const SUMMARY_NOTES = 6

/** The question and the found excerpts, for one model call */
export function buildKnowledgeSummaryPrompt(
  query: string,
  hits: Array<Pick<KnowledgeHit, 'title' | 'snippet'>>,
): { system: string; user: string } {
  return {
    system: [
      '너는 광고대행사 기획 AE 의 개인 지식 베이스를 정리하는 도우미다.',
      '주어진 노트 발췌에 있는 사실만 쓴다. 발췌에 없는 숫자·날짜·이름은 지어내지 않는다.',
      '질문에 맞게 3~6개 항목으로 짧게 정리하고, 항목마다 끝에 근거 노트를 [[노트 제목]]으로 붙인다.',
      '노트끼리 숫자나 내용이 다르면 그 사실을 한 줄로 알린다.',
    ].join('\n'),
    user: [
      `질문: ${query}`,
      '',
      ...hits.map((hit, i) => `[${i + 1}] ${hit.title}\n${hit.snippet}`),
    ].join('\n'),
  }
}

/** a piece of text with the query's words marked */
function marked(text: string, words: string[]): ReactNode[] {
  const clean = words.filter(Boolean)
  if (!clean.length) return [text]
  const re = new RegExp(
    `(${clean.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi',
  )
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
}

export function KnowledgeBase({ lang, api }: { lang: Lang; api: CheilCampaignApi }) {
  const w: Words = lang === 'ko' ? WORDS.ko : (WORDS.en as unknown as Words)
  const [overview, setOverview] = useState<KnowledgeOverview | null>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [results, setResults] = useState<KnowledgeAdded[]>([])
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<{
    query: string
    words: string[]
    hits: KnowledgeHit[]
    notes: number
  } | null>(null)
  const [summary, setSummary] = useState<{ busy: boolean; text?: string; error?: string } | null>(
    null,
  )

  const refresh = useCallback(async () => {
    const res = await api.knowledgeOverview().catch(() => null)
    if (res?.ok) setOverview({ vault: res.vault, groups: res.groups })
  }, [api])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const finish = useCallback(
    async (run: () => Promise<{ ok: boolean; added?: KnowledgeAdded[] } | null>) => {
      setBusy(true)
      const res = await run().catch(() => null)
      setBusy(false)
      if (res?.ok && res.added) setResults(res.added)
      await refresh()
    },
    [refresh],
  )

  // a mail or memo pasted anywhere in this view but the search box
  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const target = ev.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const text = ev.clipboardData?.getData('text') ?? ''
      if (!text.trim() || !overview?.vault) return
      ev.preventDefault()
      void finish(() => api.knowledgeAddText(text))
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [api, finish, overview?.vault])

  const onDrop = (ev: DragEvent<HTMLDivElement>) => {
    // claimed here, so the home's drop-to-open does not also open them
    ev.preventDefault()
    setOver(false)
    const home = (window as unknown as { aiOffice?: { pathForFile?(f: File): string } }).aiOffice
    const paths = Array.from(ev.dataTransfer.files)
      .map((file) => home?.pathForFile?.(file) ?? '')
      .filter(Boolean)
    if (paths.length) void finish(() => api.knowledgeAddFiles(paths))
  }

  const runSearch = async (q: string) => {
    const text = q.trim()
    if (!text) return
    setSummary(null)
    const res = await api.knowledgeSearch(text).catch(() => null)
    if (res?.ok) {
      setSearch({ query: text, words: text.split(/\s+/), hits: res.hits, notes: res.notes })
    }
  }

  const summarize = async () => {
    if (!search?.hits.length) return
    setSummary({ busy: true })
    const { system, user } = buildKnowledgeSummaryPrompt(
      search.query,
      search.hits.slice(0, SUMMARY_NOTES),
    )
    const settings = await readAiSettings()
    const reply = await api
      .aiChat({ settings, system, user, json: false })
      .catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }))
    if (reply.ok && 'content' in reply && reply.content)
      setSummary({ busy: false, text: reply.content })
    else setSummary({ busy: false, error: ('error' in reply && reply.error) || '' })
  }

  const open = (note: string) => void api.knowledgeOpen(note)

  if (!overview) return null
  if (!overview.vault) {
    return (
      <main className="content cheil-tool cheil-kb" data-testid="cheil-tool-knowledge">
        <h2 className="cheil-tool-title">{w.title}</h2>
        <p className="cheil-tool-text">{w.noVault}</p>
        <button
          className="btn btn-primary"
          onClick={async () => {
            await api.obsidianPick().catch(() => null)
            await refresh()
          }}
        >
          {w.pickVault}
        </button>
      </main>
    )
  }

  const vaultName = overview.vault.split(/[\\/]/).filter(Boolean).pop() ?? overview.vault
  return (
    <main className="content cheil-tool cheil-kb" data-testid="cheil-tool-knowledge">
      <h2 className="cheil-tool-title">
        {w.title} <span className="cheil-kb-vault">{w.vaultIs(vaultName)}</span>
      </h2>

      <div
        className={`cheil-kb-drop${over ? ' over' : ''}`}
        data-testid="cheil-kb-drop"
        onDragOver={(ev) => {
          ev.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <strong>{w.dropTitle}</strong>
        <span>{w.dropHint}</span>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => void finish(() => api.knowledgePickFiles())}
        >
          {busy ? w.adding : w.pick}
        </button>
        {results.length ? (
          <ul className="cheil-kb-added" role="status">
            {results.map((r, i) => (
              <li key={`${r.name}-${i}`} className={r.ok ? '' : 'bad'}>
                {r.ok && r.note ? (
                  <button className="cheil-kb-link" onClick={() => open(r.note!)}>
                    {w.added(r.name, r.advertiser ?? '', r.kind ?? '')}
                  </button>
                ) : (
                  w.failed(r.name, w.reasons[r.reason ?? 'failed'])
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="cheil-kb-main">
        <section className="cheil-kb-tree" data-testid="cheil-kb-tree">
          <h3>{w.tree}</h3>
          {overview.groups.length === 0 ? <p className="cheil-kb-muted">{w.treeEmpty}</p> : null}
          {overview.groups.map((group) => (
            <details key={group.advertiser} open>
              <summary>{group.advertiser}</summary>
              {group.kinds.map((kind) => (
                <details key={kind.kind} className="cheil-kb-kind" open>
                  <summary>
                    {kind.kind} ({kind.notes.length})
                  </summary>
                  {kind.notes.map((note) => (
                    <button key={note} className="cheil-kb-note" onClick={() => open(note)}>
                      {note.split('/').pop()?.replace(/\.md$/i, '')}
                    </button>
                  ))}
                </details>
              ))}
            </details>
          ))}
        </section>

        <section className="cheil-kb-search">
          <form
            className="cheil-kb-searchbar"
            onSubmit={(ev) => {
              ev.preventDefault()
              void runSearch(query)
            }}
          >
            <input
              value={query}
              placeholder={w.searchPlaceholder}
              onChange={(ev) => setQuery(ev.target.value)}
              data-testid="cheil-kb-query"
            />
            <button className="btn btn-primary" type="submit">
              {w.search}
            </button>
          </form>
          {search ? (
            <>
              <div className="cheil-kb-meta">
                <span>{w.searched(search.hits.length, search.notes)}</span>
                {search.hits.length ? (
                  <button
                    className="btn btn-secondary"
                    disabled={summary?.busy}
                    onClick={() => void summarize()}
                  >
                    {summary?.busy ? w.summarizing : w.summarize}
                  </button>
                ) : null}
              </div>
              {summary && !summary.busy ? (
                <div className="cheil-kb-summary" data-testid="cheil-kb-summary">
                  <div className="cheil-kb-summary-title">
                    {summary.text
                      ? w.summaryTitle(Math.min(search.hits.length, SUMMARY_NOTES))
                      : w.summaryFailed(summary.error ?? '')}
                  </div>
                  {summary.text ? (
                    <div className="cheil-kb-summary-text">{summary.text}</div>
                  ) : null}
                </div>
              ) : null}
              {search.hits.length === 0 ? <p className="cheil-kb-muted">{w.noHits}</p> : null}
              <div className="cheil-kb-hits" data-testid="cheil-kb-hits">
                {search.hits.map((hit) => (
                  <button key={hit.note} className="cheil-kb-hit" onClick={() => open(hit.note)}>
                    <span className="cheil-kb-path">{hit.folder.split('/').join(' › ')}</span>
                    <span className="cheil-kb-hit-title">{marked(hit.title, search.words)}</span>
                    <span className="cheil-kb-snippet">{marked(hit.snippet, search.words)}</span>
                  </button>
                ))}
              </div>
              {search.hits.length ? <p className="cheil-kb-muted small">{w.summaryNote}</p> : null}
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}
