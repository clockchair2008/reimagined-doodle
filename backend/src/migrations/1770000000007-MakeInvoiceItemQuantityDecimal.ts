import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = ['invoice_items', 'credit_note_items', 'debit_note_items'];

export class MakeInvoiceItemQuantityDecimal1770000000007 implements MigrationInterface {
  name = 'MakeInvoiceItemQuantityDecimal1770000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(`
        ALTER TABLE ${table}
        ALTER COLUMN quantity TYPE numeric(10,3);
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(`
        ALTER TABLE ${table}
        ALTER COLUMN quantity TYPE integer USING ROUND(quantity);
      `);
    }
  }
}
