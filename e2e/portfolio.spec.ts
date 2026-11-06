import { expect, setMock, test } from './fixtures'

test('the portfolio works without a backend', async ({ page }) => {
    await setMock({ offline: true })
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1, name: /Filip/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Sign in/ }).first()).toBeVisible()
})

test('unknown URLs go back to the portfolio', async ({ page }) => {
    await page.goto('/no-such-page')
    await expect(page).toHaveURL(/\/$/)
})

test('the theme can be switched and is remembered', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Switch to the dark theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: 'Switch to the light theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})
