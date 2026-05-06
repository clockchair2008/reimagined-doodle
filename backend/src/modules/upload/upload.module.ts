import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { Company } from '../../entities/company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Company])],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
