import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InvoiceSequence } from '../entities/invoice-sequence.entity';

@Injectable()
export class InvoiceSequenceService {
  constructor(
    @InjectRepository(InvoiceSequence)
    private sequenceRepository: Repository<InvoiceSequence>,
    private dataSource: DataSource,
  ) {}

  /**
   * Get next invoice number for company (e.g. INV-1, INV-2). Thread-safe via transaction.
   */
  async getNextInvoiceNumber(companyId: string): Promise<string> {
    return this.dataSource.transaction(async (em) => {
      let seq = await em.findOne(InvoiceSequence, { where: { companyId } });
      if (!seq) {
        seq = em.create(InvoiceSequence, {
          companyId,
          lastInvoiceNumber: 0,
          lastCreditNoteNumber: 0,
          lastDebitNoteNumber: 0,
        });
        await em.save(seq);
      }
      seq.lastInvoiceNumber = (seq.lastInvoiceNumber || 0) + 1;
      await em.save(seq);
      return `INV-${seq.lastInvoiceNumber}`;
    });
  }

  /**
   * Get next credit note number for company (e.g. CN-1, CN-2).
   */
  async getNextCreditNoteNumber(companyId: string): Promise<string> {
    return this.dataSource.transaction(async (em) => {
      let seq = await em.findOne(InvoiceSequence, { where: { companyId } });
      if (!seq) {
        seq = em.create(InvoiceSequence, {
          companyId,
          lastInvoiceNumber: 0,
          lastCreditNoteNumber: 0,
          lastDebitNoteNumber: 0,
        });
        await em.save(seq);
      }
      seq.lastCreditNoteNumber = (seq.lastCreditNoteNumber || 0) + 1;
      await em.save(seq);
      return `CN-${seq.lastCreditNoteNumber}`;
    });
  }

  /**
   * Get next debit note number for company (e.g. DN-1, DN-2).
   */
  async getNextDebitNoteNumber(companyId: string): Promise<string> {
    return this.dataSource.transaction(async (em) => {
      let seq = await em.findOne(InvoiceSequence, { where: { companyId } });
      if (!seq) {
        seq = em.create(InvoiceSequence, {
          companyId,
          lastInvoiceNumber: 0,
          lastCreditNoteNumber: 0,
          lastDebitNoteNumber: 0,
        });
        await em.save(seq);
      }
      seq.lastDebitNoteNumber = (seq.lastDebitNoteNumber || 0) + 1;
      await em.save(seq);
      return `DN-${seq.lastDebitNoteNumber}`;
    });
  }
}
