import { expect, setMock, signIn, test } from './fixtures'

test('the login shows the offline banner and recovers when the Raspberry is back', async ({ page }) => {
    await setMock({ offline: true })
    await page.goto('/login')

    const banner = page.getByRole('status').filter({ hasText: 'probably switched off' }).first()
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled()

    await setMock({ offline: false })
    await page.getByRole('button', { name: 'Retry now' }).click()
    await expect(banner).toBeHidden()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
})

test('the banner appears inside the panel when the Pi drops and the controls are disabled', async ({ page }) => {
    await signIn(page)
    await expect(page.getByRole('button', { name: 'Center the camera' })).toBeEnabled({ timeout: 15_000 })

    await setMock({ offline: true })
    await expect(page.getByRole('status').filter({ hasText: 'probably switched off' }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Center the camera' })).toBeDisabled()
})
