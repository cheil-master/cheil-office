/** Cheil fork: real Electron UI with synthetic Pinterest traffic, never a personal account. */
import { test, expect } from '@playwright/test'
import { launchShell } from './helpers'
test('Pinterest connects, lists paginated boards, previews pins and clears its isolated session', async () => {
  const { app, page } = await launchShell({
    videoDir: 'pinterest',
    lang: 'ko',
    onboardingSeen: true,
  })
  try {
    await app.evaluate(({ session, nativeImage }) => {
      const s = session.fromPartition('persist:cheil-pinterest')
      s.protocol.handle('https', async (request) => {
        const u = new URL(request.url)
        if (u.hostname === 'i.pinimg.com')
          return new Response(
            nativeImage
              .createFromBitmap(Buffer.from([30, 80, 160, 255]), { width: 1, height: 1 })
              .toPNG(),
            { headers: { 'content-type': 'image/png' } },
          )
        if (u.hostname === 'www.pinterest.com' && ['/login/', '/'].includes(u.pathname))
          return new Response(null, {
            status: 302,
            headers: { location: 'https://kr.pinterest.com' + u.pathname },
          })
        if (u.pathname === '/login/') {
          await s.cookies.set({
            url: 'https://www.pinterest.com',
            name: '_auth',
            value: '1',
            expirationDate: Date.now() / 1000 + 3600,
            secure: true,
          })
          return new Response('<html><body>Signed in</body></html>', {
            headers: { 'content-type': 'text/html' },
          })
        }
        if (u.pathname === '/')
          return new Response(
            '<script type="application/json">{"props":{"initialReduxState":{"session":{"user":{"username":"demo"}}}}}</script>',
          )
        if (
          u.pathname.includes('Resource') &&
          (!request.headers.get('X-Pinterest-PWS-Handler') ||
            !request.headers.get('X-Pinterest-Source-Url'))
        )
          return new Response('Invalid Resource Request', { status: 403 })
        if (u.pathname.includes('BoardsResource')) {
          const more = JSON.parse(u.searchParams.get('data')!).options.bookmarks
          return Response.json({
            resource_response: {
              data: [
                {
                  id: more ? '222' : '111',
                  name: more ? 'Second board' : 'Demo board',
                  url: '/demo/board/',
                  pin_count: 1,
                },
              ],
            },
            resource: { options: { bookmarks: [more ? '-end-' : 'next'] } },
          })
        }
        if (u.pathname.includes('BoardFeedResource'))
          return Response.json({
            resource_response: {
              data: [
                {
                  id: '333',
                  title: 'Demo pin',
                  images: { '236x': { url: 'https://i.pinimg.com/demo.png' } },
                },
              ],
            },
          })
        return new Response('', { status: 404 })
      })
    })
    await page.getByTestId('cheil-style-mode').click()
    await page.locator('[data-testid=cheil-styles] > details > summary').click()
    const panel = page
      .locator('[data-testid=cheil-styles] > details')
      .getByTestId('pinterest-panel')
    await expect(panel.getByText('연결 안 됨', { exact: true })).toBeVisible()
    await panel.getByRole('button', { name: '연결 / 다시 로그인' }).click()
    await expect(panel.getByRole('button', { name: 'Demo board' })).toBeVisible()
    await panel.getByRole('button', { name: '보드 더 보기' }).click()
    await expect(panel.getByRole('button', { name: 'Second board' })).toBeVisible()
    await panel.getByRole('button', { name: 'Demo board' }).click()
    await expect(panel.getByRole('img', { name: 'Demo pin' })).toBeVisible()
    expect(
      await panel
        .getByRole('img')
        .evaluate((img: HTMLImageElement) => img.src.startsWith('data:image/png')),
    ).toBe(true)
    await panel.getByTestId('pinterest-style').click()
    await expect(page.getByTestId('style-preview')).toBeVisible()
    await expect(page.getByTestId('style-accent')).toHaveValue('#a0501e')
    await expect(page.getByTestId('style-library').locator('option:checked')).toHaveText(
      'Demo board · Moodboard',
    )
    const persisted = await page.evaluate(async () => {
      const api = (
        window as unknown as { aiOfficeCheilStyles: { request(r: unknown): Promise<any> } }
      ).aiOfficeCheilStyles
      const list = await api.request({ op: 'list' })
      return api.request({ op: 'load', id: list.styles[0].id })
    })
    expect(persisted.saved.profile.format).toBe('moodboard')
    expect(persisted.saved.profile.moodboard.sampledPins).toBe(1)
    expect(persisted.saved.selection.accent).toBe('#A0501E')
    await panel.getByRole('button', { name: '연결 해제', exact: true }).click()
    await panel.getByRole('button', { name: '연결 해제', exact: true }).last().click()
    await expect(panel.getByText('연결 안 됨', { exact: true })).toBeVisible()
    expect(
      await app.evaluate(
        async ({ session }) =>
          (await session.fromPartition('persist:cheil-pinterest').cookies.get({})).length,
      ),
    ).toBe(0)
  } finally {
    await app.close()
  }
})

test('Pinterest Korean login survives redirect and same-site navigation with stale auth', async () => {
  const { app, page } = await launchShell({
    videoDir: 'pinterest-login',
    lang: 'ko',
    onboardingSeen: true,
  })
  try {
    await app.evaluate(async ({ session }) => {
      const s = session.fromPartition('persist:cheil-pinterest')
      await s.cookies.set({
        url: 'https://www.pinterest.com',
        name: '_auth',
        value: '1',
        secure: true,
      })
      s.protocol.handle('https', (request) => {
        const u = new URL(request.url)
        if (u.hostname === 'www.pinterest.com')
          return new Response(null, {
            status: 302,
            headers: { location: 'https://kr.pinterest.com/login/' },
          })
        return new Response(
          '<html><body><h1>Test sign in</h1><a href="/login/challenge/">Continue</a><a href="https://example.com/">External</a></body></html>',
          { headers: { 'content-type': 'text/html' } },
        )
      })
    })
    const popupPromise = app.waitForEvent('window')
    await page.evaluate(() => {
      void (
        window as unknown as { aiOfficeCheilStyles: { request(r: unknown): Promise<unknown> } }
      ).aiOfficeCheilStyles.request({ op: 'pinterest', action: 'connect' })
    })
    const popup = await popupPromise
    await expect(popup.getByRole('heading', { name: 'Test sign in' })).toBeVisible()
    await expect(popup).toHaveURL('https://kr.pinterest.com/login/')
    await popup.getByRole('link', { name: 'Continue', exact: true }).click()
    await expect(popup).toHaveURL('https://kr.pinterest.com/login/challenge/')
    await popup.getByRole('link', { name: 'External', exact: true }).click({ noWaitAfter: true })
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some(
          (w) => w.webContents.getURL() === 'https://kr.pinterest.com/login/challenge/',
        ),
      ),
    ).toBe(true)
    expect(popup.isClosed()).toBe(false)
  } finally {
    await app.close()
  }
})
