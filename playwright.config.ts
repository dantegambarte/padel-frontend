import { defineConfig, devices } from '@playwright/test';

const frontendUrl = process.env['E2E_FRONTEND_URL'] ?? 'http://localhost:4200';
const backendUrl = process.env['E2E_BACKEND_URL'] ?? 'http://localhost:3000';
const backendProject = '../../back/padel-backend';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: 'html',
  globalSetup: './e2e/global-setup.ts',
  webServer: [
    {
      // start (no start:dev) a propósito: start:dev es `nest start --watch` y
      // nest-cli.json tiene deleteOutDir, así que cualquier cambio en src/
      // durante la corrida borra dist/ y reinicia el backend a mitad de suite,
      // provocando fallos en cascada por "no se pudo conectar con el servidor".
      command: `set NODE_ENV=test&& pnpm -C ${backendProject} run migration:run && pnpm -C ${backendProject} run seed && pnpm -C ${backendProject} run start`,
      url: `${backendUrl}/api/docs`,
      // Nunca reutilizar un backend ya levantado, ni siquiera en local.
      // La suite depende de que el backend corra con NODE_ENV=test: solo así
      // el login no incrementa sessionVersion (si lo incrementa, cada spec que
      // hace su propio login invalida la sesión compartida del storageState y
      // el resto falla en cascada con SESSION_OVERRIDDEN) y el throttle de
      // login sube de 5 a 1000. Un backend arrancado a mano con `npm run
      // start:dev` no cumple ninguna de las dos condiciones, y al reutilizarlo
      // la suite fallaba masivamente aparentando una regresión de la app.
      // Con `false`, si el puerto está ocupado Playwright falla al arrancar:
      // preferimos ese error ruidoso antes que resultados que mienten.
      reuseExistingServer: false,
      timeout: 120_000,
    },
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
  ],
});
