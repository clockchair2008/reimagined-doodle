import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceDeductionFields1770000000008 implements MigrationInterface {
  name = 'AddInvoiceDeductionFields1770000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "deductionAmount" numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "deductionDescription" text,
      ADD COLUMN IF NOT EXISTS "payableAmount" numeric(10,2)
    `);

    // Backfill payableAmount for existing rows (no prior deductions).
    await queryRunner.query(`
      UPDATE "invoices"
      SET "payableAmount" = "totalAmount"
      WHERE "payableAmount" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ALTER COLUMN "payableAmount" SET NOT NULL
    `);

    // Extend immutability trigger to protect new monetary fields on issued invoices.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_invoice_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD."immutableFlag" = true OR OLD.status = 'issued' THEN
          IF (
            NEW."immutableFlag" IS DISTINCT FROM OLD."immutableFlag" OR
            NEW.status IS DISTINCT FROM OLD.status OR
            NEW."currentHash" IS DISTINCT FROM OLD."currentHash" OR
            NEW."previousHash" IS DISTINCT FROM OLD."previousHash" OR
            NEW."invoiceNumber" IS DISTINCT FROM OLD."invoiceNumber" OR
            NEW."issueDateTime" IS DISTINCT FROM OLD."issueDateTime" OR
            NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
            NEW."vatAmount" IS DISTINCT FROM OLD."vatAmount" OR
            NEW."totalAmount" IS DISTINCT FROM OLD."totalAmount" OR
            NEW."deductionAmount" IS DISTINCT FROM OLD."deductionAmount" OR
            NEW."deductionDescription" IS DISTINCT FROM OLD."deductionDescription" OR
            NEW."payableAmount" IS DISTINCT FROM OLD."payableAmount" OR
            NEW."companyId" IS DISTINCT FROM OLD."companyId" OR
            NEW."customerId" IS DISTINCT FROM OLD."customerId" OR
            NEW."xmlContent" IS DISTINCT FROM OLD."xmlContent" OR
            NEW."xmlPath" IS DISTINCT FROM OLD."xmlPath" OR
            NEW."pdfPath" IS DISTINCT FROM OLD."pdfPath" OR
            NEW."qrCode" IS DISTINCT FROM OLD."qrCode" OR
            NEW."qrCodeData" IS DISTINCT FROM OLD."qrCodeData"
          ) THEN
            RAISE EXCEPTION 'Cannot modify issued invoice. Invoice ID: %, Invoice Number: %', OLD.id, OLD."invoiceNumber";
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      DROP COLUMN IF EXISTS "payableAmount",
      DROP COLUMN IF EXISTS "deductionDescription",
      DROP COLUMN IF EXISTS "deductionAmount"
    `);

    // Restore previous trigger body (without deduction fields).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_invoice_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD."immutableFlag" = true OR OLD.status = 'issued' THEN
          IF (
            NEW."immutableFlag" != OLD."immutableFlag" OR
            NEW.status != OLD.status OR
            NEW."currentHash" != OLD."currentHash" OR
            NEW."previousHash" != OLD."previousHash" OR
            NEW."invoiceNumber" != OLD."invoiceNumber" OR
            NEW."issueDateTime" != OLD."issueDateTime" OR
            NEW.subtotal != OLD.subtotal OR
            NEW."vatAmount" != OLD."vatAmount" OR
            NEW."totalAmount" != OLD."totalAmount" OR
            NEW."companyId" != OLD."companyId" OR
            NEW."customerId" != OLD."customerId" OR
            NEW."xmlContent" != OLD."xmlContent" OR
            NEW."xmlPath" != OLD."xmlPath" OR
            NEW."pdfPath" != OLD."pdfPath" OR
            NEW."qrCode" != OLD."qrCode" OR
            NEW."qrCodeData" != OLD."qrCodeData"
          ) THEN
            RAISE EXCEPTION 'Cannot modify issued invoice. Invoice ID: %, Invoice Number: %', OLD.id, OLD."invoiceNumber";
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }
}
