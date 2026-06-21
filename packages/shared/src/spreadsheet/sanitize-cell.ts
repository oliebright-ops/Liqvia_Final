import { MAX_UPLOAD_CELL_CHARS } from '../uploads/upload-limits';

const FORMULA_PREFIX = /^[=+\-@]/;

/** Neutralize CSV/Excel formula injection when cell values start with formula triggers. */
export function sanitizeSpreadsheetCellValue(value: string): string {
  let next = value;
  if (next.length > MAX_UPLOAD_CELL_CHARS) {
    next = next.slice(0, MAX_UPLOAD_CELL_CHARS);
  }
  if (FORMULA_PREFIX.test(next.trimStart())) {
    return `'${next}`;
  }
  return next;
}
