import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1000000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "firebaseUid" character varying NOT NULL,
        "name"        character varying NOT NULL,
        "email"       character varying NOT NULL,
        "role"        character varying NOT NULL DEFAULT 'user',
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_firebaseUid" UNIQUE ("firebaseUid"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "domain_events" (
        "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
        "action"    character varying NOT NULL,
        "entity"    character varying NOT NULL,
        "entityId"  character varying NOT NULL,
        "payload"   jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_domain_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_domain_events_entity_entityId" ON "domain_events" ("entity", "entityId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_domain_events_entity_entityId"`);
    await queryRunner.query(`DROP TABLE "domain_events"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
