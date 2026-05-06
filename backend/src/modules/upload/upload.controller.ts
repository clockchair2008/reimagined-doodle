import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString } from 'class-validator';

export class UploadLogoDto {
  @IsString()
  logo: string; // Base64 encoded logo
}

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /upload/logo/:companyId
   * Store a logo for a company
   */
  @Post('logo/:companyId')
  async storeLogo(
    @Param('companyId') companyId: string,
    @Body() dto: UploadLogoDto,
  ) {
    return this.uploadService.storeLogo(companyId, dto.logo);
  }

  /**
   * PATCH /upload/logo/:companyId
   * Update a logo for a specific company
   */
  @Patch('logo/:companyId')
  async updateLogo(
    @Param('companyId') companyId: string,
    @Body() dto: UploadLogoDto,
  ) {
    return this.uploadService.updateLogo(companyId, dto.logo);
  }

  /**
   * GET /upload/logo/:companyId
   * Get logo for a specific company
   */
  @Get('logo/:companyId')
  async getLogo(@Param('companyId') companyId: string) {
    return this.uploadService.getLogo(companyId);
  }
}
