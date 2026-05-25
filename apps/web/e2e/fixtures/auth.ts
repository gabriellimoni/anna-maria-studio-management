import { test as base, expect, Page } from '@playwright/test';

export const DEFAULT_E2E_USER = {
  uid: 'e2e-uid',
  email: 'e2e@example.com',
  displayName: 'E2E User',
  token: 'fake-id-token',
};

export async function stubAuth(page: Page, user = DEFAULT_E2E_USER) {
  await page.addInitScript((u) => {
    (window as unknown as { __E2E_AUTH__: typeof u }).__E2E_AUTH__ = u;
  }, user);
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await stubAuth(page);
    await use(page);
  },
});

export { expect };
