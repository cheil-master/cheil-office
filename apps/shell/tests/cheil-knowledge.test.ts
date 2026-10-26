import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  classifyKnowledge,
  createKnowledgeBase,
  knowledgePathsOf,
  pastedTitle,
  snippetOf,
  UNSORTED,
} from '../src/main/cheil/knowledge'
import { buildKnowledgeSummaryPrompt } from '../src/renderer/src/cheil/KnowledgeBase'

/**
 * Cheil fork (10-26): the knowledge base — material in, Markdown out, filed by
 * itself under Cheil/지식/<광고주>/<종류>, and searched inside the vault.
 * Virtual names only (가상전자, 에어린, 블루윈드, 오로라7).
 */

let dir: string
let vault: string
let inbox: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cheil-kb-'))
  vault = join(dir, 'vault')
  inbox = join(dir, 'inbox')
  await mkdir(vault, { recursive: true })
  await mkdir(inbox, { recursive: true })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function base(options: { vault?: string | null; advertisers?: string[] } = {}) {
  return createKnowledgeBase({
    vault: async () => (options.vault === undefined ? vault : options.vault),
    // the test files are plain text; a ".locked" one stands for DRM
    readText: async (path) => (path.endsWith('.locked.docx') ? null : readFile(path, 'utf8')),
    advertisers: async () => options.advertisers ?? ['가상전자', '에어린'],
    now: () => '2026-10-26 15:00',
  })
}

async function put(name: string, text: string): Promise<string> {
  const path = join(inbox, name)
  await writeFile(path, text, 'utf8')
  return path
}

describe('classifyKnowledge', () => {
  it('files by the advertiser the material names most and by the kind its name says', () => {
    expect(
      classifyKnowledge(
        '광고주 회의록_0312.docx',
        '가상전자 회의. 에어린 사례 참고. 가상전자 결정.',
        ['가상전자', '에어린'],
      ),
    ).toEqual({ advertiser: '가상전자', kind: '회의록' })
    expect(classifyKnowledge('견적_v2.xlsx', '유튜브 CPM 4,800원', ['가상전자'])).toEqual({
      advertiser: UNSORTED,
      kind: '견적',
    })
  })

  it('reads a mail from its headers, and falls back to 기타', () => {
    expect(
      classifyKnowledge('예산 조정', '보낸 사람: 가상전자\n제목: 예산', ['가상전자']).kind,
    ).toBe('메일')
    expect(classifyKnowledge('메모', '점심 메뉴', []).kind).toBe('기타')
  })

  it('prefers the longer of two names that overlap', () => {
    expect(
      classifyKnowledge('a.docx', '가상전자서비스 건', ['가상전자', '가상전자서비스']).advertiser,
    ).toBe('가상전자서비스')
  })
})

