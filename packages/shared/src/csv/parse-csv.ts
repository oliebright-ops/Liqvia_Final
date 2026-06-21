import { sanitizeSpreadsheetCellValue } from '../spreadsheet/sanitize-cell';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/** Parse RFC 4180-style CSV (quoted fields, commas, CRLF). */
export function parseCsv(content: string): ParsedCsv {
  const trimmed = content.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { headers: [], rows: [] };
  }

  const records = parseRecords(trimmed);
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = sanitizeSpreadsheetCellValue((cells[i] ?? '').trim());
    });
    return row;
  });

  return { headers, rows };
}

function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || (char === '\r' && next === '\n')) {
      row.push(field);
      field = '';
      if (row.some((c) => c.length > 0)) {
        records.push(row);
      }
      row = [];
      if (char === '\r') i++;
    } else if (char !== '\r') {
      field += char;
    }
  }

  row.push(field);
  if (row.some((c) => c.length > 0)) {
    records.push(row);
  }

  return records;
}
