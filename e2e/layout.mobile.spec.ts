import { Page } from '@playwright/test'
import { expect, signIn, test } from './fixtures'

async function expectNoHorizontalScroll(page: Page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
}

test('the public pages fit a phone', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoHorizontalScroll(page)

    await page.goto('/login')
    await expectNoHorizontalScroll(page)
})

test('the bottom navigation switches between the panel pages', async ({ page }) => {
    await signIn(page)
    await expect(page).toHaveURL(/\/app\/video$/)

    const nav = page.getByRole('navigation', { name: 'Main' }).last()
    await nav.getByRole('link', { name: 'Alarms' }).click()
    await expect(page).toHaveURL(/\/app\/alarm$/)
    await expectNoHorizontalScroll(page)

    await nav.getByRole('link', { name: 'Stats' }).click()
    await expect(page).toHaveURL(/\/app\/stats$/)
    await expectNoHorizontalScroll(page)

    await nav.getByRole('link', { name: 'SPY' }).click()
    await expect(page).toHaveURL(/\/app\/video$/)
    await expectNoHorizontalScroll(page)
})
