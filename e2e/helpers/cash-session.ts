import { expect, Page } from '@playwright/test';

const BACKEND_URL = process.env['E2E_BACKEND_URL'] ?? 'http://localhost:3000';
const API_URL = `${BACKEND_URL}/api/v1`;
const TOKEN_KEY = 'padelsys_access_token';
/** Upper bound of stale business days closed before giving up. */
const MAX_STALE_DAYS = 20;

/**
 * The helper may run daily closes (Z), which cannot be undone. Refuse to do
 * that against anything but a local backend unless explicitly allowed.
 */
function assertSafeBackend(): void {
  const host = new URL(BACKEND_URL).hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!isLocal && process.env['E2E_ALLOW_REMOTE_CASH_CHANGES'] !== '1') {
    throw new Error(
      `Refusing to change cash sessions on ${BACKEND_URL}. ` +
        'Set E2E_ALLOW_REMOTE_CASH_CHANGES=1 if this backend holds test data only.',
    );
  }
}

async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY);
  if (!token) throw new Error('No session token in localStorage');
  return { Authorization: `Bearer ${token}` };
}

/** Current cash session as returned by GET cash/current. */
export async function getCurrentCashSession(page: Page): Promise<Record<string, unknown>> {
  const current = await page.request.get(`${API_URL}/cash/current`, {
    headers: await authHeaders(page),
  });
  expect(current.ok(), await current.text()).toBeTruthy();
  return current.json();
}

/**
 * Opens a cash session through the API with the logged-in user's token when
 * none is open, so specs that need one do not depend on spec order (earlier
 * specs may have closed it). The page must already be on the app origin.
 */
export async function ensureOpenCashSession(page: Page): Promise<void> {
  if ((await getCurrentCashSession(page))['isOpen']) return;
  assertSafeBackend();

  const headers = await authHeaders(page);
  const open = () =>
    page.request.post(`${API_URL}/cash/sessions`, {
      headers,
      data: { initialBalance: 0 },
    });
  const blockedByStaleDay = async (res: Awaited<ReturnType<typeof open>>) =>
    res.status() === 409 && (await res.text()).includes('pendiente de cierre');

  let opened = await open();
  // Previous business days left without their daily close (Z) block opening.
  // Close them the way the app asks the user to (one day per call), then retry.
  for (let day = 0; day < MAX_STALE_DAYS && (await blockedByStaleDay(opened)); day++) {
    const closed = await page.request.post(`${API_URL}/cash/daily-closures`, { headers });
    // Another worker may have closed the same day first.
    expect(closed.ok() || closed.status() === 409, await closed.text()).toBeTruthy();
    opened = await open();
  }

  // Another worker may have opened the session between the check and the POST.
  if (opened.status() === 409 && (await getCurrentCashSession(page))['isOpen']) return;
  expect(opened.status(), await opened.text()).toBe(201);
}
