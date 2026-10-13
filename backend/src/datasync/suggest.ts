import { toA1 } from './a1';
import { dayKey, factKey, Grid, META_DAYS_LEFT, META_DAYS_PASSED, planKey } from './extract';
import { parseNumber } from './normalizer';

export type Suggestion = {
  key: string;
  cells: string[];
  confidence: 'high' | 'low';
  hint: string;
};

type DefLite = { code: string; name: string; shortName: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-яіїєґ0-9]/g, '');

// Додаткові назви, під якими показник зустрічається в таблицях магазинів
const EXTRA: Record<string, string[]> = {
  TO: ['то', 'товарооборот', 'товарообіг', 'товарообороту'],
  MT: ['мт', 'мобільні', 'мобільнітелефони', 'телефони'],
  ACCESSORIES: ['акс', 'аксесуари', 'аксесуарів'],
  SERVICES: ['послуги', 'сервіс', 'сервіси', 'послуг'],
  WARRANTY: ['гарантія', 'гарантії', 'гарантія', 'гар'],
};

const SEARCH_COLS = 5; // мітки шукаємо в перших колонках
const HEADER_ROWS = 10; // заголовки «План / Факт» — у верхніх рядках

function findHeaderCol(grid: Grid, word: string, notWord?: string): number | null {
  for (let r = 0; r < Math.min(HEADER_ROWS, grid.length); r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const t = norm(row[c] ?? '');
      if (t.includes(word) && (!notWord || !t.includes(notWord))) return c + 1;
    }
  }
  return null;
}

function firstNumberRight(grid: Grid, r: number, fromCol: number): number | null {
  const row = grid[r] ?? [];
  for (let c = fromCol; c < Math.min(row.length, fromCol + 6); c++) {
    if (parseNumber(row[c]).kind === 'number') return c + 1;
  }
  return null;
}

// Пропозиції mapping за назвами рядків і заголовками колонок. Лише підказка:
// адміністратор підтверджує або змінює вручну.
export function suggestMappings(grid: Grid, defs: DefLite[]): Suggestion[] {
  const out: Suggestion[] = [];
  const planCol = findHeaderCol(grid, 'план');
  const factCol = findHeaderCol(grid, 'факт');
  const dayCol = findHeaderCol(grid, 'заден') ?? findHeaderCol(grid, 'завідень') ?? findHeaderCol(grid, 'продажіздень');

  for (const d of defs) {
    const names = new Set([norm(d.name), norm(d.shortName), ...(EXTRA[d.code] ?? [])]);
    let row: number | null = null;
    for (let r = 0; r < grid.length && row === null; r++) {
      for (let c = 0; c < Math.min(SEARCH_COLS, (grid[r] ?? []).length); c++) {
        const t = norm(grid[r][c] ?? '');
        if (t && names.has(t)) {
          row = r + 1;
          break;
        }
      }
    }
    if (row === null) continue;

    if (planCol) {
      out.push({
        key: planKey(d.code),
        cells: [toA1(row, planCol)],
        confidence: 'high',
        hint: `рядок «${d.name}», колонка «План»`,
      });
    }
    if (factCol) {
      out.push({
        key: factKey(d.code),
        cells: [toA1(row, factCol)],
        confidence: 'high',
        hint: `рядок «${d.name}», колонка «Факт»`,
      });
    }
    if (dayCol) {
      out.push({
        key: dayKey(d.code),
        cells: [toA1(row, dayCol)],
        confidence: 'low',
        hint: `рядок «${d.name}», колонка за день`,
      });
    }
  }

  const days: [string, string[], string][] = [
    [META_DAYS_PASSED, ['минуло', 'пройшло', 'днівпройшло'], 'мітка про пройдені дні'],
    [META_DAYS_LEFT, ['залишилось', 'залишилося', 'днівзалишилось', 'залишок'], 'мітка про залишок днів'],
  ];
  for (const [key, labels, hint] of days) {
    for (let r = 0; r < Math.min(grid.length, HEADER_ROWS); r++) {
      const row = grid[r] ?? [];
      const c = row.findIndex((cell) => {
        const t = norm(cell ?? '');
        return labels.some((l) => t.includes(l));
      });
      if (c < 0) continue;
      const numCol = firstNumberRight(grid, r, c);
      if (numCol) {
        out.push({ key, cells: [toA1(r + 1, numCol)], confidence: 'low', hint });
        break;
      }
    }
  }
  return out;
}
