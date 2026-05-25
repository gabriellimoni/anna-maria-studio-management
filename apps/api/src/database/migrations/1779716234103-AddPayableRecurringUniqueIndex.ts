import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayableRecurringUniqueIndex1779716234103 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_payable_recurring_competence"
      ON "payable" ("recurring_expense_id", "competence_month")
      WHERE "source" = 'recurring'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_payable_recurring_competence"`);
  }
}
