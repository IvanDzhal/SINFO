import { StreamableFile } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export type Sheet = {
  name: string;
  columns: { header: string; key: string; width?: number }[];
  rows: Record<string, string | number | Date | null>[];
};

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Збирає .xlsx з готових таблиць; перший рядок закріплений і виділений
export async function buildXlsx(sheets: Sheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    ws.columns = s.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
    ws.addRows(s.rows);
    const head = ws.getRow(1);
    head.font = { bold: true };
    head.alignment = { vertical: 'middle' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Відповідь для контролера з правильними заголовками завантаження
export async function xlsxResponse(
  res: { set(h: Record<string, string>): unknown },
  filename: string,
  sheets: Sheet[],
) {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = encodeURIComponent(`${filename}-${stamp}.xlsx`);
  res.set({
    'Content-Type': XLSX_MIME,
    'Content-Disposition': `attachment; filename*=UTF-8''${name}`,
  });
  return new StreamableFile(await buildXlsx(sheets));
}
