import { DataSource } from 'typeorm';

const CATALOG_ITEMS = [
  { name: 'Mensal 1x', period: 'monthly', duration_months: 1, weekly_frequency: 1, base_price: '180.00' },
  { name: 'Mensal 2x', period: 'monthly', duration_months: 1, weekly_frequency: 2, base_price: '280.00' },
  { name: 'Mensal 3x', period: 'monthly', duration_months: 1, weekly_frequency: 3, base_price: '360.00' },
  { name: 'Trimestral 1x', period: 'quarterly', duration_months: 3, weekly_frequency: 1, base_price: '510.00' },
  { name: 'Trimestral 2x', period: 'quarterly', duration_months: 3, weekly_frequency: 2, base_price: '780.00' },
  { name: 'Trimestral 3x', period: 'quarterly', duration_months: 3, weekly_frequency: 3, base_price: '990.00' },
  { name: 'Semestral 2x', period: 'semiannual', duration_months: 6, weekly_frequency: 2, base_price: '1500.00' },
  { name: 'Anual 2x', period: 'annual', duration_months: 12, weekly_frequency: 2, base_price: '2880.00' },
];

export async function seedPlanCatalog(dataSource: DataSource): Promise<void> {
  let inserted = 0;
  for (const item of CATALOG_ITEMS) {
    const existing = await dataSource.query(`SELECT id FROM plan_catalog WHERE name = $1`, [item.name]);
    if (existing.length === 0) {
      await dataSource.query(
        `INSERT INTO plan_catalog (name, period, duration_months, weekly_frequency, base_price, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [item.name, item.period, item.duration_months, item.weekly_frequency, item.base_price],
      );
      inserted++;
    }
  }
  console.log(`plan_catalog seed: ${inserted} inserted, ${CATALOG_ITEMS.length - inserted} already existed.`);
}