describe('the knowledge base', () => {
  it('turns a file into a note filed under its advertiser and kind', async () => {
    const kb = base()
    const path = await put(
      '오로라7 OT 자료.txt',
      '가상전자 오로라7 OT\n과제 | 봄 인지도\n예산 | 2.0억',
    )
    const res = await kb.addFiles([path])
    expect(res.vault).toBe(true)
    expect(res.added).toEqual([
      expect.objectContaining({
        ok: true,
        advertiser: '가상전자',
        kind: '제안서',
        note: 'Cheil/지식/가상전자/제안서/오로라7 OT 자료.md',
      }),
    ])
    const note = await readFile(
      join(vault, 'Cheil/지식/가상전자/제안서/오로라7 OT 자료.md'),
      'utf8',
    )
    expect(note).toContain('advertiser: "가상전자"')
    expect(note).toContain('# 오로라7 OT 자료')
    // "a | b" rows became a Markdown table
    expect(note).toContain('| 과제 | 봄 인지도 |')
  })

  it('learns an advertiser from a folder the person made in the vault', async () => {
    await mkdir(join(vault, 'Cheil/지식/블루윈드'), { recursive: true })
    const kb = base()
    const path = await put('경쟁 PT 분석.txt', '블루윈드 경쟁 분석. 숏폼 위주.')
    const res = await kb.addFiles([path])
    expect(res.added[0]).toMatchObject({ advertiser: '블루윈드', kind: '분석' })
  })

  it('writes over the note of the same source, and keeps another source apart', async () => {
    const kb = base()
    const first = await put('회의록.txt', '가상전자 회의 1')
    await kb.addFiles([first])
    await writeFile(first, '가상전자 회의 2', 'utf8')
    const again = await kb.addFiles([first])
    expect(again.added[0]!.note).toBe('Cheil/지식/가상전자/회의록/회의록.md')
    const other = join(dir, 'other')
    await mkdir(other)
    const second = join(other, '회의록.txt')
    await writeFile(second, '가상전자 회의 3', 'utf8')
    const apart = await kb.addFiles([second])
    expect(apart.added[0]!.note).toBe('Cheil/지식/가상전자/회의록/회의록 (2).md')
  })

  it('reports what it could not take, and writes nothing without a vault', async () => {
    const kb = base()
    const locked = await put('보고서.locked.docx', 'x')
    const image = await put('사진.png', 'x')
    const empty = await put('빈 메모.txt', '  ')
    const res = await kb.addFiles([locked, image, empty, join(inbox, '없음.docx')])
    expect(res.added.map((a) => a.reason)).toEqual([
      'unreadable',
      'unsupported',
      'empty',
      'unreadable',
    ])
    expect(await base({ vault: null }).addFiles([empty])).toEqual({ vault: false, added: [] })
  })

  it('files a pasted mail by its subject', async () => {
    const kb = base()
    const res = await kb.addText(
      '보낸 사람: 가상전자 마케팅팀\n제목: 오로라7 예산 조정 요청\n\n2.3억으로 늘려 주세요.',
    )
    expect(res.added[0]).toMatchObject({
      ok: true,
      kind: '메일',
      advertiser: '가상전자',
      note: 'Cheil/지식/가상전자/메일/오로라7 예산 조정 요청.md',
    })
  })

  it('searches every note in the vault, the notes holding more words first, Obsidian settings left out', async () => {
    const kb = base()
    await kb.addFiles([await put('OT.txt', '가상전자 오로라7 OT. 예산 2.0억.')])
    await kb.addText('제목: 예산 조정\n가상전자 오로라7 예산 2.3억')
    await kb.addFiles([await put('견적.txt', '에어린 견적 CPM 4,800원')])
    await mkdir(join(vault, '.obsidian'), { recursive: true })
    await writeFile(join(vault, '.obsidian', '예산.md'), '오로라7 예산', 'utf8')
    await writeFile(join(vault, '내 메모.md'), '오로라7 은 봄 출시', 'utf8')

    const res = await kb.search('오로라7 예산')
    expect(res.notes).toBe(4)
    expect(res.hits.map((h) => h.title)).toEqual(['예산 조정', 'OT', '내 메모'])
    expect(res.hits[0]!.matched).toEqual(['오로라7', '예산'])
    expect(res.hits[2]!.folder).toBe('')
    expect((await kb.search('없는말')).hits).toEqual([])
  })

  it('opens only Markdown notes inside the vault', async () => {
    const kb = base()
    await writeFile(join(vault, 'a.md'), 'x', 'utf8')
    expect(await kb.notePathOf('a.md')).toBe(join(vault, 'a.md'))
    expect(await kb.notePathOf('../inbox/a.md')).toBeNull()
    expect(await kb.notePathOf('a.txt')).toBeNull()
    expect(await kb.notePathOf(join(vault, 'a.md'))).toBe(join(vault, 'a.md'))
    expect(await kb.notePathOf('b.md')).toBeNull()
  })

  it('lists the filed notes per advertiser and kind, 미분류 last', async () => {
    const kb = base()
    await kb.addFiles([await put('견적.txt', 'CPM 표')])
    await kb.addFiles([await put('회의록.txt', '에어린 회의')])
    const view = await kb.overview()
    expect(view.vault).toBe(vault)
    expect(view.groups.map((g) => g.advertiser)).toEqual(['에어린', UNSORTED])
    expect(view.groups[0]!.kinds).toEqual([
      { kind: '회의록', notes: ['Cheil/지식/에어린/회의록/회의록.md'] },
    ])
  })
})

describe('the pieces around it', () => {
  it('checks the dropped paths', () => {
    expect(knowledgePathsOf([join(inbox, 'a.docx')])).toEqual([join(inbox, 'a.docx')])
    expect(knowledgePathsOf(['relative.docx'])).toBeNull()
    expect(knowledgePathsOf([])).toBeNull()
    expect(knowledgePathsOf('x')).toBeNull()
  })

  it('titles a pasted text by its subject, else its first line', () => {
    expect(pastedTitle('보낸 사람: a\n제목: 견적 송부\n본문')).toBe('견적 송부')
    expect(pastedTitle('\n\n오늘 회의 메모\n...')).toBe('오늘 회의 메모')
    expect(pastedTitle('   ')).toBe('메모')
  })

  it('cuts a snippet around the first word found', () => {
    const body = `# 제목\n${'가'.repeat(100)} 예산 2.0억 ${'나'.repeat(200)}`
    const snip = snippetOf(body, ['예산'])
    expect(snip.startsWith('…')).toBe(true)
    expect(snip).toContain('예산 2.0억')
    expect(snip.endsWith('…')).toBe(true)
  })

  it('asks the AI to keep to the excerpts and cite each note', () => {
    const { system, user } = buildKnowledgeSummaryPrompt('오로라7 예산', [
      { title: 'OT', snippet: '예산 2.0억' },
    ])
    expect(system).toContain('지어내지 않는다')
    expect(system).toContain('[[노트 제목]]')
    expect(user).toBe('질문: 오로라7 예산\n\n[1] OT\n예산 2.0억')
  })
})
