import { test, expect, stubAuth } from '../fixtures/auth';
import { mockApi } from '../fixtures/api-mock';

test('1. unauthenticated visit to / redirects to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
});

test('2. with stubbed auth, / renders the dashboard', async ({ page }) => {
  await stubAuth(page);
  await page.goto('/');
  await expect(page).toHaveURL('http://localhost:5174/');
  await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  // Sidebar nav is rendered
  await expect(page.getByRole('button', { name: 'Alunos' })).toBeVisible();
});

test('20. 401 on API call redirects (handled gracefully)', async ({ page }) => {
  await stubAuth(page);
  await mockApi(page, {
    'GET /students': { status: 401, body: { message: 'Unauthorized' } },
  });
  await page.goto('/students');
  // App should not crash; either redirect or show an error toast.
  // We assert the page does not show the React error boundary fallback.
  await expect(page.getByText('Algo deu errado. Recarregue a página.')).toHaveCount(0);
});
