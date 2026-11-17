import { test as base } from '@playwright/test';

import { SHARED_AUTH_STATE } from './helpers/session-token';

export * from '@playwright/test';

/**
 * Every page load trades the HttpOnly refresh cookie for an access token, and
 * the backend rotates the cookie on each refresh. Presenting an already rotated
 * cookie counts as token reuse and revokes the whole session, so the shared
 * storage state must always hold the latest cookie: after each test that ran
 * with it, write the context's current state back to the file.
 */
export const test = base.extend<{ persistRotatedSession: void }>({
  persistRotatedSession: [
    async ({ context, storageState }, use) => {
      await use();
      if (storageState === SHARED_AUTH_STATE) {
        await context.storageState({ path: SHARED_AUTH_STATE });
      }
    },
    { auto: true },
  ],
});
