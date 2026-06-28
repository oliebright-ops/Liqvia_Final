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

function pdfExtractErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/deserialize cloned data/i.test(message)) {
    return 'PDF parsing failed on the server. Try exporting CSV or Excel from your bank, or upload a smaller PDF.';
  }
  return message || 'Could not read PDF file';
}

/** Extract plain text and table data from a PDF buffer (text-based statements). */
export async function extractPdfContent(buffer: Buffer): Promise<PdfExtractResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    // pdf.js rejects concurrent getText/getTable on the same parser (structured clone error).
    const textResult = await parser.getText();
    let tableCsv: string | null = null;
    try {
      const tableResult = await parser.getTable();
      tableCsv = tablesToCsv(tableResult);
    } catch (tableErr) {
      if (!textResult.text?.trim()) {
        throw new Error(pdfExtractErrorMessage(tableErr));
      }
    }

    return {
      text: (textResult.text ?? '').trim(),
      pageCount: textResult.total ?? 0,
      tableCsv,
    };
  } catch (err) {
    throw new Error(pdfExtractErrorMessage(err));
  } finally {
    await parser.destroy();
  }
}
