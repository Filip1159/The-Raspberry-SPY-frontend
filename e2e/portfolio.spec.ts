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

test('project cards slide through their images', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('article.project', { hasText: 'Macau card game' })
    const track = card.locator('.gallery__track')
    await track.scrollIntoViewIfNeeded()
    await expect(card.getByRole('heading', { name: 'Macau card game' })).toBeVisible()

    await card.getByRole('button', { name: 'Next image of Macau card game' }).click()
    await expect.poll(() => track.evaluate(el => Math.round(el.scrollLeft / el.clientWidth))).toBe(1)
    await expect(card.getByRole('button', { name: 'Show image 2 of Macau card game' })).toHaveAttribute('aria-current', 'true')

    await card.getByRole('button', { name: 'Previous image of Macau card game' }).click()
    await expect.poll(() => track.evaluate(el => el.scrollLeft)).toBe(0)
})
