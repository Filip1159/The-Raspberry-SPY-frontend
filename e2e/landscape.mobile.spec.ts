import { Page } from '@playwright/test'
import { expect, signIn, test } from './fixtures'

// A phone held sideways: 844x390 is an iPhone 14, 667x375 an iPhone SE
for (const viewport of [
    { width: 844, height: 390 },
    { width: 667, height: 375 },
]) {
    test.describe(`phone in landscape (${viewport.width}x${viewport.height})`, () => {
        test.use({ viewport })

        async function openStream(page: Page) {
            await signIn(page)
            await expect(page).toHaveURL(/\/app\/video$/)
            await expect(page.getByRole('button', { name: 'Center the camera' })).toBeVisible()
        }

        test('the picture fits the screen with the controls beside it', async ({ page }) => {
            await openStream(page)

            const frame = (await page.locator('.stream__frame').boundingBox())!
            const controls = (await page.getByRole('region', { name: 'Camera controls' }).boundingBox())!

            expect(frame.y).toBeGreaterThanOrEqual(0)
            expect(frame.y + frame.height).toBeLessThanOrEqual(viewport.height)
            expect(controls.x).toBeGreaterThanOrEqual(frame.x + frame.width)
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
            expect(overflow).toBeLessThanOrEqual(0)
        })

        test('the header is a slim bar', async ({ page }) => {
            await openStream(page)

            const header = (await page.locator('header.header').boundingBox())!

            expect(header.height).toBeLessThanOrEqual(56)
        })

        test('the camera can be turned on and the controls reached', async ({ page }) => {
            await openStream(page)

            await page.getByRole('button', { name: 'Turn the camera on' }).click()
            await expect(page.getByText('LIVE', { exact: true })).toBeVisible({ timeout: 15_000 })
            await expect(page.getByRole('button', { name: 'Move up', exact: true })).toBeInViewport()
        })
    })
}
