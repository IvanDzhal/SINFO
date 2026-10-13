import { completion, dailyNeed, efficiency, forecast, remaining } from './calc';
import { levelOf, parseThresholds } from './levels';

describe('calc', () => {
  it('виконання плану й залишок', () => {
    expect(completion(125000, 150000)).toBeCloseTo(83.33, 1);
    expect(remaining(125000, 150000)).toBe(25000);
    expect(remaining(200000, 150000)).toBe(0);
  });

  it('нульовий або невідомий план — не визначено, а не 0', () => {
    expect(completion(100, 0)).toBeNull();
    expect(completion(null, 100)).toBeNull();
    expect(completion(100, null)).toBeNull();
  });

  it('ефективність: нуль МТ не дає ділення на нуль', () => {
    expect(efficiency(7000, 70000)).toBeCloseTo(10);
    expect(efficiency(7000, 0)).toBeNull();
    expect(efficiency(null, 100)).toBeNull();
  });

  it('прогноз за поточним темпом з граничними випадками', () => {
    // 100 000 за 10 днів із 30 → 300 000
    expect(forecast(100000, 10, 20)).toBeCloseTo(300000);
    expect(forecast(100000, 0, 30)).toBeNull();
    expect(forecast(null, 10, 20)).toBeNull();
    expect(forecast(100000, 10, null)).toBeNull();
  });

  it('денна норма', () => {
    expect(dailyNeed(60000, 12)).toBe(5000);
    expect(dailyNeed(60000, 0)).toBeNull();
  });
});

describe('levels (пороги зі старого боту)', () => {
  const services = parseThresholds({
    bands: [
      { lte: 7.99, level: 'critical' },
      { lte: 9.99, level: 'warn' },
      { lte: 14.99, level: 'good' },
      { level: 'excellent' },
    ],
  });
  const warranty = parseThresholds({
    bands: [{ lt: 3.0, level: 'critical' }, { lt: 7.49, level: 'bad' }, { level: 'good' }],
  });
  const plan = parseThresholds({
    bands: [{ gte: 100, level: 'good' }, { gte: 80, level: 'warn' }, { gte: 50, level: 'bad' }, { level: 'critical' }],
  });

  it('послуги', () => {
    expect(levelOf(7.9, services)).toBe('critical');
    expect(levelOf(8.0, services)).toBe('warn');
    expect(levelOf(10, services)).toBe('good');
    expect(levelOf(15, services)).toBe('excellent');
  });

  it('гарантія', () => {
    expect(levelOf(2.9, warranty)).toBe('critical');
    expect(levelOf(3.0, warranty)).toBe('bad');
    expect(levelOf(7.5, warranty)).toBe('good');
  });

  it('виконання плану', () => {
    expect(levelOf(100, plan)).toBe('good');
    expect(levelOf(85, plan)).toBe('warn');
    expect(levelOf(55, plan)).toBe('bad');
    expect(levelOf(10, plan)).toBe('critical');
  });

  it('без значення чи порогів — нейтрально', () => {
    expect(levelOf(null, plan)).toBeNull();
    expect(levelOf(50, null)).toBeNull();
  });

  it('відхиляє некоректні пороги', () => {
    expect(parseThresholds({ bands: [{ level: 'nope' }] })).toBeNull();
    expect(parseThresholds({ bands: [{ level: 'good', lt: 'x' }] })).toBeNull();
    expect(parseThresholds('x')).toBeNull();
  });
});
