import { isSupportedSpreadsheetFileName, spreadsheetToCsvString } from '@liqvia2/shared';

export async function readUploadFile(file: File): Promise<string> {
  if (!isSupportedSpreadsheetFileName(file.name)) {
    throw new Error('Unsupported file type. Upload a CSV or Excel (.xlsx, .xls) file.');
  }

  if (file.name.toLowerCase().endsWith('.csv')) {
    return spreadsheetToCsvString(await file.text(), file.name);
  }

  return spreadsheetToCsvString(await file.arrayBuffer(), file.name);
}
