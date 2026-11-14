import { chromium, request, FullConfig } from '@playwright/test';

const backendUrl = process.env['E2E_BACKEND_URL'] ?? 'http://localhost:3000';

/**
 * The layout shows a blocking "Caja sin cerrar" modal when the current cash
 * session was opened on a previous day. The e2e database keeps state between
 * runs, so a session left open by an earlier run would cover every page and
 * intercept clicks. Close it through the API before any spec runs.
 */
export async function closeStaleCashSession(): Promise<void> {
  const api = await request.newContext({ baseURL: `${backendUrl}/api/v1/` });
  try {
    const login = await api.post('auth/login', {
      data: { username: 'admin', password: 'admin123' },
    });
    if (!login.ok()) throw new Error(`E2E setup login failed: ${login.status()}`);
    const { accessToken } = (await login.json()) as { accessToken: string };
    const headers = { Authorization: `Bearer ${accessToken}` };

    const current = await api.get('cash/current', { headers });
    if (!current.ok()) throw new Error(`E2E setup GET cash/current failed: ${current.status()}`);
    const body = (await current.json()) as {
      isOpen: boolean;
      cashExpected?: number | string;
      session: { date: string } | null;
    };
    const today = new Date().toLocaleDateString('en-CA');
    if (!body.isOpen || !body.session || body.session.date >= today) return;

    const close = await api.patch('cash/sessions/current', {
      headers,
      data: {
        cashCounted: Number(body.cashExpected) || 0,
        notes: 'Closed by e2e global setup (stale session from a previous run)',
      },
    });
    if (!close.ok()) throw new Error(`E2E setup could not close stale cash session: ${close.status()}`);
  } finally {
    await api.dispose();
  }
}

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects.find((project) => project.use.baseURL)?.use.baseURL;
  if (!baseURL) throw new Error('Playwright baseURL is required for E2E auth setup.');

  // Runs before the browser login so the stored session is the latest one.
  await closeStaleCashSession();

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
