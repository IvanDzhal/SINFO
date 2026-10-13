export type ParsedNumber =
  | { kind: 'empty' }
  | { kind: 'number'; value: number }
  | { kind: 'invalid'; raw: string };

// Централізований розбір значень з таблиць (DATA_SYNC §10).
// Порожня комірка й справжній 0 різні: порожня → `empty`, не 0.
// Нерозпізнане значення → `invalid` (а не тихий 0, як у старому боті).
export function parseNumber(raw: unknown): ParsedNumber {
  if (raw === null || raw === undefined) return { kind: 'empty' };
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { kind: 'number', value: raw } : { kind: 'invalid', raw: String(raw) };
  }

  const text = String(raw)
    .replace(/[\s  ]/g, '')
    .replace(/грн\.?/gi, '')
    .replace(/₴/g, '')
    .replace(/%/g, '')
    .replace(',', '.');
  if (text === '' || text === '-' || text === '—') return { kind: 'empty' };

  // допускаємо лише цілі/десяткові числа зі знаком
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) return { kind: 'invalid', raw: String(raw).trim() };
  return { kind: 'number', value: Number(text) };
}
