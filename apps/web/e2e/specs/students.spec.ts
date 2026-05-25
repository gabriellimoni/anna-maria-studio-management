import { test, expect, stubAuth } from '../fixtures/auth';
import { mockApi } from '../fixtures/api-mock';
import { STUDENT_1, studentsList } from '../mocks/students';

test.beforeEach(async ({ page }) => {
  await stubAuth(page);
});

test('3. /students lists students and shows pagination', async ({ page }) => {
  await mockApi(page, { 'GET /students': { body: studentsList } });
  await page.goto('/students');
  await expect(page.getByRole('heading', { name: 'Alunos' })).toBeVisible();
  await expect(page.getByText('Ana Silva')).toBeVisible();
  await expect(page.getByText('Bruno Costa')).toBeVisible();
  await expect(page.getByText(/Por página:/)).toBeVisible();
});

test('4. /students/new validates and creates student', async ({ page }) => {
  const api = await mockApi(page, {
    'GET /students': { body: studentsList },
    'POST /students': { status: 201, body: { ...STUDENT_1, id: 'student-new' } },
    'GET /students/student-new': { body: { ...STUDENT_1, id: 'student-new' } },
  });

  await page.goto('/students/new');
  await expect(page.getByRole('heading', { name: 'Novo aluno' })).toBeVisible();

  // Submit empty → zod blocks; no POST fires
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Nome obrigatório')).toBeVisible();
  expect(api.findCall('POST', '/students')).toBeUndefined();

  // Fill required and submit; arm response wait BEFORE click to avoid race
  await page.getByLabel('Nome completo').fill('Carla Nova');
  const respPromise = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/students') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Salvar' }).click();
  await respPromise;

  expect(api.findCall('POST', '/students')).toBeTruthy();
  await expect(page.getByText('Aluno criado')).toBeVisible();
});

test('5. /students/:id shows detail', async ({ page }) => {
  await mockApi(page, {
    'GET /students/student-1': { body: STUDENT_1 },
    'GET /plans': { body: { data: [], total: 0, page: 1, pageSize: 20 } },
  });
  await page.goto('/students/student-1');
  await expect(page.getByRole('heading', { name: 'Ana Silva' })).toBeVisible();
});

test('6. edit student fires PATCH and shows success toast', async ({ page }) => {
  const api = await mockApi(page, {
    'GET /students/student-1': { body: STUDENT_1 },
    'PATCH /students/student-1': { body: { ...STUDENT_1, fullName: 'Ana S. Editada' } },
  });

  await page.goto('/students/student-1/edit');
  await expect(page.getByRole('heading', { name: 'Editar aluno' })).toBeVisible();

  await page.getByLabel('Nome completo').fill('Ana S. Editada');
  const respPromise = page.waitForResponse(
    (r) => /\/api\/v1\/students\/student-1$/.test(r.url()) && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Salvar' }).click();
  await respPromise;

  expect(api.findCall('PATCH', '/students/student-1')).toBeTruthy();
  await expect(page.getByText('Aluno atualizado')).toBeVisible();
});
