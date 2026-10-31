/** Cheil fork: explicitly gated, single-call connection smoke with fictitious text only. */
import { test, expect } from '@playwright/test'
import { closeAndSaveVideo, launchShell } from './helpers'
import type { CheilCampaignApi } from '../apps/shell/src/shared/cheil-campaign-api'
test('one real selected connection answers a fictitious wiki question', async () => {
  test.skip(
    process.env.CHEIL_REAL_WIKI_AI !== '1',
    'Consumes one real model request only when explicitly authorized',
  )
  test.setTimeout(180000)
  const launched = await launchShell({
    videoDir: 'cheil-wiki-real',
    lang: 'ko',
    onboardingSeen: true,
  })
  try {
    await expect
      .poll(
        async () =>
          launched.page.evaluate(async () => {
            const bridge = (
              window as unknown as {
                aiOfficeSubscription: { statuses(): Promise<Record<string, { state: string }>> }
              }
            ).aiOfficeSubscription
            const statuses = await bridge.statuses()
            return Object.values(statuses).some((status) => status.state === 'ready')
          }),
        { timeout: 45000 },
      )
      .toBe(true)
    const result = await launched.page.evaluate(async () => {
      const api = (window as unknown as { aiOfficeCheilCampaigns: CheilCampaignApi })
        .aiOfficeCheilCampaigns
      const source = await api.wiki({
        op: 'addText',
        title: '오로라7 검수',
        body: '가상 프로젝트 오로라7의 검수 요일은 목요일이다.',
      })
      if (!source.ok) throw new Error('source')
      const context = await api.wiki({ op: 'context', query: '오로라7 검수 요일' })
      if (!context.ok || !context.excerpts?.length) throw new Error('context')
      return api.aiChat({
        settings: { provider: 'auto', providers: {}, subscriptionNoticeSeen: true },
        system:
          '주어진 가상 자료만 근거로 질문에 한 문장으로 답하고 [1]을 붙이세요. 다른 도구를 사용하지 마세요.',
        user: `자료 [1]: ${context.excerpts[0]!.text}\n질문: 오로라7 검수 요일은?`,
        json: false,
      })
    })
    console.log(JSON.stringify({ ok: result.ok, content: result.content, error: result.error }))
    expect(result.ok).toBe(true)
    expect(result.content).toContain('목요일')
  } finally {
    await closeAndSaveVideo(launched, 'cheil-wiki-real')
  }
})
