import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContractsSchema1780100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE plan_contract_status AS ENUM ('draft', 'sent', 'signed', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TABLE contract_template (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar NOT NULL,
        body_markdown text NOT NULL,
        version int NOT NULL DEFAULT 1,
        is_active bool NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE plan_contract (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id uuid NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
        template_id uuid NOT NULL REFERENCES contract_template(id) ON DELETE RESTRICT,
        template_version int NOT NULL,
        body_markdown text NOT NULL,
        resolved_variables jsonb,
        rendered_html text,
        content_hash varchar(64),
        status plan_contract_status NOT NULL DEFAULT 'draft',
        access_token varchar(64),
        sent_at timestamptz,
        signed_at timestamptz,
        cancelled_at timestamptz,
        signature_image text,
        signed_pdf_path varchar,
        signer_ip varchar(45),
        signer_user_agent varchar(500),
        signer_geo_city varchar,
        signer_geo_region varchar,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT plan_contract_plan_id_unique UNIQUE (plan_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_plan_contract_status ON plan_contract(status)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_plan_contract_access_token ON plan_contract(access_token) WHERE access_token IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_plan_contract_access_token`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_plan_contract_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS plan_contract`);
    await queryRunner.query(`DROP TABLE IF EXISTS contract_template`);
    await queryRunner.query(`DROP TYPE IF EXISTS plan_contract_status`);
  }
}
