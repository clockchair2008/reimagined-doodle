import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceProtectionTriggers1700000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create function to prevent invoice modification after issuance
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_invoice_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Prevent any modification to issued/immutable invoices
        IF OLD.immutable_flag = true OR OLD.status = 'issued' THEN
          -- Allow only update to updatedAt timestamp (automatic)
          IF (
            NEW.immutable_flag != OLD.immutable_flag OR
            NEW.status != OLD.status OR
            NEW.current_hash != OLD.current_hash OR
            NEW.previous_hash != OLD.previous_hash OR
            NEW.invoice_number != OLD.invoice_number OR
            NEW.issue_date_time != OLD.issue_date_time OR
            NEW.subtotal != OLD.subtotal OR
            NEW.vat_amount != OLD.vat_amount OR
            NEW.total_amount != OLD.total_amount OR
            NEW.company_id != OLD.company_id OR
            NEW.customer_id != OLD.customer_id OR
            NEW.xml_content != OLD.xml_content OR
            NEW.xml_path != OLD.xml_path OR
            NEW.pdf_path != OLD.pdf_path OR
            NEW.qr_code != OLD.qr_code OR
            NEW.qr_code_data != OLD.qr_code_data
          ) THEN
            RAISE EXCEPTION 'Cannot modify issued invoice. Invoice ID: %, Invoice Number: %', OLD.id, OLD.invoice_number;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger for invoice table
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS invoice_update_protection ON invoices;
      CREATE TRIGGER invoice_update_protection
      BEFORE UPDATE ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION prevent_invoice_modification();
    `);

    // Create function to prevent invoice item modification after invoice issuance
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_invoice_item_modification()
      RETURNS TRIGGER AS $$
      DECLARE
        invoice_immutable BOOLEAN;
        invoice_status VARCHAR;
      BEGIN
        -- Check if parent invoice is immutable or issued
        SELECT immutable_flag, status INTO invoice_immutable, invoice_status
        FROM invoices
        WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

        IF invoice_immutable = true OR invoice_status = 'issued' THEN
          RAISE EXCEPTION 'Cannot modify items of issued invoice. Invoice ID: %', COALESCE(NEW.invoice_id, OLD.invoice_id);
        END IF;

        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger for invoice_items table (UPDATE)
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS invoice_item_update_protection ON invoice_items;
      CREATE TRIGGER invoice_item_update_protection
      BEFORE UPDATE ON invoice_items
      FOR EACH ROW
      EXECUTE FUNCTION prevent_invoice_item_modification();
    `);

    // Create trigger for invoice_items table (DELETE)
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS invoice_item_delete_protection ON invoice_items;
      CREATE TRIGGER invoice_item_delete_protection
      BEFORE DELETE ON invoice_items
      FOR EACH ROW
      EXECUTE FUNCTION prevent_invoice_item_modification();
    `);

    // Add CHECK constraint to ensure data integrity
    await queryRunner.query(`
      ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS check_immutable_integrity;
      
      ALTER TABLE invoices
      ADD CONSTRAINT check_immutable_integrity
      CHECK (
        (immutable_flag = false AND status = 'draft') OR
        (immutable_flag = true AND status = 'issued') OR
        (status = 'cancelled')
      );
    `);

    // Add constraint to ensure currentHash is set when invoice is issued
    await queryRunner.query(`
      ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS check_hash_on_issued;
      
      ALTER TABLE invoices
      ADD CONSTRAINT check_hash_on_issued
      CHECK (
        (status != 'issued' OR current_hash IS NOT NULL)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS invoice_update_protection ON invoices;
      DROP TRIGGER IF EXISTS invoice_item_update_protection ON invoice_items;
      DROP TRIGGER IF EXISTS invoice_item_delete_protection ON invoice_items;
    `);

    // Drop functions
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS prevent_invoice_modification();
      DROP FUNCTION IF EXISTS prevent_invoice_item_modification();
    `);

    // Drop constraints
    await queryRunner.query(`
      ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS check_immutable_integrity;
      
      ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS check_hash_on_issued;
    `);
  }
}
