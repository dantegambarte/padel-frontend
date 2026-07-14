import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects.find((project) => project.use.baseURL)?.use.baseURL;
  if (!baseURL) throw new Error('Playwright baseURL is required for E2E auth setup.');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(new URL('/auth/login', baseURL).toString());
  await page.getByRole('textbox', { name: 'Usuario' }).fill('admin');
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('admin123');
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await page.waitForURL('**/app/dashboard', { timeout: 10000 });

  await page.context().storageState({ path: 'e2e/auth-state.json' });
  await browser.close();
}

export default globalSetup;
