import { defineConfig, devices } from '@playwright/test';

const frontendUrl = process.env['E2E_FRONTEND_URL'] ?? 'http://localhost:4200';
const backendUrl = process.env['E2E_BACKEND_URL'] ?? 'http://localhost:3000';
const backendProject = '../../back/padel-backend';
// CI starts the backend itself (different checkout path and POSIX shell), so it
// sets E2E_EXTERNAL_BACKEND=1 to skip the local Windows-only backend webServer.
const externalBackend = process.env['E2E_EXTERNAL_BACKEND'] === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  // Must stay 1: all specs share one rotating refresh cookie (see e2e/fixtures.ts).
  workers: 1,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'html',
  // Stop early on CI instead of burning the job timeout when the stack is broken.
  maxFailures: process.env['CI'] ? 15 : 0,
  globalSetup: './e2e/global-setup.ts',
  webServer: [
    ...(externalBackend
      ? []
      : [
    {
      // start (no start:dev) a propósito: start:dev es `nest start --watch` y
      // nest-cli.json tiene deleteOutDir, así que cualquier cambio en src/
      // durante la corrida borra dist/ y reinicia el backend a mitad de suite,
      // provocando fallos en cascada por "no se pudo conectar con el servidor".
      command: `set NODE_ENV=test&& set E2E_RELAX_THROTTLE=1&& pnpm -C ${backendProject} run migration:run && pnpm -C ${backendProject} run seed && pnpm -C ${backendProject} run start`,
      url: `${backendUrl}/api/docs`,
      // Nunca reutilizar un backend ya levantado, ni siquiera en local.
      // Every admin login bumps sessionVersion and invalidates the shared
      // storageState session (SESSION_OVERRIDDEN), so specs reuse the stored
      // admin token and auth.spec runs last in the "Auth" project. The suite
      // also depends on
      // E2E_RELAX_THROTTLE=1, que sube los límites de rate limiting (login de
      // 5 a 1000 por minuto); el backend lo ignora en producción. Un backend arrancado a mano con `pnpm run
      // start:dev` no cumple ninguna de las dos condiciones, y al reutilizarlo
      // la suite fallaba masivamente aparentando una regresión de la app.
      // Con `false`, si el puerto está ocupado Playwright falla al arrancar:
      // preferimos ese error ruidoso antes que resultados que mienten.
      reuseExistingServer: false,
      timeout: 120_000,
    },
        ]),
    {
      command: 'pnpm start',
      url: frontendUrl,
      // Mismo criterio que el backend: arrancar siempre nuestro propio server
      // en vez de heredar uno con estado o build desconocidos.
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  use: {
    baseURL: frontendUrl,
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
    // Documentation generators open and close the shared cash session, so
    // they cannot run next to the regular specs. Opt in and run them alone:
    //   E2E_DOCS=1 npx playwright test --project=docs
    ...(process.env['E2E_DOCS']
      ? [
          {
            name: 'docs',
            testMatch: /generate-.*\.spec\.ts/,
            use: {
              ...devices['Desktop Chrome'],
              viewport: { width: 1920, height: 1080 },
              storageState: 'e2e/auth-state.json',
            },
          },
        ]
      : []),
    {
      name: 'Desktop Full HD',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        storageState: 'e2e/auth-state.json',
      },
      testIgnore: ['**/schedule.mobile.spec.ts', '**/auth.spec.ts', '**/generate-*.spec.ts'],
    },
    {
      name: 'Notebook',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 },
        storageState: 'e2e/auth-state.json',
      },
      testIgnore: [
        '**/schedule.mobile.spec.ts',
        '**/auth.spec.ts',
        '**/expenses.spec.ts',
        '**/generate-*.spec.ts',
      ],
    },
    {
      name: 'Mobile',
      use: {
        ...devices['iPhone SE'],
        storageState: 'e2e/auth-state.json',
      },
      testIgnore: [
        '**/chaos-paths.spec.ts',
        '**/pos.spec.ts',
        '**/auth.spec.ts',
        '**/expenses.spec.ts',
        '**/generate-*.spec.ts',
        '**/schedule.spec.ts',
      ],
    },
    // auth.spec logs in as admin, which bumps sessionVersion and invalidates
    // the shared auth-state.json session. It runs after every other project.
    {
      name: 'Auth',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: '**/auth.spec.ts',
      dependencies: ['Desktop Full HD', 'Notebook', 'Mobile'],
    },
  ],
});
