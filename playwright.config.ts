import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 4,
  reporter: 'html',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    storageState: 'e2e/auth-state.json',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },
    {
      name: 'Desktop Full HD',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        storageState: 'e2e/auth-state.json',
      },
      testIgnore: ['**/schedule.mobile.spec.ts'],
    },
    {
      name: 'Notebook',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 },
        storageState: 'e2e/auth-state.json',
      },
      testIgnore: ['**/schedule.mobile.spec.ts'],
    },
    {
      name: 'Mobile',
      use: {
        ...devices['iPhone SE'],
        storageState: 'e2e/auth-state.json',
      },
      testIgnore: ['**/schedule.mobile.spec.ts', '**/chaos-paths.spec.ts', '**/pos.spec.ts'],
    },
  ],
});
