import { defineConfig, devices } from '@playwright/test'

// Runs the Angular app in the `mock` configuration against mock-server/ (no Raspberry needed).
// Locally an already running `npm run start:mock` is reused; the tests change the mock server's state, so they run serially.
export default defineConfig({
    testDir: 'e2e',
    fullyParallel: false,
    workers: 1,
    retries: process.env['CI'] ? 1 : 0,
    reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: 'http://localhost:4200',
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
        { command: 'npm run mock-server', url: 'http://localhost:8080/health', reuseExistingServer: !process.env['CI'], timeout: 30_000 },
        {
            command: 'npm run start:ui',
            url: 'http://localhost:4200',
            reuseExistingServer: !process.env['CI'],
            timeout: 180_000,
        },
    ],
})
