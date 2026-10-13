import { existsSync } from 'fs';
import { Injectable } from '@nestjs/common';
// вузький імпорт: `googleapis` цілком тягне сотні API і дуже сповільнює компіляцію
import { GoogleAuth } from 'google-auth-library';
import { sheets_v4 } from 'googleapis/build/src/apis/sheets/v4';
import { Grid } from './extract';

// Помилка синхронізації з поясненням для адміністратора.
// retryable — тимчасова (мережа, ліміти Google): її має сенс повторити.
export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_CREDENTIALS'
      | 'SOURCE_UNAVAILABLE'
      | 'SHEET_NOT_FOUND'
      | 'TEMPORARY'
      | 'UNKNOWN',
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export type SourceRef = { externalId: string; sheetName: string | null };

// Єдиний контракт для всіх провайдерів (DATA_SYNC §21): віддати сітку значень.
export interface SheetConnector {
  readonly provider: string;
  readGrid(source: SourceRef): Promise<Grid>;
}

// Скільки зчитуємо: достатньо для всіх розкладок магазинів і для попереднього перегляду
export const GRID_ROWS = 60;
export const GRID_COLS = 26; // A..Z

@Injectable()
export class GoogleSheetsConnector implements SheetConnector {
  readonly provider = 'google_sheets';

  private auth() {
    const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const path = process.env.GOOGLE_CREDENTIALS_PATH ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

    if (inline) {
      try {
        return new GoogleAuth({ credentials: JSON.parse(inline), scopes });
      } catch {
        throw new SyncError('GOOGLE_SERVICE_ACCOUNT_JSON містить некоректний JSON', 'NO_CREDENTIALS');
      }
    }
    if (path) {
      if (!existsSync(path)) {
        throw new SyncError(
          `Не знайдено файл ключа Google (${path}). Додайте його в теку secrets — див. secrets/README.md`,
          'NO_CREDENTIALS',
        );
      }
      return new GoogleAuth({ keyFile: path, scopes });
    }

    throw new SyncError(
      'Не налаштовано Google credentials (GOOGLE_CREDENTIALS_PATH або GOOGLE_SERVICE_ACCOUNT_JSON)',
      'NO_CREDENTIALS',
    );
  }

  async readGrid(source: SourceRef): Promise<Grid> {
    const sheets = new sheets_v4.Sheets({ auth: this.auth() });
    const lastCol = String.fromCharCode(64 + GRID_COLS);
    const area = `A1:${lastCol}${GRID_ROWS}`;
    // без назви аркуша Google бере перший аркуш — так само, як це робив бот
    const range = source.sheetName ? `'${source.sheetName.replace(/'/g, "''")}'!${area}` : area;

    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: source.externalId,
        range,
        valueRenderOption: 'FORMATTED_VALUE',
      });
      return (res.data.values ?? []).map((row) => row.map((c) => (c == null ? '' : String(c))));
    } catch (e: any) {
      const status: number | undefined = e?.code ?? e?.response?.status;
      const reason: string = e?.errors?.[0]?.message ?? e?.message ?? 'невідома помилка';

      if (status === 403 || status === 404) {
        throw new SyncError(
          'Google Sheet недоступний: перевірте ID таблиці та чи надано доступ service account',
          'SOURCE_UNAVAILABLE',
        );
      }
      if (status === 400 && /range|parse|sheet/i.test(reason)) {
        throw new SyncError(`Аркуш не знайдено: ${source.sheetName ?? 'перший'}`, 'SHEET_NOT_FOUND');
      }
      if (status === 429 || (status !== undefined && status >= 500) || !status) {
        throw new SyncError(`Тимчасова помилка Google API: ${reason}`, 'TEMPORARY', true);
      }
      throw new SyncError(`Помилка Google API: ${reason}`, 'UNKNOWN');
    }
  }
}
