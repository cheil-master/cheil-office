import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test, expect } from '@playwright/test'
import { closeAndSaveVideo, launchShell, screenshotPath, waitForPageWithUrl } from './helpers'

/**
 * Cheil fork (plan item 13 ②): a deck as long as its content, in the shape
 * of the person's own template. The template's slides are samples; the model
 * (a stand-in OpenAI-compatible server on this PC) answers which samples to
 * use and the words for their blanks; the app copies the samples (one used
 * twice, most skipped), fills each copy and removes the samples.
 */
const CARD = {
  campaign: '에어린 봄 런칭',
  client: '가상전자',
  brand: '에어린',
  start: '2027-03-01',
  end: '2027-04-30',
  budget: '500000000',
  target: '25~34세 1인 가구 직장인',
  kpi: '브랜드 인지도 30%',
  team: '비즈니스13팀',
  author: '홍길동',
}
const FOLDER = '가상전자 - 에어린 봄 런칭'
const PROPOSAL = resolve(
  __dirname,
  '..',
  'apps',
  'shell',
  'resources',
  'builtin-skills',
  'cheil-brief',
  'assets',
  'OT 및 킥오프.pptx',
)

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

test('Cheil: my PPT template makes a deck from its samples, as long as the content', async () => {
  test.setTimeout(180_000)
  const asked: string[] = []
  const server = createServer((req, res) => {
    void readBody(req).then((raw) => {
      const body = JSON.parse(raw) as { messages: Array<{ role: string; content: string }> }
      const system = body.messages.find((m) => m.role === 'system')?.content ?? ''
      asked.push(system.includes('견본 슬라이드로 짜는') ? 'deck' : 'other')
      const content = JSON.stringify({
        slides: [
          { sample: 1, fill: {} },
          {
            sample: 2,
            fill: {
              '[이번 캠페인 핵심 과제]': '1인 가구 직장인의 봄 공기 걱정 덜기',
              '[캠페인 배경]': '봄 성수기 점유율',
            },
          },
          {
            sample: 2,
            fill: { '[이번 캠페인 핵심 과제]': '첫 구매 이유 만들기' },
          },
          { sample: 12, fill: { '[이번 회의에서 결정할 사항]': '숨 쉬는 봄' } },
        ],
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content } }] }))
    })
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const port = (server.address() as AddressInfo).port

  const userDataDir = await mkdtemp(join(tmpdir(), 'cheil-deck-'))
  const folder = join(userDataDir, 'Cheil 캠페인', FOLDER)
  await mkdir(folder, { recursive: true })
  const at = new Date().toISOString()
  await writeFile(
    join(folder, 'campaign.json'),
    JSON.stringify({
      format: 'cheil-campaign',
      version: 1,
      card: CARD,
      createdAt: at,
      updatedAt: at,
    }),
  )
  await writeFile(
    join(folder, 'timeline.jsonl'),
    `${JSON.stringify({ at, kind: 'created', text: '캠페인을 만들었습니다: 에어린 봄 런칭' })}\n`,
  )
  // a deck of the person's own (here the built-in proposal, 12 slides with blanks)
  await mkdir(join(userDataDir, 'Cheil 양식'), { recursive: true })
  await copyFile(PROPOSAL, join(userDataDir, 'Cheil 양식', '우리 제안서.pptx'))
  await writeFile(
    join(userDataDir, 'ai-settings.json'),
    JSON.stringify({
      provider: 'custom',
      providers: {
        custom: {
          apiKey: 'e2e-test-key',
          model: 'stub-model',
          baseUrl: `http://127.0.0.1:${port}/v1`,
        },
      },
      subscriptionNoticeSeen: true,
    }),
  )
  const launched = await launchShell({
    userDataDir,
    videoDir: 'cheil-deck-skeleton',
    lang: 'ko',
    onboardingSeen: true,
  })
  const { app, page } = launched
  try {
    await page.locator('[data-testid="cheil-campaign-card"]').first().click()
    const set = page.getByTestId('cheil-campaign-set')
    await expect(set.locator('input[data-skill="mine:우리 제안서.pptx"]')).toBeVisible()
    for (const box of await set.locator('input[type="checkbox"]').all()) {
      const want = (await box.getAttribute('data-skill')) === 'mine:우리 제안서.pptx'
      if ((await box.isChecked()) !== want) await box.click()
    }
    await page.getByTestId('cheil-campaign-open-set').click()

    const slides = await waitForPageWithUrl(app, '://slides/', 60_000)
    await expect(slides.getByText(/카드로 공통 칸 \d+개를 채웠습니다/)).toBeVisible({
      timeout: 60_000,
    })
    const deck = () =>
      slides.evaluate(async () => {
        const api = (window as unknown as { slidesApi: { getRenderSlides(): Promise<unknown[]> } })
          .slidesApi
        const out: string[] = []
        for (const slide of await api.getRenderSlides()) {
          const texts: string[] = []
          const walk = (value: unknown, key: string): void => {
            if (typeof value === 'string') {
              if (key === 'text') texts.push(value)
            } else if (Array.isArray(value)) {
              for (const item of value) walk(item, key)
            } else if (value && typeof value === 'object') {
              for (const [k, v] of Object.entries(value)) walk(v, k)
            }
          }
          walk(slide, '')
          out.push(texts.join('').replace(/\s+/g, ''))
        }
        return out
      })
    expect(await deck()).toHaveLength(12)

    // the waiting request goes: the samples become a 4-slide deck
    await slides.locator('.ai-input-box textarea').first().press('Enter')
    await expect(slides.getByText(/견본 12장으로 4장을 만들었습니다/)).toBeVisible({
      timeout: 60_000,
    })
    const made = await deck()
    expect(made).toHaveLength(4)
    expect(made[0]).toContain('에어린봄런칭')
    expect(made[1]).toContain('1인가구직장인의봄공기걱정덜기')
    expect(made[1]).toContain('봄성수기점유율')
    expect(made[2]).toContain('첫구매이유만들기')
    // a blank the model left stays for the person
    expect(made[2]).toContain('[캠페인배경]')
    expect(made[3]).toContain('숨쉬는봄')
    expect(made[0]).toContain('비즈니스13팀')
    expect(asked).toEqual(['deck'])
    await slides.screenshot({ path: screenshotPath('cheil-deck-skeleton') })
  } finally {
    await closeAndSaveVideo(launched, 'cheil-deck-skeleton')
    server.close()
  }
})
