import { defineConfig, devices } from '@playwright/test';

if (
  process.env.ZUYIBA_E2E !== '1' ||
  !/^\/zuyiba_e2e_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL || '').pathname)
) {
  throw new Error('Run npm run test:e2e to provision an isolated database first.');
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/warmup.ts',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command:
      'node node_modules/next/dist/bin/next build --webpack && node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: 'pipe',
  },
});
