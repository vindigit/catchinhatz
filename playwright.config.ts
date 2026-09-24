import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 60_000,
    workers: 1,
    expect: { timeout: 15_000 },
    use: {
        baseURL: 'http://127.0.0.1:5173',
        ...devices['Desktop Chrome'],
        viewport: { width: 960, height: 600 }
    },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000
    }
});
