import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZatcaPhase2ColumnsToInvoices1770000000006 implements MigrationInterface {
  name = 'AddZatcaPhase2ColumnsToInvoices1770000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "signedXmlContent" text,
      ADD COLUMN IF NOT EXISTS "invoiceHash" varchar(64),
      ADD COLUMN IF NOT EXISTS "pih" varchar(64),
      ADD COLUMN IF NOT EXISTS "zatcaUuid" varchar(128),
      ADD COLUMN IF NOT EXISTS "invoiceTypeCode" varchar(10),
      ADD COLUMN IF NOT EXISTS "zatcaStatus" varchar(20),
      ADD COLUMN IF NOT EXISTS "zatcaResponse" jsonb,
      ADD COLUMN IF NOT EXISTS "signedXmlPath" text,
      ADD COLUMN IF NOT EXISTS "jsonPath" text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      DROP COLUMN IF EXISTS "jsonPath",
      DROP COLUMN IF EXISTS "signedXmlPath",
      DROP COLUMN IF EXISTS "zatcaResponse",
      DROP COLUMN IF EXISTS "zatcaStatus",
      DROP COLUMN IF EXISTS "invoiceTypeCode",
      DROP COLUMN IF EXISTS "zatcaUuid",
      DROP COLUMN IF EXISTS "pih",
      DROP COLUMN IF EXISTS "invoiceHash",
      DROP COLUMN IF EXISTS "signedXmlContent";
    `);
  }
}

