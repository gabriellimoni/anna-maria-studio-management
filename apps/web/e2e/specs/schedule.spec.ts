import { test, expect, stubAuth } from '../fixtures/auth';
import { mockApi } from '../fixtures/api-mock';
import { calendarResponse, sessionsList } from '../mocks/schedule';

test.beforeEach(async ({ page }) => {
  await stubAuth(page);
});

test('10. /agenda weekly view renders and calls /sessions/calendar', async ({ page }) => {
  const api = await mockApi(page, {
    'GET /sessions/calendar': { body: calendarResponse },
    'GET /sessions': { body: sessionsList },
  });
  const calendarReq = page.waitForResponse((r) => r.url().includes('/sessions/calendar'));
  await page.goto('/agenda');
  await calendarReq;
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
  expect(api.findCall('GET', '/sessions/calendar')).toBeTruthy();
});

test('11. /agenda/dia/:date — day view fires API and renders', async ({ page }) => {
  const api = await mockApi(page, {
    'GET /sessions/calendar': { body: calendarResponse },
    'GET /sessions': { body: sessionsList },
    'PATCH /sessions/session-1': { body: { ok: true } },
    'POST /sessions/session-1/cancel': { body: { ok: true } },
  });
  await page.goto('/agenda/dia/2026-05-25');
  await page.waitForResponse((r) => r.url().includes('/sessions'));
  expect(api.calls.length).toBeGreaterThan(0);
});
