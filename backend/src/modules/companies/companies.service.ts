import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Company } from '../../entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
  ) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    // Ignore incoming logo uploads/updates.
    // Frontend may still send `logo`, but we don't persist it here.
    const { logo: _logo, ...rest } = createCompanyDto as any;
    const company = this.companyRepository.create(rest as any) as unknown as Company;
    try {
      return await this.companyRepository.save(company);
    } catch (error: any) {
      // Postgres unique_violation
      if (error instanceof QueryFailedError && error?.driverError?.code === '23505') {
        throw new ConflictException('A company with this VAT number already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<Company[]> {
    return await this.companyRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }
    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id);
    // Ignore incoming logo updates (keep existing logo).
    const { logo: _logo, ...rest } = updateCompanyDto as any;
    Object.assign(company, rest);
    return await this.companyRepository.save(company);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    try {
      await this.companyRepository.delete(id);
    } catch (error: any) {
      // Postgres foreign_key_violation: company is referenced by invoices/notes/etc.
      if (error instanceof QueryFailedError && error?.driverError?.code === '23503') {
        throw new ConflictException(
          'Cannot delete company because it is linked to existing invoices or other records',
        );
      }
      throw error;
    }
  }
}
