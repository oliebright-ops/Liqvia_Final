import * as XLSX from 'xlsx';
import {
  buildTemplateSampleCsv,
  buildTemplateSampleXlsx,
  UPLOAD_LIBRARY_TEMPLATE_TYPES,
} from './template-samples';
import { UPLOAD_TEMPLATES } from './templates';

describe('template-samples', () => {
  const asOfDate = '2026-06-01';

  it.each(UPLOAD_LIBRARY_TEMPLATE_TYPES)('builds CSV with exact headers for %s', (type) => {
    const csv = buildTemplateSampleCsv(type, asOfDate);
    const [headerLine] = csv.trim().split('\n');
    expect(headerLine).toBe(UPLOAD_TEMPLATES[type].headers.join(','));
  });

  it.each(UPLOAD_LIBRARY_TEMPLATE_TYPES)('builds XLSX with exact headers for %s', (type) => {
    const buffer = buildTemplateSampleXlsx(type, asOfDate);
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
    expect(rows[0]).toEqual(Array.from(UPLOAD_TEMPLATES[type].headers));
    expect(rows.length).toBeGreaterThan(1);
  });
});
