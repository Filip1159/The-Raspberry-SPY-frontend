import { expect, setMock, signIn, test } from './fixtures'

test('protected pages redirect to the login', async ({ page }) => {
    await page.goto('/app/alarm')
    await expect(page).toHaveURL(/\/login$/)
})

test('signing in opens the control panel and signing out leaves it', async ({ page }) => {
    await signIn(page)
    await expect(page).toHaveURL(/\/app\/video$/)
    await expect(page.getByRole('heading', { name: 'Live stream' })).toBeAttached()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/app/stats')
    await expect(page).toHaveURL(/\/login$/)
})

test('a wrong password is explained', async ({ page }) => {
    await signIn(page, 'demo', 'nope')
    await expect(page.getByRole('alert')).toContainText('Wrong username or password')
    await expect(page).toHaveURL(/\/login$/)
})

test('the rate limit is not mistaken for an offline backend', async ({ page }) => {
    // the app probes /health once after the first paint; let that finish before the failure is switched on
    const health = page.waitForResponse(/\/health/)
    await page.goto('/login')
    await health
    await setMock({ failWith: 429 })
    await page.getByLabel('Username').fill('demo')
    await page.getByLabel('Password', { exact: true }).fill('demo')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('alert')).toContainText(/too many/i)
    await expect(page.locator('.banner')).toBeHidden()
})

test('the session survives a reload', async ({ page }) => {
    await signIn(page)
    await expect(page).toHaveURL(/\/app\/video$/)
    await page.reload()
    await expect(page).toHaveURL(/\/app\/video$/)
})
