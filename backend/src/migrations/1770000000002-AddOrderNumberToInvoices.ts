import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderNumberToInvoices1770000000002 implements MigrationInterface {
  name = 'AddOrderNumberToInvoices1770000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS order_number varchar(100);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE invoices
      DROP COLUMN IF EXISTS order_number;
    `);
  }
}

