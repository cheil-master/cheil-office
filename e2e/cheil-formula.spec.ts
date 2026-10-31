/** Cheil fork: exercise all formula workflows through a local stand-in API, never a real account. */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath } from './helpers'

async function fixture() {
  const asked: Array<{ system: string; user: string }> = []
  let next = 'normal'
  const server = createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.from(chunk))
      const body = JSON.parse(Buffer.concat(chunks).toString()) as {
        messages: Array<{ role: string; content: string }>
      }
      const system = body.messages.find((m) => m.role === 'system')?.content ?? ''
      const user = body.messages.find((m) => m.role === 'user')?.content ?? ''
      asked.push({ system, user })
      const payload = JSON.parse(user) as { formula?: string; clarifications?: unknown[] }
      const formula = system.includes('Explain the supplied')
        ? payload.formula!
        : system.includes('Do not use XLOOKUP')
          ? '=INDEX(B2:B100,MATCH(D2,A2:A100,0))'
          : '=SUMIF(B2:B100,"완료",C2:C100)'
      const answer = {
        formula: next === 'questions' && !payload.clarifications?.length ? '' : formula,
        explanation: '입력한 조건에 맞는 값을 반환합니다.',
        steps: ['조건을 확인합니다.', '일치하는 값을 반환합니다.'],
        notes: ['실제 셀 범위를 확인하세요.'],
        compatibility: system.includes('Do not use XLOOKUP')
          ? 'Excel 2016 / 2019 호환'
          : 'Microsoft 365 호환',
        questions:
          next === 'questions' && !payload.clarifications?.length
            ? ['금액은 어느 열에 있나요?']
            : [],
        alternatives: [
          {
            label: '대안 수식',
            formula: '=SUM(C2:C100)',
            when: '전체 합계일 때',
            tradeoff: '조건을 적용하지 않음',
            compatibility: 'Excel 2016 이상',
          },
        ],
        parts: [
          {
            expression: formula.includes('MATCH') ? 'MATCH(D2,A2:A100,0)' : 'B2:B100',
            meaning: '안쪽 계산 또는 조건 범위',
          },
        ],
        changes: [
          {
            what: '함수 변경',
            why: '버전 호환을 고려합니다.',
            effect: '예상 동작은 동일하며 실제 결과는 확인 필요',
          },
        ],
      }
      const content = next === 'broken' ? '잘못된 답' : JSON.stringify(answer)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content } }] }))
    })().catch(() => {
      res.writeHead(500)
      res.end()
    })
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const dir = await mkdtemp(join(tmpdir(), 'cheil-formula-'))
  await writeFile(
    join(dir, 'ai-settings.json'),
    JSON.stringify({
      provider: 'custom',
      providers: {
        custom: {
          apiKey: 'e2e-test-key',
          model: 'stub-model',
          baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
        },
      },
      subscriptionNoticeSeen: true,
    }),
  )
  const launched = await launchShell({
    userDataDir: dir,
    videoDir: 'cheil-formula',
    lang: 'ko',
    onboardingSeen: true,
  })
  await launched.page.getByTestId('cheil-tools-toggle').click()
  await launched.page.locator('[data-tool="formula"]').click()
  return {
    launched,
    asked,
    respond: (value: string) => {
      next = value
    },
    closeServer: () =>
      new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  }
}

