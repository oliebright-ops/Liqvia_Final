import { parseCsv } from '../csv/parse-csv';

export type PdfTextToCsvResult = {
  csv: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  rowCount: number;
};

const HEADER_GROUPS: string[][] = [
  ['date', 'txn date', 'transaction date', 'posting date', 'value date', 'trans date'],
  ['description', 'narrative', 'details', 'memo', 'particulars', 'reference'],
  ['amount', 'value', 'transaction amount'],
  ['debit', 'withdrawal', 'money out', 'spent', 'dr'],
  ['credit', 'deposit', 'money in', 'received', 'cr'],
  ['balance', 'running balance', 'closing balance'],
  ['payee', 'beneficiary', 'counterparty', 'merchant'],
];

const STOP_LINE =
  /^(total|subtotal|opening balance|closing balance|balance brought forward|balance carried forward|statement period|page \d)/i;

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvLine(cells: string[]): string {
  return cells.map((cell) => escapeCsvField(cell.trim())).join(',');
}

function splitTableRow(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((cell) => cell.trim());
  }
  return line.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function scoreHeaderLine(line: string): number {
  const normalized = line.toLowerCase();
  let score = 0;
  for (const group of HEADER_GROUPS) {
    if (group.some((keyword) => normalized.includes(keyword))) {
      score += 1;
    }
  }
  return score;
}

function looksLikeDate(value: string): boolean {
  const trimmed = value.trim();
  return (
    /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(trimmed) ||
    /^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}$/.test(trimmed) ||
    /^\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}$/.test(trimmed)
  );
}

function looksLikeAmount(value: string): boolean {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed) return false;
  return /^[\(\-\+]?[\d,]+\.\d{2}\)?$/.test(trimmed) || /^[\(\-\+]?[\d,]+$/.test(trimmed);
}

function rowHasTransactionSignals(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const hasDate = cells.some((cell) => looksLikeDate(cell));
  const hasAmount = cells.some((cell) => looksLikeAmount(cell));
  return hasDate && hasAmount;
}

function normalizePdfLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, '').trimEnd())
    .filter((line) => line.trim().length > 0);
}

/** Heuristically convert extracted PDF statement text into CSV for bank normalization. */
export function pdfTextToCsv(text: string): PdfTextToCsvResult {
  const warnings: string[] = [];
  const lines = normalizePdfLines(text);

  if (lines.length === 0) {
    return { csv: '', confidence: 'low', warnings: ['PDF text is empty'], rowCount: 0 };
  }

  let headerIndex = -1;
  let headerScore = 0;
  const scanLimit = Math.min(lines.length, 60);
  for (let i = 0; i < scanLimit; i += 1) {
    const score = scoreHeaderLine(lines[i]!);
    if (score > headerScore) {
      headerScore = score;
      headerIndex = i;
    }
  }

  if (headerIndex < 0 || headerScore < 2) {
    return {
      csv: '',
      confidence: 'low',
      warnings: ['Could not detect a transaction table header in the PDF text'],
      rowCount: 0,
    };
  }

  const headers = splitTableRow(lines[headerIndex]!);
  if (headers.length < 2) {
    return {
      csv: '',
      confidence: 'low',
      warnings: ['Detected header row could not be split into columns'],
      rowCount: 0,
    };
  }

  const dataRows: string[][] = [];
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (STOP_LINE.test(line.trim())) break;

    const cells = splitTableRow(line);
    if (cells.length < 2) continue;

    if (scoreHeaderLine(line) >= headerScore && !rowHasTransactionSignals(cells)) {
      continue;
    }

    if (!rowHasTransactionSignals(cells)) continue;

    while (cells.length < headers.length) cells.push('');
    dataRows.push(cells.slice(0, headers.length));
  }

  if (dataRows.length === 0) {
    return {
      csv: '',
      confidence: 'low',
      warnings: ['No transaction rows found below the detected header'],
      rowCount: 0,
    };
  }

  const csv = [toCsvLine(headers), ...dataRows.map((row) => toCsvLine(row))].join('\n');
  const parsed = parseCsv(csv);
  const rowCount = parsed.rows.length;

  let confidence: PdfTextToCsvResult['confidence'] = 'low';
  if (headerScore >= 3 && rowCount >= 3) confidence = 'high';
  else if (headerScore >= 2 && rowCount >= 1) confidence = 'medium';

  if (confidence !== 'high') {
    warnings.push('PDF table detection may be incomplete — review the preview before import.');
  }

  return { csv, confidence, warnings, rowCount };
}
