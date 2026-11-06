import { expect, signIn, test } from './fixtures'

test.beforeEach(async ({ page }) => {
    await signIn(page)
    await expect(page).toHaveURL(/\/app\/video$/)
})

test('the stats page shows live values from the socket', async ({ page }) => {
    await page.getByRole('link', { name: 'Stats' }).click()
    await expect(page.getByRole('heading', { name: 'Raspberry stats' })).toBeVisible()
    // the mock pushes a reading every 5 s; the first one arrives right after connecting
    await expect(page.getByRole('meter').first()).toHaveAttribute('aria-valuenow', /^\d/, { timeout: 15_000 })
})

test('alarms can be changed, saved and survive a reload', async ({ page }) => {
    await page.getByRole('link', { name: 'Alarm' }).click()
    const monday = page.getByRole('article', { name: 'Alarm on Monday' })
    await expect(monday).toBeVisible()

    const time = monday.getByLabel('Time')
    const next = (await time.inputValue()) === '06:45' ? '07:15' : '06:45'
    await time.fill(next)
    await time.dispatchEvent('change')
    await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeVisible()

    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeHidden()

    await page.reload()
    await expect(page.getByRole('article', { name: 'Alarm on Monday' }).getByLabel('Time')).toHaveValue(next)
})

test('discarding restores the saved alarm', async ({ page }) => {
    await page.getByRole('link', { name: 'Alarm' }).click()
    const tuesday = page.getByRole('article', { name: 'Alarm on Tuesday' })
    const original = await tuesday.getByLabel('Time').inputValue()

    await tuesday.locator('label.switch').click()
    await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeVisible()
    await page.getByRole('button', { name: 'Discard' }).click()

    await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeHidden()
    await expect(page.getByRole('article', { name: 'Alarm on Tuesday' }).getByLabel('Time')).toHaveValue(original)
})

test('the camera controls are available on the stream page', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Center the camera' })).toBeEnabled({ timeout: 15_000 })
})
