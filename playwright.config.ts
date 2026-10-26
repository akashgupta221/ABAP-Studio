import { defineConfig, devices } from '@playwright/test'

// These values are disposable and only work when the test broker is explicitly
// enabled against a local SQLite database. They are never production secrets.
const TEST_SECRET = process.env.E2E_TEST_SECRET ?? 'ui-test-only-secret-0123456789abcdef'
process.env.E2E_TEST_SECRET = TEST_SECRET

const PORT = 3101
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    colorScheme: 'light',
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'bash tests/ui-server.sh',
        url: `${baseURL}/api/health`,
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
          ...process.env,
          E2E_TEST_SECRET: TEST_SECRET,
        },
      },
})
