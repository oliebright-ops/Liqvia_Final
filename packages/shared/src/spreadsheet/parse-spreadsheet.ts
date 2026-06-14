import * as XLSX from 'xlsx';

const EXCEL_EXTENSIONS = ['.xlsx', '.xls'] as const;

export function isExcelFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return EXCEL_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isCsvFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.csv');
}

export function isSupportedSpreadsheetFileName(fileName: string): boolean {
  return isCsvFileName(fileName) || isExcelFileName(fileName);
}

/** MIME types and extensions accepted in upload file inputs. */
export const UPLOAD_FILE_ACCEPT =
  '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type SpreadsheetInput = string | ArrayBuffer | Uint8Array;

function toUint8Array(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof ArrayBuffer ? new Uint8Array(input) : input;
}

function excelBufferToCsv(bytes: Uint8Array): string {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: 'array', raw: false, cellDates: false });
  } catch {
    throw new Error('Could not read Excel file. Save as .xlsx or .csv and try again.');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel file has no worksheets');
  }

  const sheet = workbook.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
  if (!csv.trim()) {
    throw new Error('Excel worksheet is empty');
  }

  return csv;
}

/** Normalize CSV text or convert the first Excel worksheet to CSV for validation/import. */
export function spreadsheetToCsvString(input: SpreadsheetInput, fileName: string): string {
  if (typeof input === 'string') {
    return input.replace(/^\uFEFF/, '');
  }

  const bytes = toUint8Array(input);

  if (isExcelFileName(fileName)) {
    return excelBufferToCsv(bytes);
  }

  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return text.replace(/^\uFEFF/, '');
}
