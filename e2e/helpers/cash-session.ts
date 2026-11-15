import { expect, Page } from '@playwright/test';

const API_URL = `${process.env['E2E_BACKEND_URL'] ?? 'http://localhost:3000'}/api/v1`;
const TOKEN_KEY = 'padelsys_access_token';

/**
 * Opens a cash session through the API with the logged-in user's token when
 * none is open, so specs that need one do not depend on spec order (earlier
 * specs may have closed it). The page must already be on the app origin.
 */
export async function ensureOpenCashSession(page: Page): Promise<void> {
  const token = await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY);
  if (!token) throw new Error('No session token in localStorage');
  const headers = { Authorization: `Bearer ${token}` };
  const current = await page.request.get(`${API_URL}/cash/current`, { headers });
  expect(current.ok()).toBeTruthy();
  if ((await current.json()).isOpen) return;
  const open = () =>
    page.request.post(`${API_URL}/cash/sessions`, {
      headers,
      data: { initialBalance: 0 },
    });
  let opened = await open();
  // Previous business days left without their daily close (Z) block opening.
  // Close them the way the app asks the user to (one day per call), then retry.
  for (
    let attempt = 0;
    attempt < 20 && opened.status() === 409 && (await opened.text()).includes('pendiente de cierre');
    attempt++
  ) {
    const closed = await page.request.post(`${API_URL}/cash/daily-closures`, { headers });
    expect(closed.ok(), await closed.text()).toBeTruthy();
    opened = await open();
  }
  expect(opened.status(), await opened.text()).toBe(201);
}
