import { Module } from '@nestjs/common';
import { TreasuryModule } from '../treasury/treasury.module';
import { AiUploadService } from './ai-upload.service';
import { UploadActiveDataService } from './upload-active-data.service';
import { UploadController } from './upload.controller';
import { UploadImportService } from './upload-import.service';
import { UploadValidationService } from './upload-validation.service';

@Module({
  imports: [TreasuryModule],
  controllers: [UploadController],
  providers: [UploadValidationService, UploadImportService, UploadActiveDataService, AiUploadService],
  exports: [UploadValidationService, UploadImportService, UploadActiveDataService, AiUploadService],
})
export class UploadModule {}
