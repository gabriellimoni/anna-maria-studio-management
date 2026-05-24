import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeSessionStudentNullable1780000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "session" ALTER COLUMN "student_id" DROP NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "session" ALTER COLUMN "student_id" SET NOT NULL`);
  }
}
