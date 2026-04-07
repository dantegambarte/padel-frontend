import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:4200/auth/login');
  await page.getByRole('textbox', { name: 'Usuario' }).fill('admin');
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('admin123');
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await page.waitForURL('**/app/dashboard', { timeout: 10000 });

  await page.context().storageState({ path: 'e2e/auth-state.json' });
  await browser.close();
}

export default globalSetup;
