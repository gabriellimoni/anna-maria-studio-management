import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { InitialSchema1779650878115 } from './migrations/1779650878115-InitialSchema';
import { AddStudentFiscalAndAddressFields1779708877206 } from './migrations/1779708877206-AddStudentFiscalAndAddressFields';
import { AddPayableRecurringUniqueIndex1779716234103 } from './migrations/1779716234103-AddPayableRecurringUniqueIndex';

dotenv.config();

export const migrations = [InitialSchema1779650878115, AddStudentFiscalAndAddressFields1779708877206, AddPayableRecurringUniqueIndex1779716234103];

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations,
  synchronize: false,
});
