import { Injectable } from '@nestjs/common';
import {
  UploadTemplateType,
  UploadValidationResult,
  ValidateUploadOptions,
  validateUpload,
} from '@liqvia2/shared';

@Injectable()
export class UploadValidationService {
  validate<T = unknown>(
    templateType: UploadTemplateType,
    csvContent: string,
    options?: ValidateUploadOptions,
  ): UploadValidationResult<T> {
    return validateUpload<T>(templateType, csvContent, options);
  }
}
