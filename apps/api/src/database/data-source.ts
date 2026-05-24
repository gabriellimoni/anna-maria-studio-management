import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { InitialSchema1000000000000 } from './migrations/1000000000000-InitialSchema';
import { UserAlignWithDoc021779574356000 } from './migrations/1779574356000-UserAlignWithDoc02';
import { CreateDomainSchema1779574357000 } from './migrations/1779574357000-CreateDomainSchema';
import { UserAddStudentFk1779574358000 } from './migrations/1779574358000-UserAddStudentFk';
import { MakeSessionStudentNullable1780000000000 } from './migrations/1780000000000-MakeSessionStudentNullable';

dotenv.config();

export const migrations = [
  InitialSchema1000000000000,
  UserAlignWithDoc021779574356000,
  CreateDomainSchema1779574357000,
  UserAddStudentFk1779574358000,
  MakeSessionStudentNullable1780000000000,
];

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations,
  synchronize: false,
});
