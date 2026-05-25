import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStudentFiscalAndAddressFields1779708877206 implements MigrationInterface {
    name = 'AddStudentFiscalAndAddressFields1779708877206'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student" ADD "cpf" character varying`);
        await queryRunner.query(`ALTER TABLE "student" ADD "rg" character varying`);
        await queryRunner.query(`ALTER TABLE "student" ADD "address_street" character varying`);
        await queryRunner.query(`ALTER TABLE "student" ADD "address_number" character varying`);
        await queryRunner.query(`ALTER TABLE "student" ADD "address_complement" character varying`);
        await queryRunner.query(`ALTER TABLE "student" ADD "address_city" character varying`);
        await queryRunner.query(`ALTER TABLE "student" ADD "address_state" character varying`);
        await queryRunner.query(`ALTER TABLE "student" ADD "address_zipcode" character varying`);
        await queryRunner.query(`ALTER TYPE "public"."user_role_enum" RENAME TO "user_role_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('operator')`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" TYPE "public"."user_role_enum" USING "role"::"text"::"public"."user_role_enum"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'operator'`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."session_status_enum" RENAME TO "session_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."session_status_enum" AS ENUM('scheduled', 'present', 'absence_notified', 'absence_unnotified', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "session" ALTER COLUMN "status" TYPE "public"."session_status_enum" USING "status"::"text"::"public"."session_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."session_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."session_origin_enum" RENAME TO "session_origin_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."session_origin_enum" AS ENUM('plan', 'drop_in')`);
        await queryRunner.query(`ALTER TABLE "session" ALTER COLUMN "origin" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "session" ALTER COLUMN "origin" TYPE "public"."session_origin_enum" USING "origin"::"text"::"public"."session_origin_enum"`);
        await queryRunner.query(`ALTER TABLE "session" ALTER COLUMN "origin" SET DEFAULT 'plan'`);
        await queryRunner.query(`DROP TYPE "public"."session_origin_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."receivable_source_enum" RENAME TO "receivable_source_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."receivable_source_enum" AS ENUM('plan', 'drop_in', 'manual')`);
        await queryRunner.query(`ALTER TABLE "receivable" ALTER COLUMN "source" TYPE "public"."receivable_source_enum" USING "source"::"text"::"public"."receivable_source_enum"`);
        await queryRunner.query(`DROP TYPE "public"."receivable_source_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."plan_status_enum" RENAME TO "plan_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."plan_status_enum" AS ENUM('active', 'finished', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "plan" ALTER COLUMN "status" TYPE "public"."plan_status_enum" USING "status"::"text"::"public"."plan_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."plan_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."payable_source_enum" RENAME TO "payable_source_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."payable_source_enum" AS ENUM('recurring', 'manual')`);
        await queryRunner.query(`ALTER TABLE "payable" ALTER COLUMN "source" TYPE "public"."payable_source_enum" USING "source"::"text"::"public"."payable_source_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payable_source_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."payable_source_enum_old" AS ENUM('recurring', 'manual')`);
        await queryRunner.query(`ALTER TABLE "payable" ALTER COLUMN "source" TYPE "public"."payable_source_enum_old" USING "source"::"text"::"public"."payable_source_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."payable_source_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."payable_source_enum_old" RENAME TO "payable_source_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."plan_status_enum_old" AS ENUM('active', 'finished', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "plan" ALTER COLUMN "status" TYPE "public"."plan_status_enum_old" USING "status"::"text"::"public"."plan_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."plan_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."plan_status_enum_old" RENAME TO "plan_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."receivable_source_enum_old" AS ENUM('plan', 'drop_in', 'manual')`);
        await queryRunner.query(`ALTER TABLE "receivable" ALTER COLUMN "source" TYPE "public"."receivable_source_enum_old" USING "source"::"text"::"public"."receivable_source_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."receivable_source_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."receivable_source_enum_old" RENAME TO "receivable_source_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."session_origin_enum_old" AS ENUM('plan', 'drop_in')`);
        await queryRunner.query(`ALTER TABLE "session" ALTER COLUMN "origin" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "session" ALTER COLUMN "origin" TYPE "public"."session_origin_enum_old" USING "origin"::"text"::"public"."session_origin_enum_old"`);
        await queryRunner.query(`ALTER TABLE "session" ALTER COLUMN "origin" SET DEFAULT 'plan'`);
        await queryRunner.query(`DROP TYPE "public"."session_origin_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."session_origin_enum_old" RENAME TO "session_origin_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."session_status_enum_old" AS ENUM('scheduled', 'present', 'absence_notified', 'absence_unnotified', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "session" ALTER COLUMN "status" TYPE "public"."session_status_enum_old" USING "status"::"text"::"public"."session_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."session_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."session_status_enum_old" RENAME TO "session_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum_old" AS ENUM('operator')`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" TYPE "public"."user_role_enum_old" USING "role"::"text"::"public"."user_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'operator'`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."user_role_enum_old" RENAME TO "user_role_enum"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "address_zipcode"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "address_state"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "address_city"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "address_complement"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "address_number"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "address_street"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "rg"`);
        await queryRunner.query(`ALTER TABLE "student" DROP COLUMN "cpf"`);
    }

}
