import { BadRequestException } from '@nestjs/common';
import {
  MAX_UPLOAD_CSV_CHARS,
  MAX_UPLOAD_FILE_BYTES,
  formatBytesLimit,
} from '@liqvia2/shared';

export function assertUploadFileSize(bytes: number | undefined): void {
  if (bytes === undefined || bytes <= 0) {
    throw new BadRequestException('Spreadsheet file is required (field name: file)');
  }
  if (bytes > MAX_UPLOAD_FILE_BYTES) {
    throw new BadRequestException(
      `File exceeds maximum size of ${formatBytesLimit(MAX_UPLOAD_FILE_BYTES)}`,
    );
  }
}

export function assertUploadCsvContent(csvContent: string | undefined): string {
  const content = csvContent?.trim();
  if (!content) {
    throw new BadRequestException('Spreadsheet content is empty');
  }
  if (content.length > MAX_UPLOAD_CSV_CHARS) {
    throw new BadRequestException(
      `Upload exceeds maximum size of ${formatBytesLimit(MAX_UPLOAD_CSV_CHARS)}`,
    );
  }
  return content;
}

/** Strip path segments and control characters from client-provided filenames. */
export function sanitizeUploadFileName(fileName: string | undefined, fallback: string): string {
  const base = (fileName ?? fallback).split(/[/\\]/).pop() ?? fallback;
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 180);
  return cleaned || fallback;
}
