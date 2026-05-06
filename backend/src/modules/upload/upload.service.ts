import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../entities/company.entity';

@Injectable()
export class UploadService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
  ) {}

  /**
   * Store a logo for a company
   * @param companyId - The company ID
   * @param logoData - Base64 encoded logo data
   * @returns Updated company with logo
   */
  async storeLogo(companyId: string, logoData: string): Promise<Company> {
    if (!logoData) {
      throw new BadRequestException('Logo data is required');
    }

    // Validate base64 format (basic check)
    if (!this.isValidBase64(logoData)) {
      throw new BadRequestException('Invalid base64 logo data');
    }

    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    company.logo = logoData;
    return await this.companyRepository.save(company);
  }

  /**
   * Update a logo for a company
   * @param companyId - The company ID
   * @param logoData - Base64 encoded logo data
   * @returns Updated company with new logo
   */
  async updateLogo(companyId: string, logoData: string): Promise<Company> {
    if (!logoData) {
      throw new BadRequestException('Logo data is required');
    }

    // Validate base64 format (basic check)
    if (!this.isValidBase64(logoData)) {
      throw new BadRequestException('Invalid base64 logo data');
    }

    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    company.logo = logoData;
    return await this.companyRepository.save(company);
  }

  /**
   * Get logo for a company
   * @param companyId - The company ID
   * @returns Company with logo
   */
  async getLogo(companyId: string): Promise<{ logo: string }> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    if (!company.logo) {
      throw new NotFoundException(`No logo found for company ${companyId}`);
    }

    return { logo: company.logo };
  }

  /**
   * Validate base64 string
   */
  private isValidBase64(str: string): boolean {
    try {
      return Buffer.from(str, 'base64').toString('base64') === str;
    } catch (err) {
      return false;
    }
  }
}
