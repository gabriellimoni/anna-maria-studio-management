import { test, expect, stubAuth } from '../fixtures/auth';
import { mockApi } from '../fixtures/api-mock';
import { studentsList } from '../mocks/students';
import { planCatalogList, plansList } from '../mocks/plans';
import { calendarResponse } from '../mocks/schedule';
import { payablesList, receivablesList, recurringExpensesList } from '../mocks/financial';
import { dropInsList, templatesList } from '../mocks/contracts';

test.beforeEach(async ({ page }) => {
  await stubAuth(page);
  await mockApi(page, {
    'GET /students': { body: studentsList },
    'GET /plans': { body: plansList },
    'GET /plan-catalog': { body: planCatalogList },
    'GET /sessions/calendar': { body: calendarResponse },
    'GET /sessions': { body: { data: [], total: 0, page: 1, pageSize: 20 } },
    'GET /drop-ins': { body: dropInsList },
    'GET /receivables': { body: receivablesList },
    'GET /payables': { body: payablesList },
    'GET /recurring-expenses': { body: recurringExpensesList },
    'GET /contract-templates': { body: templatesList },
  });
});

test('18. sidebar navigates to every top-level menu', async ({ page }) => {
  await page.goto('/');
  const items: Array<[string, RegExp]> = [
    ['Alunos', /\/students/],
    ['Planos', /\/plans/],
    ['Catálogo de planos', /\/plan-catalog/],
    ['Agenda', /\/agenda/],
    ['Aulas avulsas', /\/drop-ins/],
    ['A receber', /\/financeiro\/receber/],
    ['A pagar', /\/financeiro\/pagar/],
    ['Desp. recorrentes', /\/financeiro\/despesas-recorrentes/],
    ['Templates de contrato', /\/contratos\/templates/],
    ['Dashboard', /\/$/],
  ];

  for (const [label, url] of items) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page).toHaveURL(url);
  }
});

test('19. 5xx on a list call surfaces error toast and does not crash', async ({ page }) => {
  // Override receivables to return 500
  await page.unroute('**/api/v1/**');
  await mockApi(page, {
    'GET /receivables': { status: 500, body: { message: 'Boom' } },
  });
  await page.goto('/financeiro/receber');
  await page.waitForTimeout(800);
  // App boundary is not triggered
  await expect(page.getByText('Algo deu errado. Recarregue a página.')).toHaveCount(0);
});
