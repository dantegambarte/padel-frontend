import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Page, request } from '@playwright/test';

/** Storage state written by global-setup: admin profile + refresh_token cookie. */
export const SHARED_AUTH_STATE = 'e2e/auth-state.json';

const BACKEND_URL = process.env['E2E_BACKEND_URL'] ?? 'http://localhost:3000';
const REFRESH_URL = `${BACKEND_URL}/api/v1/auth/refresh`;

/**
 * Access token of the session that is loaded in `page`. The app keeps its
 * token in memory only, so ask the backend for a new one with the context's
 * HttpOnly refresh cookie. The rotated cookie lands in the same context, so the
 * app keeps working (refresh rotates `rv` but never bumps `sessionVersion`, so
 * the app's current access token stays valid).
 */
export async function pageAccessToken(page: Page): Promise<string> {
  const res = await page.request.post(REFRESH_URL);
  if (!res.ok()) {
    throw new Error(`No session for this page: refresh returned ${res.status()}`);
  }
  return ((await res.json()) as { accessToken: string }).accessToken;
}

/**
 * Access token of the shared admin session stored in auth-state.json, for
 * API-only setup code. Writes the rotated cookie back to the file so the next
 * browser context does not present a stale (reused) cookie. Returns undefined
 * when there is no stored session or the backend rejects it.
 */
export async function sharedSessionAccessToken(): Promise<string | undefined> {
  if (!existsSync(SHARED_AUTH_STATE)) return undefined;
  const api = await request.newContext({ storageState: SHARED_AUTH_STATE });
  try {
    const res = await api.post(REFRESH_URL);
    if (!res.ok()) return undefined;
    const { accessToken } = (await res.json()) as { accessToken: string };

    // Keep the stored localStorage (user profile); only the cookies changed.
    const state = JSON.parse(readFileSync(SHARED_AUTH_STATE, 'utf8')) as Record<string, unknown>;
    const { cookies } = await api.storageState();
    writeFileSync(SHARED_AUTH_STATE, JSON.stringify({ ...state, cookies }, null, 2));
    return accessToken;
  } finally {
    await api.dispose();
  }
}
