import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeUpdate,
} from 'typeorm';
import { Company } from './company.entity';
import { Customer } from './customer.entity';
import { InvoiceItem } from './invoice-item.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  CANCELLED = 'cancelled',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  invoiceNumber: string;

  @Column({ type: 'timestamp' })
  issueDateTime: Date;

  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  vatAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  previousHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  currentHash: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'boolean', default: false })
  immutableFlag: boolean;

  /**
   * Entity hook to prevent updates to immutable/issued invoices
   * This provides an additional layer of protection at the entity level
   */
  @BeforeUpdate()
  preventUpdateIfImmutable() {
    if (this.immutableFlag || this.status === InvoiceStatus.ISSUED) {
      throw new Error(
        'Cannot update an issued/immutable invoice. This invoice has been finalized and cannot be modified.',
      );
    }
  }

  @Column({ type: 'text', nullable: true })
  qrCode: string; // Base64 encoded QR code image

  @Column({ type: 'text', nullable: true })
  qrCodeData: string; // TLV encoded QR code data

  @Column({ type: 'text', nullable: true })
  xmlContent: string; // UBL 2.1 XML content

  @Column({ type: 'text', nullable: true })
  pdfPath: string; // Path to stored PDF

  @Column({ type: 'text', nullable: true })
  xmlPath: string; // Path to stored XML

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
