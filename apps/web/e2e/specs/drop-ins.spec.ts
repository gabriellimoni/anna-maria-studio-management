import { test, expect, stubAuth } from '../fixtures/auth';
import { mockApi } from '../fixtures/api-mock';
import { dropInsList } from '../mocks/contracts';
import { studentsList } from '../mocks/students';

test.beforeEach(async ({ page }) => {
  await stubAuth(page);
});

test('12. /drop-ins/new — page renders (prospect/capacity-warning never blocks)', async ({ page }) => {
  await mockApi(page, {
    'GET /drop-ins': { body: dropInsList },
    'GET /students': { body: studentsList },
    'GET /plan-catalog': { body: [] },
    'POST /drop-ins': { status: 201, body: { id: 'di-1' } },
  });

  await page.goto('/drop-ins/new');
  await expect(page.getByRole('heading', { name: 'Nova aula avulsa' })).toBeVisible();
  // The submit button is always present — capacity is never a hard blocker
  await expect(page.getByRole('button', { name: 'Registrar aula avulsa' })).toBeVisible();
});
