# Database Migrations

This directory contains database migrations for the ZATCA E-Invoicing system.

## Important Migration

### `1700000000000-AddInvoiceProtectionTriggers.ts`

This migration adds critical security protections:

1. **Invoice Update Protection Trigger**
   - Prevents any modification to issued/immutable invoices
   - Blocks changes to critical fields: hash, status, amounts, dates, etc.
   - Provides database-level protection against direct SQL manipulation

2. **Invoice Item Protection Triggers**
   - Prevents modification/deletion of invoice items when parent invoice is issued
   - Protects against cascade operations on immutable invoices

3. **Data Integrity Constraints**
   - Ensures `immutableFlag` and `status` are consistent
   - Requires `currentHash` to be set when invoice is issued
   - Prevents invalid state combinations

### `1770000000007-MakeInvoiceItemQuantityDecimal.ts`

Allows fractional quantities (e.g. `1.5`, `0.25`) on invoice, credit note and debit note lines.
Changes `quantity` on `invoice_items`, `credit_note_items` and `debit_note_items` from `integer` to `numeric(10,3)`.
Existing quantities are kept as-is (e.g. `3` becomes `3.000`).

**How to run (once, after pulling this update):**

```bash
cd backend
npm install
npm run migration:run
```

Then restart the backend. Take a database backup first if this is a production server.
To undo: `npm run migration:revert` (quantities get rounded back to whole numbers).

### `1770000000008-AddInvoiceDeductionFields.ts`

Adds invoice-level deduction support:

- `deductionAmount` — amount deducted from the tax-inclusive total
- `deductionDescription` — reason (advance payment, retention, discount, etc.)
- `payableAmount` — amount due after deduction
- Extends issued-invoice protection triggers to cover these columns

**Fresh Neon DB:** prefer `npm run db:bootstrap` (sync entities + run migrations). See `DEPLOY_NEON_RAILWAY.md`.

## Running Migrations

```bash
# Generate a new migration
npm run migration:generate -- -n MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

## Security Note

These migrations are critical for invoice integrity. Never skip or modify them in production.
