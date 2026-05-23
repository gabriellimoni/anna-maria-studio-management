import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { seedPlanCatalog } from './plan-catalog.seed';

async function main() {
  await AppDataSource.initialize();
  try {
    await seedPlanCatalog(AppDataSource);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