test('Cheil: Excel formula creation, explanation, repair and improvement', async () => {
  test.setTimeout(120000)
  const f = await fixture(),
    { page, app } = f.launched
  try {
    await page.setViewportSize({ width: 1280, height: 1100 })
    await expect(page.getByRole('heading', { name: '엑셀 수식 도우미', exact: true })).toBeVisible()
    await expect(page.getByTestId('formula-run')).toBeDisabled()
    await page.getByRole('button', { name: '조건 합계', exact: true }).click()
    expect(f.asked).toHaveLength(0)
    await page.getByTestId('formula-run').click()
    await expect(page.getByTestId('formula-output')).toHaveText('=SUMIF(B2:B100,"완료",C2:C100)', {
      timeout: 20000,
    })
    await page.getByTestId('formula-copy').click()
    // Cheil fork: clipboard writes are async; report only a boolean on failure.
    await expect
      .poll(
        async () =>
          (await app.evaluate(({ clipboard }) => clipboard.readText())) ===
          '=SUMIF(B2:B100,"완료",C2:C100)',
      )
      .toBe(true)
    await expect(page.getByTestId('formula-alternatives')).toContainText('대안 수식')
    await page.getByTestId('formula-copy-alternative-0').click()
    await expect
      .poll(
        async () =>
          (await app.evaluate(({ clipboard }) => clipboard.readText())) === '=SUM(C2:C100)',
      )
      .toBe(true)
    await page.getByTestId('formula-parts').getByRole('button').first().click()
    await expect(page.getByTestId('formula-output').locator('mark')).toHaveText('B2:B100')
    await page.screenshot({ path: screenshotPath('cheil-formula-create') })
    await page.getByTestId('formula-context').fill('금액은 D열입니다.')
    await expect(page.getByTestId('formula-copy')).toBeDisabled()
    await page.getByTestId('formula-tab-explain').click()
    await page.getByTestId('formula-input').fill('=SUMIF(B2:B100,"완료",C2:C100)')
    await page.getByTestId('formula-run').click()
    await expect(page.getByTestId('formula-result')).toContainText('작동 순서', { timeout: 20000 })
    expect(f.asked.at(-1)?.system).toContain('Explain the supplied')
    await page.getByTestId('formula-tab-fix').click()
    await page.getByTestId('formula-version').selectOption('2016')
    await page.getByTestId('formula-input').fill('=XLOOKUP(D2,A2:A100,B2:B100)')
    await page.getByTestId('formula-error').fill('#NAME?')
    await page.getByTestId('formula-run').click()
    await expect(page.getByTestId('formula-output')).toContainText('INDEX', { timeout: 20000 })
    await expect(page.getByTestId('formula-difference')).toContainText('기존 수식')
    expect(f.asked.at(-1)?.system).toContain('Diagnose')
    expect(JSON.parse(f.asked.at(-1)!.user).error).toBe('#NAME?')
    await page.getByTestId('formula-tab-improve').click()
    await page.getByTestId('formula-run').click()
    await expect(page.getByTestId('formula-output')).toBeVisible({ timeout: 20000 })
    expect(f.asked.at(-1)?.system).toContain('Simplify')
    expect(f.asked).toHaveLength(4)
    await page.screenshot({ path: screenshotPath('cheil-formula-improve') })
  } finally {
    await closeAndSaveVideo(f.launched, 'cheil-formula')
    await f.closeServer()
  }
})

test('Cheil: unclear tasks and malformed AI answers stay honest', async () => {
  const f = await fixture(),
    { page } = f.launched
  try {
    await page.getByTestId('formula-request').fill('금액을 합쳐 주세요.')
    f.respond('questions')
    await page.getByTestId('formula-run').click()
    await expect(page.getByTestId('formula-result')).toContainText('금액은 어느 열에 있나요?', {
      timeout: 20000,
    })
    await expect(page.getByTestId('formula-copy')).toHaveCount(0)
    await page.getByTestId('formula-answer-0').fill('B열입니다.')
    await page.getByTestId('formula-followup').click()
    await expect(page.getByTestId('formula-output')).toBeVisible({ timeout: 20000 })
    expect(JSON.parse(f.asked.at(-1)!.user).clarifications).toEqual([
      { question: '금액은 어느 열에 있나요?', answer: 'B열입니다.' },
    ])
    f.respond('broken')
    await page.getByTestId('formula-run').click()
    await expect(page.getByRole('status')).toContainText('읽지 못했습니다', { timeout: 20000 })
    await expect(page.getByTestId('formula-run')).toBeEnabled()
    f.respond('normal')
    await page.getByTestId('formula-run').click()
    await expect(page.getByTestId('formula-output')).toBeVisible({ timeout: 20000 })
  } finally {
    await closeAndSaveVideo(f.launched, 'cheil-formula-recovery')
    await f.closeServer()
  }
})

