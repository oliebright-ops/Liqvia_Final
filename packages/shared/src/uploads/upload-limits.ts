/** Maximum uploaded spreadsheet file size (multipart / Excel buffer). */
export const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;

/** Maximum files per AI Upload Centre batch. */
export const MAX_AI_UPLOAD_FILES = 20;

/** Maximum CSV text length accepted for validation/import. */
export const MAX_UPLOAD_CSV_CHARS = 5 * 1024 * 1024;

/** Maximum data rows per upload (excluding header). */
export const MAX_UPLOAD_ROWS = 15_000;

/** Maximum columns accepted in a worksheet. */
export const MAX_UPLOAD_COLUMNS = 64;

/** Maximum length of a single cell value after trim. */
export const MAX_UPLOAD_CELL_CHARS = 2_000;

export function formatBytesLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${bytes / (1024 * 1024)}MB`;
  if (bytes >= 1024) return `${bytes / 1024}KB`;
  return `${bytes}B`;
}
