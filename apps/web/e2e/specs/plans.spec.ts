import { test, expect, stubAuth } from '../fixtures/auth';
import { mockApi } from '../fixtures/api-mock';
import { PLAN_1, PLAN_CATALOG_1, planCatalogList, plansList } from '../mocks/plans';
import { studentsList } from '../mocks/students';

test.beforeEach(async ({ page }) => {
  await stubAuth(page);
});

test('7. /plan-catalog lists templates; form page renders', async ({ page }) => {
  const api = await mockApi(page, {
    'GET /plan-catalog': { body: planCatalogList },
    'POST /plan-catalog': { status: 201, body: { ...PLAN_CATALOG_1, id: 'pc-new' } },
  });

  await page.goto('/plan-catalog');
  await expect(page.getByText('Mensal 2x/semana')).toBeVisible();

  await page.goto('/plan-catalog/new');
  await expect(page.getByRole('heading', { name: 'Novo plano' })).toBeVisible();
  await expect(page.getByLabel('Nome')).toBeVisible();
  expect(api.findCall('GET', '/plan-catalog')).toBeTruthy();
});

test('8. /plans/new wizard renders with student/catalog combos and disabled next', async ({ page }) => {
  await mockApi(page, {
    'GET /students': { body: studentsList },
    'GET /plan-catalog': { body: planCatalogList },
    'POST /plans': { status: 201, body: PLAN_1 },
  });

  await page.goto('/plans/new');
  await expect(page.getByRole('combobox', { name: 'Aluno' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Catálogo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Próximo' })).toBeDisabled();
});

test('9. /plans/:id/change-schedule renders', async ({ page }) => {
  const api = await mockApi(page, {
    'GET /plans/plan-1': { body: PLAN_1 },
    'PATCH /plans/plan-1': { body: PLAN_1 },
  });
  await page.goto('/plans/plan-1/change-schedule');
  await page.waitForResponse((r) => /\/plans\/plan-1/.test(r.url()));
  expect(api.findCall('GET', '/plans/plan-1')).toBeTruthy();
});

test('plans list page renders', async ({ page }) => {
  await mockApi(page, { 'GET /plans': { body: plansList } });
  await page.goto('/plans');
  await expect(page.getByText('Ana Silva').first()).toBeVisible();
});
