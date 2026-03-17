import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
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
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/auth-state.json' },
    },
    {
      // Simula viewport móvil 390×844 sobre Chromium (ya instalado).
      // devices['iPhone 13'] usa WebKit por defecto y requiere instalación aparte.
      // Con browserName: 'chromium' + viewport manual obtenemos el mismo tamaño
      // de pantalla sin necesidad de instalar browsers adicionales.
      name: 'mobile-chrome',
      testMatch: /.*\.mobile\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        storageState: 'e2e/auth-state.json',
      },
    },
  ],
});
