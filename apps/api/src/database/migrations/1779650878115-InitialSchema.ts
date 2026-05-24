import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1779650878115 implements MigrationInterface {
    name = 'InitialSchema1779650878115'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enum types (declared once each)
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('operator')`);
        await queryRunner.query(`CREATE TYPE "public"."period_enum" AS ENUM('monthly', 'quarterly', 'semiannual', 'annual')`);
        await queryRunner.query(`CREATE TYPE "public"."receivable_source_enum" AS ENUM('plan', 'drop_in', 'manual')`);
        await queryRunner.query(`CREATE TYPE "public"."payment_method_enum" AS ENUM('cash', 'pix', 'card', 'boleto')`);
        await queryRunner.query(`CREATE TYPE "public"."lancamento_status_enum" AS ENUM('pending', 'paid')`);
        await queryRunner.query(`CREATE TYPE "public"."session_status_enum" AS ENUM('scheduled', 'present', 'absence_notified', 'absence_unnotified', 'cancelled')`);
        await queryRunner.query(`CREATE TYPE "public"."session_origin_enum" AS ENUM('plan', 'drop_in')`);
        await queryRunner.query(`CREATE TYPE "public"."plan_status_enum" AS ENUM('active', 'finished', 'cancelled')`);
        await queryRunner.query(`CREATE TYPE "public"."payable_source_enum" AS ENUM('recurring', 'manual')`);
        await queryRunner.query(`CREATE TYPE "public"."plan_contract_status" AS ENUM('draft', 'sent', 'signed', 'cancelled')`);

        // Tables
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "firebaseUid" character varying NOT NULL, "email" character varying NOT NULL, "role" "public"."user_role_enum" NOT NULL DEFAULT 'operator', "is_active" boolean NOT NULL DEFAULT true, "student_id" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_905432b2c46bdcfe1a0dd3cdeff" UNIQUE ("firebaseUid"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "domain_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying NOT NULL, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "payload" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_66e0920a32dda3a89b46ee7a981" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "student" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "full_name" text NOT NULL, "phone" text, "email" text, "birth_date" date, "notes" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3d8016e1cb58429474a3c041904" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "recurring_expense" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "description" text NOT NULL, "category" text, "expected_amount" numeric(10,2) NOT NULL, "due_day" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e10f09121d23af7e23a0028ba00" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "receivable" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plan_id" uuid, "source" "public"."receivable_source_enum" NOT NULL, "description" text NOT NULL, "amount" numeric(10,2) NOT NULL, "due_date" date NOT NULL, "installment_number" integer, "installment_total" integer, "payment_method" "public"."payment_method_enum", "status" "public"."lancamento_status_enum" NOT NULL DEFAULT 'pending', "paid_at" date, "invoice_generated" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_21914351fc68743079856ee3b1f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "session" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plan_id" uuid, "student_id" uuid, "scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."session_status_enum" NOT NULL, "origin" "public"."session_origin_enum" NOT NULL DEFAULT 'plan', "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "plan" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "student_id" uuid NOT NULL, "plan_catalog_id" uuid, "period" "public"."period_enum" NOT NULL, "weekly_frequency" integer NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "total_price" numeric(10,2) NOT NULL, "payment_method" "public"."payment_method_enum", "installments_count" integer NOT NULL DEFAULT '1', "status" "public"."plan_status_enum" NOT NULL, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_54a2b686aed3b637654bf7ddbb3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "plan_schedule" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plan_id" uuid NOT NULL, "weekday" integer NOT NULL, "start_time" TIME NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b94a564c9bdb6511358e1079afe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "plan_catalog" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "period" "public"."period_enum", "duration_months" integer NOT NULL, "weekly_frequency" integer NOT NULL, "base_price" numeric(10,2) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c812ee062af4e78be76d984f828" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "payable" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "recurring_expense_id" uuid, "source" "public"."payable_source_enum" NOT NULL, "description" text NOT NULL, "category" text, "amount" numeric(10,2) NOT NULL, "due_date" date NOT NULL, "competence_month" date, "status" "public"."lancamento_status_enum" NOT NULL DEFAULT 'pending', "paid_at" date, "payment_method" "public"."payment_method_enum", "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c451177bd6644fd97344ea3761" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "drop_in_class" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" uuid, "student_id" uuid, "prospect_name" text, "receivable_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ae8cb2177cbedc7f930fde69e8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "contract_template" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "body_markdown" text NOT NULL, "version" integer NOT NULL DEFAULT '1', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4bd19cbbc18731c95e0fe5004bb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "plan_contract" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plan_id" uuid NOT NULL, "template_id" uuid NOT NULL, "template_version" integer NOT NULL, "body_markdown" text NOT NULL, "resolved_variables" jsonb, "rendered_html" text, "content_hash" character varying(64), "status" "public"."plan_contract_status" NOT NULL DEFAULT 'draft', "access_token" character varying(64), "sent_at" TIMESTAMP WITH TIME ZONE, "signed_at" TIMESTAMP WITH TIME ZONE, "cancelled_at" TIMESTAMP WITH TIME ZONE, "signature_image" text, "signed_pdf_path" character varying, "signer_ip" character varying(45), "signer_user_agent" character varying(500), "signer_geo_city" character varying, "signer_geo_region" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bae609ba310f1b91ee409bc8d07" PRIMARY KEY ("id"))`);

        // Indexes
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_064051a37ffdd5d2fa80654754" ON "plan_contract" ("plan_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3df54f52b96188439f159e51e7" ON "plan_contract" ("access_token") WHERE "access_token" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_3df54f52b96188439f159e51e7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_064051a37ffdd5d2fa80654754"`);
        await queryRunner.query(`DROP TABLE "plan_contract"`);
        await queryRunner.query(`DROP TABLE "contract_template"`);
        await queryRunner.query(`DROP TABLE "drop_in_class"`);
        await queryRunner.query(`DROP TABLE "payable"`);
        await queryRunner.query(`DROP TABLE "plan_catalog"`);
        await queryRunner.query(`DROP TABLE "plan_schedule"`);
        await queryRunner.query(`DROP TABLE "plan"`);
        await queryRunner.query(`DROP TABLE "session"`);
        await queryRunner.query(`DROP TABLE "receivable"`);
        await queryRunner.query(`DROP TABLE "recurring_expense"`);
        await queryRunner.query(`DROP TABLE "student"`);
        await queryRunner.query(`DROP TABLE "domain_events"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "public"."plan_contract_status"`);
        await queryRunner.query(`DROP TYPE "public"."payable_source_enum"`);
        await queryRunner.query(`DROP TYPE "public"."plan_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."session_origin_enum"`);
        await queryRunner.query(`DROP TYPE "public"."session_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."lancamento_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payment_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."receivable_source_enum"`);
        await queryRunner.query(`DROP TYPE "public"."period_enum"`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
    }

}
