import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAlignWithDoc021779574356000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "user_role_enum" AS ENUM ('operator')`);
    await queryRunner.query(`ALTER TABLE "users" RENAME TO "user"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "name"`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "student_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "user"
        ALTER COLUMN "role" TYPE user_role_enum
        USING 'operator'::user_role_enum,
        ALTER COLUMN "role" SET DEFAULT 'operator'
    `);
    await queryRunner.query(`ALTER INDEX "UQ_users_firebaseUid" RENAME TO "UQ_user_firebaseUid"`);
    await queryRunner.query(`ALTER INDEX "PK_users" RENAME TO "PK_user"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER INDEX "PK_user" RENAME TO "PK_users"`);
    await queryRunner.query(`ALTER INDEX "UQ_user_firebaseUid" RENAME TO "UQ_users_firebaseUid"`);
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" TYPE character varying USING role::text, ALTER COLUMN "role" SET DEFAULT 'user'`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "student_id"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "is_active"`);
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "name" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "user" RENAME TO "users"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}
