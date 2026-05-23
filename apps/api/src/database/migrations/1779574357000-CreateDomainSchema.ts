import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDomainSchema1779574357000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Domain enums
    await queryRunner.query(`CREATE TYPE "period_enum" AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual')`);
    await queryRunner.query(`CREATE TYPE "payment_method_enum" AS ENUM ('cash', 'pix', 'card', 'boleto')`);
    await queryRunner.query(`CREATE TYPE "plan_status_enum" AS ENUM ('active', 'finished', 'cancelled')`);
    await queryRunner.query(`CREATE TYPE "session_status_enum" AS ENUM ('scheduled', 'present', 'absence_notified', 'absence_unnotified', 'cancelled')`);
    await queryRunner.query(`CREATE TYPE "session_origin_enum" AS ENUM ('plan', 'drop_in')`);
    await queryRunner.query(`CREATE TYPE "receivable_source_enum" AS ENUM ('plan', 'drop_in', 'manual')`);
    await queryRunner.query(`CREATE TYPE "payable_source_enum" AS ENUM ('recurring', 'manual')`);
    await queryRunner.query(`CREATE TYPE "lancamento_status_enum" AS ENUM ('pending', 'paid')`);

    // 1. student, plan_catalog, recurring_expense (no FK dependencies)
    await queryRunner.query(`
      CREATE TABLE "student" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "full_name"   text NOT NULL,
        "phone"       text,
        "email"       text,
        "birth_date"  date,
        "notes"       text,
        "is_active"   boolean NOT NULL DEFAULT true,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "plan_catalog" (
        "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name"             text NOT NULL,
        "period"           period_enum,
        "duration_months"  int NOT NULL,
        "weekly_frequency" int NOT NULL,
        "base_price"       numeric(10,2) NOT NULL,
        "is_active"        boolean NOT NULL DEFAULT true,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plan_catalog" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "recurring_expense" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "description"     text NOT NULL,
        "category"        text,
        "expected_amount" numeric(10,2) NOT NULL,
        "due_day"         int NOT NULL CHECK (due_day BETWEEN 1 AND 28),
        "is_active"       boolean NOT NULL DEFAULT true,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recurring_expense" PRIMARY KEY ("id")
      )
    `);

    // 2. plan (depends on student, plan_catalog)
    await queryRunner.query(`
      CREATE TABLE "plan" (
        "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_id"        uuid NOT NULL REFERENCES "student"("id") ON DELETE RESTRICT,
        "plan_catalog_id"   uuid REFERENCES "plan_catalog"("id") ON DELETE SET NULL,
        "period"            period_enum NOT NULL,
        "weekly_frequency"  int NOT NULL,
        "start_date"        date NOT NULL,
        "end_date"          date NOT NULL,
        "total_price"       numeric(10,2) NOT NULL,
        "payment_method"    payment_method_enum,
        "installments_count" int NOT NULL DEFAULT 1,
        "status"            plan_status_enum NOT NULL,
        "notes"             text,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plan" PRIMARY KEY ("id")
      )
    `);

    // 3. plan_schedule, receivable, payable (depend on plan / recurring_expense)
    await queryRunner.query(`
      CREATE TABLE "plan_schedule" (
        "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id"    uuid NOT NULL REFERENCES "plan"("id") ON DELETE CASCADE,
        "weekday"    int NOT NULL,
        "start_time" time NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plan_schedule" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "receivable" (
        "id"                 uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id"            uuid REFERENCES "plan"("id") ON DELETE SET NULL,
        "source"             receivable_source_enum NOT NULL,
        "description"        text NOT NULL,
        "amount"             numeric(10,2) NOT NULL,
        "due_date"           date NOT NULL,
        "installment_number" int,
        "installment_total"  int,
        "payment_method"     payment_method_enum,
        "status"             lancamento_status_enum NOT NULL DEFAULT 'pending',
        "paid_at"            date,
        "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_receivable" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payable" (
        "id"                  uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recurring_expense_id" uuid REFERENCES "recurring_expense"("id") ON DELETE SET NULL,
        "source"              payable_source_enum NOT NULL,
        "description"         text NOT NULL,
        "category"            text,
        "amount"              numeric(10,2) NOT NULL,
        "due_date"            date NOT NULL,
        "competence_month"    date,
        "status"              lancamento_status_enum NOT NULL DEFAULT 'pending',
        "paid_at"             date,
        "payment_method"      payment_method_enum,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payable" PRIMARY KEY ("id")
      )
    `);

    // 4. session (depends on plan, student)
    await queryRunner.query(`
      CREATE TABLE "session" (
        "id"           uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id"      uuid REFERENCES "plan"("id") ON DELETE SET NULL,
        "student_id"   uuid NOT NULL REFERENCES "student"("id") ON DELETE RESTRICT,
        "scheduled_at" TIMESTAMPTZ NOT NULL,
        "status"       session_status_enum NOT NULL,
        "origin"       session_origin_enum NOT NULL DEFAULT 'plan',
        "notes"        text,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_session" PRIMARY KEY ("id")
      )
    `);

    // 5. drop_in_class (depends on session, student, receivable)
    await queryRunner.query(`
      CREATE TABLE "drop_in_class" (
        "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id"     uuid REFERENCES "session"("id") ON DELETE CASCADE,
        "student_id"     uuid REFERENCES "student"("id") ON DELETE SET NULL,
        "prospect_name"  text,
        "receivable_id"  uuid REFERENCES "receivable"("id") ON DELETE SET NULL,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_drop_in_class" PRIMARY KEY ("id")
      )
    `);

    // 6. Indexes
    await queryRunner.query(`CREATE INDEX "IDX_session_scheduled_at" ON "session" ("scheduled_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_session_student_scheduled" ON "session" ("student_id", "scheduled_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_session_plan_id" ON "session" ("plan_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_receivable_due_date_status" ON "receivable" ("due_date", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_receivable_plan_id" ON "receivable" ("plan_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payable_due_date_status" ON "payable" ("due_date", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_payable_recurring_competence" ON "payable" ("recurring_expense_id", "competence_month")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_payable_recurring_competence" ON "payable" ("recurring_expense_id", "competence_month") WHERE source = 'recurring'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_payable_recurring_competence"`);
    await queryRunner.query(`DROP INDEX "IDX_payable_recurring_competence"`);
    await queryRunner.query(`DROP INDEX "IDX_payable_due_date_status"`);
    await queryRunner.query(`DROP INDEX "IDX_receivable_plan_id"`);
    await queryRunner.query(`DROP INDEX "IDX_receivable_due_date_status"`);
    await queryRunner.query(`DROP INDEX "IDX_session_plan_id"`);
    await queryRunner.query(`DROP INDEX "IDX_session_student_scheduled"`);
    await queryRunner.query(`DROP INDEX "IDX_session_scheduled_at"`);
    await queryRunner.query(`DROP TABLE "drop_in_class"`);
    await queryRunner.query(`DROP TABLE "session"`);
    await queryRunner.query(`DROP TABLE "payable"`);
    await queryRunner.query(`DROP TABLE "receivable"`);
    await queryRunner.query(`DROP TABLE "plan_schedule"`);
    await queryRunner.query(`DROP TABLE "plan"`);
    await queryRunner.query(`DROP TABLE "recurring_expense"`);
    await queryRunner.query(`DROP TABLE "plan_catalog"`);
    await queryRunner.query(`DROP TABLE "student"`);
    await queryRunner.query(`DROP TYPE "lancamento_status_enum"`);
    await queryRunner.query(`DROP TYPE "payable_source_enum"`);
    await queryRunner.query(`DROP TYPE "receivable_source_enum"`);
    await queryRunner.query(`DROP TYPE "session_origin_enum"`);
    await queryRunner.query(`DROP TYPE "session_status_enum"`);
    await queryRunner.query(`DROP TYPE "plan_status_enum"`);
    await queryRunner.query(`DROP TYPE "payment_method_enum"`);
    await queryRunner.query(`DROP TYPE "period_enum"`);
  }
}
