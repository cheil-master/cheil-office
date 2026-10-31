/** Cheil fork: actual UI/IPC handoff and MD persistence; no live AI or personal account. */
import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { launchShell } from './helpers'
import fixture from '../apps/slides/tests/fixtures/design-reference.json'
test('Pinterest selection opens Slides, saves reusable MD and applies it to a second draft', async () => {
  test.setTimeout(180000)
  const launched = await launchShell({
    lang: 'ko',
    onboardingSeen: true,
    videoDir: 'design-studio',
    env: { GENOFFICE_PREVIEW_LABEL: 'Cheil Office · Design Studio E2E' },
  })
  console.log('stage: shell launched')
  const { app, page } = launched
  try {
    await app.evaluate(async ({ session, nativeImage }) => {
      const s = session.fromPartition('persist:cheil-pinterest')
      await s.cookies.set({
        url: 'https://www.pinterest.com',
        name: '_auth',
        value: '1',
        secure: true,
      })
      s.protocol.handle('https', async (req) => {
        const u = new URL(req.url)
        if (u.hostname === 'i.pinimg.com')
          return new Response(
            nativeImage
              .createFromBitmap(Buffer.from([40, 50, 30, 255]), { width: 1, height: 1 })
              .toPNG(),
            { headers: { 'content-type': 'image/png' } },
          )
        if (u.pathname === '/')
          return new Response(
            '<script type="application/json">{"props":{"initialReduxState":{"session":{"user":{"username":"design-test"}}}}}</script>',
          )
        if (u.pathname.includes('BoardsResource'))
          return Response.json({
            resource_response: {
              data: [
                {
                  id: '111',
                  name: 'Test reference board',
                  url: '/design-test/board/',
                  pin_count: 2,
                },
              ],
            },
          })
        if (u.pathname.includes('BoardFeedResource'))
          return Response.json({
            resource_response: {
              data: [
                {
                  id: '123',
                  title: 'Reference A',
                  images: { '736x': { url: 'https://i.pinimg.com/ref.png' } },
                },
                {
                  id: '456',
                  title: 'Reference B',
                  images: { '736x': { url: 'https://i.pinimg.com/ref2.png' } },
                },
              ],
            },
          })
        return new Response('', { status: 404 })
      })
    })
    console.log('stage: synthetic Pinterest ready')
    await page.getByTestId('cheil-style-mode').click()
    const studio = page.getByTestId('design-studio')
    await studio.getByTestId('design-name').fill('Reusable campaign rules')
    await studio
      .getByTestId('pinterest-panel')
      .getByRole('button', { name: '내 보드 새로고침' })
      .click()
    await studio.getByRole('button', { name: 'Test reference board' }).click()
    await studio.getByRole('checkbox').first().check()
    await studio
      .getByTestId('design-brief')
      .fill(
        'Campaign draft: compare acquisition and retention. Prepare the benefit, test the experience, then improve repeat usage.',
      )
    console.log('stage: selected reference and draft')
    await studio.getByTestId('design-create').click()
    let slidePage: import('@playwright/test').Page | undefined
    await expect
      .poll(() => {
        slidePage = app.windows().find((p) => p.url().includes('/slides/'))
        return !!slidePage
      })
      .toBe(true)
    await slidePage!.waitForFunction(() => !!window.slidesApi)
    // No provider is configured: the real send gate retains the materials and request.
    await expect(slidePage!.locator('[data-slides-ai-input]')).toHaveValue(/디자인 MD 저장하고 PPT 3장 만들기/, {
      timeout: 30000,
    })
    console.log('stage: editor retained request')
    const saved = await slidePage!.evaluate(
      async (d) => window.slidesApi.saveDesignReference(d),
      fixture,
    )
    expect(saved.ok).toBe(true)
    const md = await readFile(
      join(launched.userDataDir, 'style-templates', `${saved.key}.design.md`),
      'utf8',
    )
    expect(md).toContain('two_column_comparison')
    expect(md).not.toContain('data:image')
    const list = await page.evaluate(async () =>
      (window as any).aiOfficeCheilStyles.request({ op: 'designList' }),
    )
    expect(list.designs[0].key).toBe(saved.key)
    console.log('stage: design saved and listed')
    const second = await page.evaluate(
      async (key) =>
        (window as any).aiOfficeCheilStyles.request({
          op: 'designCreate',
          key,
          name: 'Second draft',
          brief:
            'A different campaign: compare trial and renewal, then prepare, launch and review.',
        }),
      saved.key,
    )
    expect(second.ok).toBe(true)
    let next: import('@playwright/test').Page | undefined
    await expect
      .poll(() => {
        next = app.windows().find((p) => p !== slidePage && p.url().includes('/slides/'))
        return !!next
      })
      .toBe(true)
    await next!.waitForFunction(() => !!window.slidesApi)
    await expect
      .poll(async () => (await next!.evaluate(() => window.slidesApi.getTemplateSelection()))?.key)
      .toBe(saved.key)
    const loaded = await next!.evaluate(
      async (key) => window.slidesApi.loadStyleTemplate(key!),
      saved.key,
    )
    expect(loaded.styleSkill).toContain(fixture.layouts.process)
  } finally {
    await app.close()
  }
})
