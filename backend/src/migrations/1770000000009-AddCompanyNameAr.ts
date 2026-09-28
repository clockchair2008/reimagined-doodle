import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyNameAr1770000000009 implements MigrationInterface {
  name = 'AddCompanyNameAr1770000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS "nameAr" varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
      DROP COLUMN IF EXISTS "nameAr"
    `);
  }
}
