import { PDFParse, type TableResult } from 'pdf-parse';

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function tableRowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => escapeCsvField(String(cell ?? '').trim())).join(',')).join('\n');
}

function tablesToCsv(tableResult: TableResult): string | null {
  const rows: string[][] = [];
  for (const page of tableResult.pages) {
    for (const table of page.tables) {
      for (const row of table) {
        if (row.some((cell) => String(cell ?? '').trim().length > 0)) {
          rows.push(row.map((cell) => String(cell ?? '')));
        }
      }
    }
  }
  if (rows.length < 2) return null;
  return tableRowsToCsv(rows);
}

export type PdfExtractResult = {
  text: string;
  pageCount: number;
  tableCsv: string | null;
};

/** Extract plain text and table data from a PDF buffer (text-based statements). */
export async function extractPdfContent(buffer: Buffer): Promise<PdfExtractResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const [textResult, tableResult] = await Promise.all([parser.getText(), parser.getTable()]);
    return {
      text: (textResult.text ?? '').trim(),
      pageCount: textResult.total ?? 0,
      tableCsv: tablesToCsv(tableResult),
    };
  } finally {
    await parser.destroy();
  }
}