test('Cheil: sample table paste sends values only after opt-in', async () => {
  const f = await fixture(),
    { page, app } = f.launched
  try {
    await page.getByTestId('formula-tab-data').click()
    await app.evaluate(({ clipboard }) =>
      clipboard.writeText(
        '담당자\t상태\t금액\n가상 A\t완료\tMODEL_ONLY_VALUE_8462\n가상 B\t진행\t200',
      ),
    )
    await page.getByTestId('formula-cell-0-0').click()
    await page.keyboard.press('Control+V')
    await expect(page.getByTestId('formula-cell-1-2')).toHaveValue('MODEL_ONLY_VALUE_8462')
    await expect(page.getByTestId('formula-include-values')).not.toBeChecked()
    await page.getByTestId('formula-request').fill('상태가 완료인 행의 금액을 합산해 주세요.')
    expect(f.asked).toHaveLength(0)
    await page.getByTestId('formula-run').click()
    await expect(page.getByTestId('formula-output')).toBeVisible({ timeout: 20000 })
    let request = JSON.parse(f.asked.at(-1)!.user)
    expect(request.sampleTable.columns[2]).toEqual({ column: 'C', header: '금액' })
    expect(request.sampleTable.valuesIncluded).toBe(false)
    expect(f.asked.at(-1)!.user).not.toContain('MODEL_ONLY_VALUE_8462')
    await page.getByTestId('formula-include-values').check()
    await expect(page.getByTestId('formula-copy')).toBeDisabled()
    await page.getByTestId('formula-run').click()
    await expect(page.getByTestId('formula-output')).toBeVisible({ timeout: 20000 })
    request = JSON.parse(f.asked.at(-1)!.user)
    expect(request.sampleTable.valuesIncluded).toBe(true)
    expect(request.sampleTable.sampleRows[0][2]).toBe('MODEL_ONLY_VALUE_8462')
    await page.screenshot({ path: screenshotPath('cheil-formula-data') })
    await page.getByTestId('formula-table-start').fill('XFE1')
    await page.getByTestId('formula-run').click()
    await expect(page.getByRole('status')).toContainText('셀 주소')
    expect(f.asked).toHaveLength(2)
  } finally {
    await closeAndSaveVideo(f.launched, 'cheil-formula-data')
    await f.closeServer()
  }
})

test('Cheil: local function dictionary requests a version-compatible formula', async () => {
  const f = await fixture(),
    { page } = f.launched
  try {
    await page.getByTestId('formula-tab-dictionary').click()
    await page.getByTestId('formula-dictionary-search').fill('XLOOKUP')
    await page.getByTestId('formula-version').selectOption('2016')
    await expect(page.getByTestId('formula-function-compat')).toContainText('대안 수식')
    expect(f.asked).toHaveLength(0)
    await page.screenshot({ path: screenshotPath('cheil-formula-dictionary') })
    await page.getByTestId('formula-function-use').click()
    await expect(page.getByTestId('formula-tab-create')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('formula-request')).toHaveValue(/XLOOKUP/)
    expect(f.asked).toHaveLength(0)
    await page.getByTestId('formula-run').click()
    await expect(page.getByTestId('formula-output')).toContainText('INDEX', { timeout: 20000 })
    expect(f.asked.at(-1)!.system).toContain('Do not use XLOOKUP')
  } finally {
    await closeAndSaveVideo(f.launched, 'cheil-formula-dictionary')
    await f.closeServer()
  }
})
