// Кольорова градація метрик (ANALYTICS §14, §35).
// Пороги зберігаються в SalesMetricDef.thresholds як впорядкований список смуг;
// перша смуга, що підходить, визначає рівень. Смуга без умови — запасна.

export type Level = 'critical' | 'bad' | 'warn' | 'good' | 'excellent';

export type Band = {
  level: Level;
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
};

export type Thresholds = { bands: Band[] };

const LEVELS: Level[] = ['critical', 'bad', 'warn', 'good', 'excellent'];

export function isLevel(v: unknown): v is Level {
  return typeof v === 'string' && (LEVELS as string[]).includes(v);
}

export function parseThresholds(raw: unknown): Thresholds | null {
  if (!raw || typeof raw !== 'object') return null;
  const bands = (raw as { bands?: unknown }).bands;
  if (!Array.isArray(bands)) return null;
  const out: Band[] = [];
  for (const b of bands) {
    if (!b || typeof b !== 'object' || !isLevel((b as Band).level)) return null;
    const band = b as Band;
    for (const k of ['lt', 'lte', 'gt', 'gte'] as const) {
      if (band[k] !== undefined && typeof band[k] !== 'number') return null;
    }
    out.push(band);
  }
  return { bands: out };
}

// Рівень значення; без значення або без порогів — null (нейтрально)
export function levelOf(value: number | null, thresholds: Thresholds | null): Level | null {
  if (value === null || !thresholds) return null;
  for (const b of thresholds.bands) {
    const conditions = [b.lt, b.lte, b.gt, b.gte].some((c) => c !== undefined);
    if (!conditions) return b.level;
    if (b.lt !== undefined && !(value < b.lt)) continue;
    if (b.lte !== undefined && !(value <= b.lte)) continue;
    if (b.gt !== undefined && !(value > b.gt)) continue;
    if (b.gte !== undefined && !(value >= b.gte)) continue;
    return b.level;
  }
  return null;
}

export const isProblem = (l: Level | null) => l === 'critical' || l === 'bad';
