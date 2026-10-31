import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetFields1770000000010 implements MigrationInterface {
  name = 'AddPasswordResetFields1770000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" varchar(255),
      ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP
    `);

    // Migrate default admin login email if the old seed address is still in use.
    await queryRunner.query(`
      UPDATE "users"
      SET "email" = 'admin@clockchair.com'
      WHERE "email" = 'admin@zatca.com'
        AND NOT EXISTS (
          SELECT 1 FROM "users" u2 WHERE u2."email" = 'admin@clockchair.com'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "passwordResetExpiresAt",
      DROP COLUMN IF EXISTS "passwordResetTokenHash"
    `);
  }
}
