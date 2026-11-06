import { expect, signIn, test } from './fixtures'

const REFRESH = /\/refresh$/

test('the access token is renewed in the background before it expires', async ({ page }) => {
    await page.clock.install()
    await signIn(page)
    await expect(page).toHaveURL(/\/app\/video$/)
    const before = await page.evaluate(() => localStorage.getItem('jwt'))

    const refreshed = page.waitForResponse(REFRESH)
    await page.clock.fastForward('29:30') // the mock's tokens last 30 minutes, the app renews one minute before the end
    expect((await refreshed).status()).toBe(200)

    await expect.poll(() => page.evaluate(() => localStorage.getItem('jwt'))).not.toBe(before)
    await expect(page).toHaveURL(/\/app\/video$/)
    await expect(page.getByRole('status').filter({ hasText: /session/i })).toHaveCount(0)
})

test('a session whose token expired while the tab was closed is restored silently', async ({ page }) => {
    await signIn(page)
    await expect(page).toHaveURL(/\/app\/video$/)

    // what a returning visitor has: an old access token in the storage, the refresh cookie still valid
    const expired = `h.${Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url')}.s`
    await page.evaluate(token => localStorage.setItem('jwt', token), expired)

    await page.goto('/app/alarm')
    await expect(page).toHaveURL(/\/app\/alarm$/)
    await expect(page.getByRole('article', { name: 'Alarm on Monday' })).toBeVisible()
})

test('without a valid refresh cookie an expired session ends at the login page', async ({ page, context }) => {
    await page.clock.install()
    await signIn(page)
    await expect(page).toHaveURL(/\/app\/video$/)

    await context.clearCookies()
    await page.clock.fastForward('29:30')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText('Your session has expired')).toBeVisible()
})

test('signing out revokes the refresh cookie', async ({ page }) => {
    await signIn(page)
    await expect(page).toHaveURL(/\/app\/video$/)
    const revoked = page.waitForResponse(/\/logout$/)

    await page.getByRole('button', { name: 'Sign out' }).click()

    expect((await revoked).status()).toBe(204)
    const result = await page.evaluate(async () => (await fetch('http://localhost:8080/refresh', { method: 'POST', credentials: 'include' })).status)
    expect(result).toBe(401)
})
