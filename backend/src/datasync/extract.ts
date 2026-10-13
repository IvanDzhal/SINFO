import { parseA1 } from './a1';
import { parseNumber } from './normalizer';

export type Grid = string[][];

// Ключі mapping: plan.TO | fact.TO | day.TO | meta.days_passed | meta.days_left
export const META_DAYS_PASSED = 'meta.days_passed';
export const META_DAYS_LEFT = 'meta.days_left';
export const planKey = (code: string) => `plan.${code}`;
export const factKey = (code: string) => `fact.${code}`;
export const dayKey = (code: string) => `day.${code}`;

export type ExtractIssue = {
  key: string;
  code: 'MAPPING_MISSING' | 'EMPTY' | 'INVALID' | 'NEGATIVE' | 'OUT_OF_RANGE' | 'ANOMALY';
  severity: 'error' | 'warning';
  message: string;
  cells?: string[];
};

export type ExtractResult = {
  values: Record<string, number | null>;
  issues: ExtractIssue[];
  read: number;
};

export type MappingInput = { key: string; cells: string[] };

function cellText(grid: Grid, ref: string): string | undefined {
  const p = parseA1(ref);
  if (!p) return undefined;
  return grid[p.row - 1]?.[p.col - 1];
}

// Значення за ключем: комірки підсумовуються. Усі порожні → null (а не 0).
// Порожня комірка поруч із числовою вважається 0 (напр. другий стовпець факту).
export function readKey(
  grid: Grid,
  m: MappingInput,
): { value: number | null; issue?: ExtractIssue } {
  if (m.cells.length === 0) {
    return {
      value: null,
      issue: {
        key: m.key,
        code: 'MAPPING_MISSING',
        severity: 'error',
        message: 'Не вказано комірку',
      },
    };
  }

  let sum = 0;
  let numeric = 0;
  for (const ref of m.cells) {
    const parsed = parseNumber(cellText(grid, ref));
    if (parsed.kind === 'invalid') {
      return {
        value: null,
        issue: {
          key: m.key,
          code: 'INVALID',
          severity: 'error',
          message: `Комірка ${ref} містить нечислове значення «${parsed.raw}»`,
          cells: m.cells,
        },
      };
    }
    if (parsed.kind === 'number') {
      sum += parsed.value;
      numeric += 1;
    }
  }

  if (numeric === 0) {
    return {
      value: null,
      issue: {
        key: m.key,
        code: 'EMPTY',
        severity: 'error',
        message: `Комірка ${m.cells.join(' + ')} порожня`,
        cells: m.cells,
      },
    };
  }
  return { value: sum };
}

// Зчитує всі показники за mapping і перевіряє їх (DATA_SYNC §11).
export function extract(grid: Grid, mappings: MappingInput[], expectedKeys: string[]): ExtractResult {
  const values: Record<string, number | null> = {};
  const issues: ExtractIssue[] = [];
  const byKey = new Map(mappings.map((m) => [m.key, m]));

  for (const key of expectedKeys) {
    const m = byKey.get(key);
    if (!m) {
      values[key] = null;
      issues.push({
        key,
        code: 'MAPPING_MISSING',
        severity: 'error',
        message: 'Mapping не налаштовано',
      });
      continue;
    }
    const r = readKey(grid, m);
    values[key] = r.value;
    if (r.issue) issues.push(r.issue);
  }

  // перевірка діапазонів зчитаних значень
  for (const key of expectedKeys) {
    const v = values[key];
    if (v === null) continue;
    if ((key.startsWith('plan.') || key.startsWith('fact.')) && v < 0) {
      values[key] = null;
      issues.push({
        key,
        code: 'NEGATIVE',
        severity: 'error',
        message: `Від'ємне значення ${v}`,
        cells: byKey.get(key)?.cells,
      });
    }
    if (key.startsWith('meta.') && (!Number.isInteger(v) || v < 0 || v > 31)) {
      values[key] = null;
      issues.push({
        key,
        code: 'OUT_OF_RANGE',
        severity: 'error',
        message: `Некоректна кількість днів: ${v}`,
        cells: byKey.get(key)?.cells,
      });
    }
  }

  // добовий продаж не може перевищувати накопичений факт
  for (const key of expectedKeys) {
    if (!key.startsWith('day.')) continue;
    const code = key.slice(4);
    const day = values[key];
    const fact = values[factKey(code)];
    if (day !== null && fact !== null && fact !== undefined && day > fact + 0.5) {
      issues.push({
        key,
        code: 'ANOMALY',
        severity: 'warning',
        message: `Продаж за день (${day}) більший за факт місяця (${fact})`,
        cells: byKey.get(key)?.cells,
      });
    }
  }

  return { values, issues, read: expectedKeys.filter((k) => byKey.has(k)).length };
}
