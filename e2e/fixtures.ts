import { expect, Page, test as base } from '@playwright/test'

const MOCK = 'http://localhost:8080'

export async function resetMock() {
    await fetch(`${MOCK}/__mock/config`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offline: false, latencyMs: 0, failWith: null }),
    })
}

export async function setMock(config: Record<string, unknown>) {
    await fetch(`${MOCK}/__mock/config`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config) })
}

export async function signIn(page: Page, username = 'demo', password = 'demo') {
    await page.goto('/login')
    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
}

/** Every test starts with a healthy mock backend and a signed-out browser */
export const test = base.extend({
    page: async ({ page }, use) => {
        await resetMock()
        await use(page)
        await resetMock()
    },
})

export { expect }
