import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { InitialSchema1779650878115 } from './migrations/1779650878115-InitialSchema';

dotenv.config();

export const migrations = [InitialSchema1779650878115];

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations,
  synchronize: false,
});
