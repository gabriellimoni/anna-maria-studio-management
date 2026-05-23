import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAddStudentFk1779574358000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
        ADD CONSTRAINT "FK_user_student_id" FOREIGN KEY ("student_id")
        REFERENCES "student"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_user_student_id"`);
  }
}
