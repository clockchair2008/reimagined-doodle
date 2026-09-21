/**
 * Bootstrap a fresh Postgres / Neon database:
 * 1) Create all tables from TypeORM entities (synchronize)
 * 2) Run pending migrations (triggers, indexes, new columns)
 *
 * Usage (from backend/):
 *   DATABASE_URL="postgresql://...?...sslmode=require" npm run db:bootstrap
 */
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';
import { Company } from '../entities/company.entity';
import { Customer } from '../entities/customer.entity';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { InvoiceSequence } from '../entities/invoice-sequence.entity';
import { CreditNote } from '../entities/credit-note.entity';
import { CreditNoteItem } from '../entities/credit-note-item.entity';
import { DebitNote } from '../entities/debit-note.entity';
import { DebitNoteItem } from '../entities/debit-note-item.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';

config({ path: path.join(__dirname, '../../.env') });

async function bootstrap() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const sslRejectUnauthorized =
    process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

  if (!databaseUrl) {
    console.error('DATABASE_URL is required for db:bootstrap (Neon connection string).');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const syncDs = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ssl: { rejectUnauthorized: sslRejectUnauthorized },
    entities: [
      Company,
      Customer,
      Invoice,
      InvoiceItem,
      InvoiceSequence,
      CreditNote,
      CreditNoteItem,
      DebitNote,
      DebitNoteItem,
      AuditLog,
      User,
    ],
    synchronize: true,
    logging: false,
  });

  await syncDs.initialize();
  console.log('Schema synchronized from entities.');
  await syncDs.destroy();

  const migrationDs = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ssl: { rejectUnauthorized: sslRejectUnauthorized },
    migrations: ['src/migrations/*.ts'],
    migrationsTableName: 'migrations',
  });

  await migrationDs.initialize();
  const executed = await migrationDs.runMigrations();
  console.log(
    executed.length
      ? `Ran ${executed.length} migration(s): ${executed.map((m) => m.name).join(', ')}`
      : 'No pending migrations.',
  );
  await migrationDs.destroy();

  console.log('\nDone. Next: npm run seed:admin');
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
