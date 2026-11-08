import AxeBuilder from '@axe-core/playwright'
import { Page } from '@playwright/test'
import { expect, signIn, test } from './fixtures'

async function setTheme(page: Page, theme: 'light' | 'dark') {
    await page.evaluate(value => {
        localStorage.setItem('theme', value)
        document.documentElement.setAttribute('data-theme', value)
    }, theme)
}

async function expectNoViolations(page: Page) {
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([])
}

for (const theme of ['light', 'dark'] as const) {
    test.describe(`accessibility (${theme})`, () => {
        test('portfolio', async ({ page }) => {
            await page.goto('/')
            await setTheme(page, theme)
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
            await expectNoViolations(page)
        })

        test('login', async ({ page }) => {
            await page.goto('/login')
            await setTheme(page, theme)
            await expectNoViolations(page)
        })

        test('control panel pages', async ({ page }) => {
            await signIn(page)
            await expect(page).toHaveURL(/\/app\/video$/)
            await setTheme(page, theme)
            await expect(page.getByRole('button', { name: 'Center the camera' })).toBeEnabled({ timeout: 15_000 })
            await expectNoViolations(page)

            await page.getByText('Stream settings').click()
            await expect(page.getByLabel('Frame rate')).toBeVisible()
            await expectNoViolations(page)

            await page.goto('/app/alarm')
            await setTheme(page, theme)
            await expect(page.getByRole('article', { name: 'Alarm on Monday' })).toBeVisible()
            await expectNoViolations(page)

            await page.goto('/app/stats')
            await setTheme(page, theme)
            await expect(page.getByRole('meter').first()).toHaveAttribute('aria-valuenow', /^\d/, { timeout: 15_000 })
            await expectNoViolations(page)
        })
    })
}
