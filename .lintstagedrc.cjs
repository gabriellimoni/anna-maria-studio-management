module.exports = {
  'apps/api/**/*.ts': [
    'pnpm --filter @representante-vendas/api lint',
    () => 'pnpm --filter @representante-vendas/api type-check',
  ],
  'apps/web/**/*.{ts,tsx}': [
    'pnpm --filter @representante-vendas/web lint',
    () => 'pnpm --filter @representante-vendas/web type-check',
  ],
};
