import { test, expect, stubAuth } from '../fixtures/auth';
import { mockApi } from '../fixtures/api-mock';
import { PUBLIC_CONTRACT, SIGNED_PUBLIC_CONTRACT, templatesList } from '../mocks/contracts';

test('16. /contratos/templates lists templates', async ({ page }) => {
  await stubAuth(page);
  const api = await mockApi(page, {
    'GET /contract-templates': { body: templatesList },
  });

  await page.goto('/contratos/templates');
  await expect(page.getByRole('heading', { name: 'Templates de contrato' })).toBeVisible();
  await expect(page.getByText('Contrato padrão')).toBeVisible();
  expect(api.findCall('GET', '/contract-templates')).toBeTruthy();
});

test('17. /contrato/:token — view public contract; sign button disabled until agreed+signed', async ({ page }) => {
  let signed = false;
  await mockApi(page, {
    'GET /public/contracts/test-token': () => (signed ? { body: SIGNED_PUBLIC_CONTRACT } : { body: PUBLIC_CONTRACT }),
    'POST /public/contracts/test-token/sign': () => {
      signed = true;
      return { status: 200, body: SIGNED_PUBLIC_CONTRACT };
    },
  });

  await page.goto('/contrato/test-token');
  await expect(page.getByRole('heading', { name: /contrato para assinatura/i })).toBeVisible();
  await expect(page.getByText(/Termos do contrato/)).toBeVisible();

  const signBtn = page.getByRole('button', { name: /assinar contrato/i });
  await expect(signBtn).toBeDisabled();

  await page.getByRole('checkbox', { name: /li e concordo/i }).check();
  // Still disabled because signature canvas hasn't been signed
  await expect(signBtn).toBeDisabled();
});
