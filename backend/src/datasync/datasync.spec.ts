import { normalizeA1, parseA1, toA1 } from './a1';
import { parseNumber } from './normalizer';
import { extract, factKey, planKey } from './extract';
import { suggestMappings } from './suggest';
import { spreadsheetIdFrom } from './sources.service';

describe('a1', () => {
  it('перетворює (рядок, колонка) у A1 як у старому боті', () => {
    expect(toA1(5, 3)).toBe('C5');
    expect(toA1(5, 10)).toBe('J5');
    expect(toA1(16, 14)).toBe('N16');
    expect(toA1(1, 27)).toBe('AA1');
  });

  it('парсить і нормалізує посилання', () => {
    expect(parseA1('j5')).toEqual({ col: 10, row: 5 });
    expect(normalizeA1(' c5 ')).toBe('C5');
    expect(normalizeA1('5C')).toBeNull();
    expect(normalizeA1('C0')).toBeNull();
  });
});

describe('normalizer', () => {
  it.each([
    ['150 000', 150000],
    ['150 000 грн', 150000],
    ['12,5%', 12.5],
    ['12.5', 12.5],
    ['0', 0],
    ['-300', -300],
  ])('%s → %s', (raw, expected) => {
    expect(parseNumber(raw)).toEqual({ kind: 'number', value: expected });
  });

  it('порожнє відрізняє від нуля', () => {
    expect(parseNumber('')).toEqual({ kind: 'empty' });
    expect(parseNumber('  ')).toEqual({ kind: 'empty' });
    expect(parseNumber(undefined)).toEqual({ kind: 'empty' });
    expect(parseNumber('0')).toEqual({ kind: 'number', value: 0 });
  });

  it('не перетворює сміття на 0', () => {
    expect(parseNumber('#N/A')).toEqual({ kind: 'invalid', raw: '#N/A' });
    expect(parseNumber('abc')).toEqual({ kind: 'invalid', raw: 'abc' });
  });
});

describe('extract', () => {
  const grid = [
    ['', '', ''],
    ['', 'Залишилось', '10'],
    ['', 'Минуло', '20'],
    [],
    ['ТО', 'План', '150 000', '', '', '', '', '', '', '100 000', '25 000'],
  ];

  it('підсумовує кілька комірок (ЕНТ/КОФ/СТЛ: J + K)', () => {
    const r = extract(
      grid,
      [{ key: factKey('TO'), cells: ['J5', 'K5'] }],
      [factKey('TO')],
    );
    expect(r.values[factKey('TO')]).toBe(125000);
    expect(r.issues).toHaveLength(0);
  });

  it('порожня комірка поруч із числовою — нуль, усі порожні — null', () => {
    const one = extract(grid, [{ key: factKey('TO'), cells: ['J5', 'Z5'] }], [factKey('TO')]);
    expect(one.values[factKey('TO')]).toBe(100000);

    const none = extract(grid, [{ key: factKey('TO'), cells: ['B1', 'C1'] }], [factKey('TO')]);
    expect(none.values[factKey('TO')]).toBeNull();
    expect(none.issues[0].code).toBe('EMPTY');
  });

  it('нечислове значення — помилка, а не 0', () => {
    const r = extract(
      [['abc']],
      [{ key: planKey('TO'), cells: ['A1'] }],
      [planKey('TO')],
    );
    expect(r.values[planKey('TO')]).toBeNull();
    expect(r.issues[0]).toMatchObject({ code: 'INVALID', severity: 'error' });
  });

  it('відсутній mapping і від’ємні значення фіксуються', () => {
    const r = extract(
      [['-5']],
      [{ key: planKey('TO'), cells: ['A1'] }],
      [planKey('TO'), factKey('TO')],
    );
    expect(r.values[planKey('TO')]).toBeNull();
    expect(r.issues.map((i) => i.code).sort()).toEqual(['MAPPING_MISSING', 'NEGATIVE']);
  });

  it('перевіряє кількість днів', () => {
    const r = extract([['40']], [{ key: 'meta.days_passed', cells: ['A1'] }], ['meta.days_passed']);
    expect(r.issues[0].code).toBe('OUT_OF_RANGE');
  });

  it('попереджає, коли день більший за факт місяця', () => {
    const r = extract(
      [['100', '500']],
      [
        { key: factKey('TO'), cells: ['A1'] },
        { key: 'day.TO', cells: ['B1'] },
      ],
      [factKey('TO'), 'day.TO'],
    );
    expect(r.issues.find((i) => i.code === 'ANOMALY')?.severity).toBe('warning');
  });
});

describe('suggestMappings', () => {
  const grid = [
    ['', 'Показник', 'План', '', '', '', '', '', '', 'Факт'],
    ['', 'Залишилось днів', '12'],
    ['', 'Минуло днів', '19'],
    [],
    ['', 'ТО', '150000', '', '', '', '', '', '', '100000'],
    ['', 'Мобільні телефони', '80000', '', '', '', '', '', '', '60000'],
    ['', 'Послуги', '10000', '', '', '', '', '', '', '7000'],
  ];
  const defs = [
    { code: 'TO', name: 'Товарооборот', shortName: 'ТО' },
    { code: 'MT', name: 'Мобільні телефони', shortName: 'МТ' },
    { code: 'SERVICES', name: 'Послуги', shortName: 'Послуги' },
  ];

  it('знаходить рядки за назвою та колонки за заголовком', () => {
    const s = suggestMappings(grid, defs);
    const get = (k: string) => s.find((x) => x.key === k)?.cells;
    expect(get('plan.TO')).toEqual(['C5']);
    expect(get('fact.TO')).toEqual(['J5']);
    expect(get('fact.MT')).toEqual(['J6']);
    expect(get('plan.SERVICES')).toEqual(['C7']);
    expect(get('meta.days_left')).toEqual(['C2']);
    expect(get('meta.days_passed')).toEqual(['C3']);
  });
});

describe('spreadsheetIdFrom', () => {
  const id = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
  it('приймає ID та посилання', () => {
    expect(spreadsheetIdFrom(id)).toBe(id);
    expect(spreadsheetIdFrom(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id);
  });
  it('відхиляє сміття', () => {
    expect(() => spreadsheetIdFrom('hello')).toThrow();
  });
});
