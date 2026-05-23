module.exports = {
  'apps/api/**/*.ts': [
    'pnpm --filter @anna-maria/api lint',
    () => 'pnpm --filter @anna-maria/api type-check',
  ],
  'apps/web/**/*.{ts,tsx}': [
    'pnpm --filter @anna-maria/web lint',
    () => 'pnpm --filter @anna-maria/web type-check',
  ],
};
