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
import { Invoice } from './invoice.entity';
import { DebitNoteItem } from './debit-note-item.entity';

export enum DebitNoteStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  CANCELLED = 'cancelled',
}

@Entity('debit_notes')
export class DebitNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  noteNumber: string;

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

  @Column({ type: 'uuid' })
  originalInvoiceId: string;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'originalInvoiceId' })
  originalInvoice: Invoice;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string;

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

  @Column({ type: 'enum', enum: DebitNoteStatus, default: DebitNoteStatus.DRAFT })
  status: DebitNoteStatus;

  @Column({ type: 'boolean', default: false })
  immutableFlag: boolean;

  @BeforeUpdate()
  preventUpdateIfImmutable() {
    if (this.immutableFlag || this.status === DebitNoteStatus.ISSUED) {
      throw new Error('Cannot update an issued/immutable debit note.');
    }
  }

  @Column({ type: 'text', nullable: true })
  qrCode: string;

  @Column({ type: 'text', nullable: true })
  qrCodeData: string;

  @Column({ type: 'text', nullable: true })
  xmlContent: string;

  @Column({ type: 'text', nullable: true })
  pdfPath: string;

  @Column({ type: 'text', nullable: true })
  xmlPath: string;

  @OneToMany(() => DebitNoteItem, (item) => item.debitNote, { cascade: true })
  items: DebitNoteItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
