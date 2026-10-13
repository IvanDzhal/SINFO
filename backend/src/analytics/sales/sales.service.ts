import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Scope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Actor, regionIdsOf } from '../../knowledge/helpers';
import { addDays, kyivDay } from '../../presence/day.util';
import { completion, dailyNeed, efficiency, forecast, remaining, round1 } from './calc';
import { isProblem, Level, levelOf, parseThresholds, Thresholds } from './levels';

export type SalesFilters = {
  month?: string; // YYYY-MM
  asOf?: string; // YYYY-MM-DD, у межах місяця
  regionId?: string;
  cityId?: string;
  storeId?: string;
};

// Дані старші за цей строк (днів) у поточному місяці вважаються застарілими
const STALE_AFTER_DAYS = 1;
// Прогноз у перші дні місяця надто хиткий для сигналів
const MIN_FORECAST_DAYS = 3;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: number | null) => (v === null ? null : round1(v));

type Def = {
  code: string;
  name: string;
  shortName: string;
  kind: string;
  unit: string;
  numerator: string | null;
  denominator: string | null;
  thresholds: Thresholds | null;
};

export type MetricCell = {
  plan: number | null;
  fact: number | null;
  dayFact: number | null;
  percent: number | null;
  remaining: number | null;
  forecast: number | null;
  forecastPercent: number | null;
  deltaPercent: number | null;
  needPerDay: number | null;
  level: Level | null;
  forecastLevel: Level | null;
};

export type EffCell = { value: number | null; level: Level | null };

type DayRow = { plan: number | null; fact: number | null; dayFact: number | null };

type StoreRow = {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  regionId: string;
  region: string;
  brand: string;
  dataDate: string | null;
  daysPassed: number | null;
  daysLeft: number | null;
  stale: boolean;
  hasSource: boolean;
  lastSync: { status: string; message: string | null; at: Date | null } | null;
  metrics: Record<string, MetricCell>;
  efficiency: Record<string, EffCell>;
  missing: string[];
};

export type Alert = {
  type: 'efficiency' | 'forecast' | 'missing_data' | 'stale' | 'sync' | 'no_source';
  severity: 'critical' | 'warning' | 'info';
  storeId: string;
  store: string;
  region: string;
  metric?: string;
  value?: number | null;
  message: string;
};

function monthBounds(month?: string) {
  const today = kyivDay();
  let key = month;
  if (!key) key = iso(today).slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) throw new BadRequestException('Некоректний місяць (YYYY-MM)');
  const [y, m] = key.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const next = new Date(Date.UTC(y, m, 1));
  return { key, start, end: addDays(next, -1), isCurrent: key === iso(today).slice(0, 7), today };
}

@Injectable()
export class SalesAnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ───────── довідники ─────────

  async defs(includeInactive = false): Promise<(Def & { active: boolean; displayOrder: number })[]> {
    const rows = await this.prisma.salesMetricDef.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { displayOrder: 'asc' },
    });
    return rows.map((r) => ({ ...r, thresholds: parseThresholds(r.thresholds) }));
  }

  async updateDef(
    code: string,
    dto: { name?: string; shortName?: string; active?: boolean; displayOrder?: number; thresholds?: unknown },
  ) {
    const def = await this.prisma.salesMetricDef.findUnique({ where: { code } });
    if (!def) throw new NotFoundException('Метрику не знайдено');
    let thresholds: Prisma.InputJsonValue | undefined;
    if (dto.thresholds !== undefined) {
      const parsed = parseThresholds(dto.thresholds);
      if (!parsed || parsed.bands.length === 0) {
        throw new BadRequestException('Некоректні пороги: очікується { bands: [{ level, lt|lte|gt|gte }] }');
      }
      thresholds = parsed as unknown as Prisma.InputJsonValue;
    }
    return this.prisma.salesMetricDef.update({
      where: { code },
      data: {
        name: dto.name,
        shortName: dto.shortName,
        active: dto.active,
        displayOrder: dto.displayOrder,
        thresholds,
      },
    });
  }

  private storeWhere(scopes: Scope[], viewer: Actor, f: SalesFilters): Prisma.StoreWhereInput {
    const and: Prisma.StoreWhereInput[] = [{ status: 'active' }];

    if (!scopes.includes('GLOBAL')) {
      const or: Prisma.StoreWhereInput[] = [];
      if (scopes.includes('REGION')) {
        const ids = regionIdsOf(viewer);
        if (ids.length) or.push({ regionId: { in: ids } });
      }
      if ((scopes.includes('STORE') || scopes.includes('SELF')) && viewer.storeId) {
        or.push({ id: viewer.storeId });
      }
      and.push(or.length ? { OR: or } : { id: '__none__' });
    }
    if (f.regionId) and.push({ regionId: f.regionId });
    if (f.cityId) and.push({ cityId: f.cityId });
    if (f.storeId) and.push({ id: f.storeId });
    return { AND: and };
  }

  // Місяці, за які є дані в межах доступу
  async periods(viewer: Actor, scopes: Scope[]) {
    const rows = await this.prisma.salesSnapshot.findMany({
      where: { store: this.storeWhere(scopes, viewer, {}) },
      distinct: ['date'],
      select: { date: true },
      orderBy: { date: 'desc' },
    });
    const months = [...new Set(rows.map((r) => iso(r.date).slice(0, 7)))];
    const current = iso(kyivDay()).slice(0, 7);
    if (!months.includes(current)) months.unshift(current);
    return months;
  }

  // ───────── основний розрахунок ─────────

  private async build(viewer: Actor, scopes: Scope[], f: SalesFilters) {
    const period = monthBounds(f.month);
    let asOf = period.end;
    if (f.asOf) {
      const d = new Date(`${f.asOf}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d < period.start || d > period.end) {
        throw new BadRequestException('Дата поза межами обраного місяця');
      }
      asOf = d;
    }

    const [defs, stores] = await Promise.all([
      this.defs(),
      this.prisma.store.findMany({
        where: this.storeWhere(scopes, viewer, f),
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          regionId: true,
          region: { select: { name: true } },
          city: { select: { name: true } },
          brandFormat: { select: { name: true } },
          dataSource: {
            select: {
              status: true,
              runs: {
                orderBy: { startedAt: 'desc' },
                take: 1,
                select: { status: true, errorMessage: true, finishedAt: true },
              },
            },
          },
        },
      }),
    ]);

    const ids = stores.map((s) => s.id);
    const [metricRows, snaps] = ids.length
      ? await Promise.all([
          this.prisma.salesMetric.findMany({
            where: { storeId: { in: ids }, date: { gte: period.start, lte: asOf } },
            select: { storeId: true, date: true, metricCode: true, plan: true, fact: true, dayFact: true },
          }),
          this.prisma.salesSnapshot.findMany({
            where: { storeId: { in: ids }, date: { gte: period.start, lte: asOf } },
            select: { storeId: true, date: true, daysPassed: true, daysLeft: true },
          }),
        ])
      : [[], []];

    // store → date → code → значення
    const byStore = new Map<string, Map<string, Map<string, DayRow>>>();
    for (const r of metricRows) {
      const days = byStore.get(r.storeId) ?? new Map();
      const d = iso(r.date);
      const codes = days.get(d) ?? new Map();
      codes.set(r.metricCode, { plan: r.plan, fact: r.fact, dayFact: r.dayFact });
      days.set(d, codes);
      byStore.set(r.storeId, days);
    }
    const snapBy = new Map<string, { daysPassed: number | null; daysLeft: number | null }>();
    for (const s of snaps) snapBy.set(`${s.storeId}|${iso(s.date)}`, s);

    const base = defs.filter((d) => d.kind === 'base');
    const eff = defs.filter((d) => d.kind === 'efficiency');

    const makeMetrics = (
      codes: Map<string, DayRow> | undefined,
      daysPassed: number | null,
      daysLeft: number | null,
    ) => {
      const metrics: Record<string, MetricCell> = {};
      for (const d of base) {
        const r = codes?.get(d.code);
        const plan = r?.plan ?? null;
        const fact = r?.fact ?? null;
        const dayFact = r?.dayFact ?? null;
        const percent = completion(fact, plan);
        const fc = forecast(fact, daysPassed, daysLeft);
        const fcPercent = completion(fc, plan);
        const rest = remaining(fact, plan);
        const need = dailyNeed(rest, daysLeft);
        metrics[d.code] = {
          plan,
          fact,
          dayFact,
          percent: num(percent),
          remaining: rest,
          forecast: fc === null ? null : Math.round(fc),
          forecastPercent: num(fcPercent),
          deltaPercent: num(completion(dayFact, plan)),
          needPerDay: need === null ? null : Math.round(need),
          level: levelOf(percent === null ? null : round1(percent), d.thresholds),
          forecastLevel: levelOf(fcPercent === null ? null : round1(fcPercent), d.thresholds),
        };
      }
      const efficiencies: Record<string, EffCell> = {};
      for (const d of eff) {
        const n = d.numerator ? metrics[d.numerator]?.fact ?? null : null;
        const m = d.denominator ? metrics[d.denominator]?.fact ?? null : null;
        const value = efficiency(n, m);
        efficiencies[d.code] = {
          value: num(value),
          level: levelOf(value === null ? null : round1(value), d.thresholds),
        };
      }
      return { metrics, efficiencies };
    };

    const rows: StoreRow[] = stores.map((s) => {
      const days = byStore.get(s.id);
      const dates = days ? [...days.keys()].sort() : [];
      const dataDate = dates.length ? dates[dates.length - 1] : null;
      const snap = dataDate ? snapBy.get(`${s.id}|${dataDate}`) : undefined;
      const daysPassed = snap?.daysPassed ?? null;
      const daysLeft = snap?.daysLeft ?? null;
      const { metrics, efficiencies } = makeMetrics(
        dataDate ? days!.get(dataDate) : undefined,
        daysPassed,
        daysLeft,
      );

      const ageDays = dataDate
        ? Math.round((period.today.getTime() - new Date(`${dataDate}T00:00:00Z`).getTime()) / 86_400_000)
        : null;
      const run = s.dataSource?.runs[0];

      const missing: string[] = [];
      for (const d of base) {
        const c = metrics[d.code];
        if (c.plan === null || c.fact === null) missing.push(d.code);
      }

      return {
        id: s.id,
        name: s.name,
        code: s.code,
        city: s.city?.name ?? null,
        regionId: s.regionId,
        region: s.region.name,
        brand: s.brandFormat.name,
        dataDate,
        daysPassed,
        daysLeft,
        stale: period.isCurrent && ageDays !== null && ageDays > STALE_AFTER_DAYS,
        hasSource: !!s.dataSource && s.dataSource.status === 'active',
        lastSync: run ? { status: run.status, message: run.errorMessage, at: run.finishedAt } : null,
        metrics,
        efficiency: efficiencies,
        missing,
      };
    });

    return { period, asOf, defs, base, eff, rows, byStore, snapBy, makeMetrics };
  }

  // ───────── агрегація ─────────

  private aggregate(rows: StoreRow[], base: Def[], eff: Def[]) {
    const metrics: Record<string, MetricCell & { covered: number }> = {};

    for (const d of base) {
      let plan = 0;
      let fact = 0;
      let covered = 0;
      let day = 0;
      let dayCount = 0;
      let fcSum = 0;
      let fcPlan = 0;
      let rest = 0;

      for (const r of rows) {
        const c = r.metrics[d.code];
        if (c.plan !== null && c.fact !== null) {
          plan += c.plan;
          fact += c.fact;
          covered += 1;
          rest += c.remaining ?? 0;
          if (c.forecast !== null) {
            fcSum += c.forecast;
            fcPlan += c.plan;
          }
        }
        if (c.dayFact !== null) {
          day += c.dayFact;
          dayCount += 1;
        }
      }

      const has = covered > 0;
      const percent = has ? completion(fact, plan) : null;
      const fcPercent = fcPlan > 0 ? completion(fcSum, fcPlan) : null;
      metrics[d.code] = {
        plan: has ? plan : null,
        fact: has ? fact : null,
        dayFact: dayCount ? day : null,
        percent: num(percent),
        remaining: has ? rest : null,
        forecast: fcPlan > 0 ? Math.round(fcSum) : null,
        forecastPercent: num(fcPercent),
        deltaPercent: has && dayCount ? num(completion(day, plan)) : null,
        needPerDay: null,
        level: levelOf(percent === null ? null : round1(percent), d.thresholds),
        forecastLevel: levelOf(fcPercent === null ? null : round1(fcPercent), d.thresholds),
        covered,
      };
    }

    const efficiencies: Record<string, EffCell> = {};
    for (const d of eff) {
      let n = 0;
      let m = 0;
      let any = false;
      for (const r of rows) {
        const a = d.numerator ? r.metrics[d.numerator]?.fact ?? null : null;
        const b = d.denominator ? r.metrics[d.denominator]?.fact ?? null : null;
        if (a !== null && b !== null) {
          n += a;
          m += b;
          any = true;
        }
      }
      const value = any ? efficiency(n, m) : null;
      efficiencies[d.code] = {
        value: num(value),
        level: levelOf(value === null ? null : round1(value), d.thresholds),
      };
    }
    return { metrics, efficiency: efficiencies };
  }

  private asList<T>(defs: Def[], cells: Record<string, T>) {
    return defs.map((d) => ({
      code: d.code,
      name: d.name,
      shortName: d.shortName,
      unit: d.unit,
      kind: d.kind,
      ...cells[d.code],
    }));
  }

  // ───────── сигнали ─────────

  private alertsFor(rows: StoreRow[], defs: Def[], includeSystem: boolean): Alert[] {
    const out: Alert[] = [];
    const byCode = new Map(defs.map((d) => [d.code, d]));

    for (const r of rows) {
      const common = { storeId: r.id, store: r.name, region: r.region };

      if (includeSystem && !r.hasSource) {
        out.push({ ...common, type: 'no_source', severity: 'info', message: 'До магазину не підключено таблицю' });
        continue;
      }
      if (r.lastSync && (r.lastSync.status === 'failed' || r.lastSync.status === 'partial')) {
        out.push({
          ...common,
          type: 'sync',
          severity: 'warning',
          message:
            r.lastSync.status === 'failed'
              ? `Остання синхронізація не виконана: ${r.lastSync.message ?? 'невідома помилка'}`
              : `Остання синхронізація часткова: ${r.lastSync.message ?? ''}`.trim(),
        });
      }
      if (!r.dataDate) {
        out.push({ ...common, type: 'missing_data', severity: 'warning', message: 'За обраний період немає даних' });
        continue;
      }
      if (r.stale) {
        out.push({
          ...common,
          type: 'stale',
          severity: 'warning',
          message: `Дані застаріли: останнє оновлення ${r.dataDate}`,
        });
      }
      if (r.missing.length) {
        out.push({
          ...common,
          type: 'missing_data',
          severity: 'warning',
          message: `Неповні дані: ${r.missing.map((c) => byCode.get(c)?.shortName ?? c).join(', ')}`,
        });
      }

      for (const [code, cell] of Object.entries(r.efficiency)) {
        if (!isProblem(cell.level)) continue;
        const d = byCode.get(code)!;
        out.push({
          ...common,
          type: 'efficiency',
          severity: cell.level === 'critical' ? 'critical' : 'warning',
          metric: code,
          value: cell.value,
          message: `${d.name}: ${cell.value}%`,
        });
      }

      if ((r.daysPassed ?? 0) >= MIN_FORECAST_DAYS) {
        for (const [code, cell] of Object.entries(r.metrics)) {
          if (!isProblem(cell.forecastLevel)) continue;
          const d = byCode.get(code)!;
          out.push({
            ...common,
            type: 'forecast',
            severity: cell.forecastLevel === 'critical' ? 'critical' : 'warning',
            metric: code,
            value: cell.forecastPercent,
            message: `${d.shortName}: прогноз ${cell.forecastPercent}% плану`,
          });
        }
      }
    }

    const rank = { critical: 0, warning: 1, info: 2 } as const;
    return out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.store.localeCompare(b.store));
  }

  // ───────── публічні методи ─────────

  async overview(viewer: Actor, scopes: Scope[], f: SalesFilters) {
    const b = await this.build(viewer, scopes, f);
    const withData = b.rows.filter((r) => r.dataDate);
    const agg = this.aggregate(withData, b.base, b.eff);
    const alerts = this.alertsFor(b.rows, b.defs, scopes.includes('GLOBAL'));
    const dates = withData.map((r) => r.dataDate!).sort();

    return {
      month: b.period.key,
      asOf: iso(b.asOf),
      dataDate: dates.length ? dates[dates.length - 1] : null,
      stores: {
        total: b.rows.length,
        withData: withData.length,
        stale: b.rows.filter((r) => r.stale).length,
        incomplete: b.rows.filter((r) => r.dataDate && r.missing.length).length,
      },
      // дані неповні, якщо не всі магазини в межах доступу мають свіжі повні значення
      incomplete:
        b.rows.length > withData.length ||
        b.rows.some((r) => r.stale || (r.dataDate && r.missing.length > 0)),
      metrics: this.asList(b.base, agg.metrics),
      efficiency: this.asList(b.eff, agg.efficiency),
      alerts: {
        critical: alerts.filter((a) => a.severity === 'critical').length,
        warning: alerts.filter((a) => a.severity === 'warning').length,
      },
    };
  }

  async regions(viewer: Actor, scopes: Scope[], f: SalesFilters) {
    const b = await this.build(viewer, scopes, f);
    const groups = new Map<string, StoreRow[]>();
    for (const r of b.rows) groups.set(r.regionId, [...(groups.get(r.regionId) ?? []), r]);

    return {
      month: b.period.key,
      metrics: b.base.map((d) => ({ code: d.code, name: d.name, shortName: d.shortName, unit: d.unit })),
      efficiency: b.eff.map((d) => ({ code: d.code, name: d.name, shortName: d.shortName })),
      regions: [...groups.entries()].map(([id, rows]) => {
        const withData = rows.filter((r) => r.dataDate);
        const agg = this.aggregate(withData, b.base, b.eff);
        return {
          id,
          name: rows[0].region,
          stores: rows.length,
          storesWithData: withData.length,
          metrics: agg.metrics,
          efficiency: agg.efficiency,
        };
      }),
    };
  }

  async stores(viewer: Actor, scopes: Scope[], f: SalesFilters) {
    const b = await this.build(viewer, scopes, f);
    const alerts = this.alertsFor(b.rows, b.defs, scopes.includes('GLOBAL'));
    const count = new Map<string, number>();
    for (const a of alerts) count.set(a.storeId, (count.get(a.storeId) ?? 0) + 1);

    return {
      month: b.period.key,
      metrics: b.base.map((d) => ({ code: d.code, name: d.name, shortName: d.shortName, unit: d.unit })),
      efficiency: b.eff.map((d) => ({ code: d.code, name: d.name, shortName: d.shortName })),
      stores: b.rows.map((r) => ({ ...r, alerts: count.get(r.id) ?? 0, lastSync: undefined })),
    };
  }

  async store(viewer: Actor, scopes: Scope[], id: string, f: SalesFilters) {
    const b = await this.build(viewer, scopes, { ...f, storeId: id });
    const row = b.rows[0];
    if (!row) throw new NotFoundException('Магазин не знайдено або він поза вашим доступом');

    const days = b.byStore.get(id);
    const history = days
      ? [...days.keys()].sort().map((date) => {
          const snap = b.snapBy.get(`${id}|${date}`);
          const { metrics, efficiencies } = b.makeMetrics(
            days.get(date),
            snap?.daysPassed ?? null,
            snap?.daysLeft ?? null,
          );
          return {
            date,
            daysPassed: snap?.daysPassed ?? null,
            metrics: Object.fromEntries(
              Object.entries(metrics).map(([code, c]) => [
                code,
                { fact: c.fact, plan: c.plan, dayFact: c.dayFact, percent: c.percent },
              ]),
            ),
            efficiency: Object.fromEntries(
              Object.entries(efficiencies).map(([code, c]) => [code, c.value]),
            ),
          };
        })
      : [];

    return {
      month: b.period.key,
      store: { ...row, lastSync: row.lastSync },
      metrics: this.asList(b.base, row.metrics),
      efficiency: this.asList(b.eff, row.efficiency),
      history,
      alerts: this.alertsFor([row], b.defs, scopes.includes('GLOBAL')),
    };
  }

  async alerts(viewer: Actor, scopes: Scope[], f: SalesFilters) {
    const b = await this.build(viewer, scopes, f);
    return { month: b.period.key, alerts: this.alertsFor(b.rows, b.defs, scopes.includes('GLOBAL')) };
  }

  // Динаміка мережі по днях місяця: накопичувальний % плану та продаж за день.
  // Для кожного дня береться останнє відоме значення магазину (дані могли надійти не щодня).
  async trend(viewer: Actor, scopes: Scope[], f: SalesFilters) {
    const b = await this.build(viewer, scopes, f);
    const dateSet = new Set<string>();
    for (const days of b.byStore.values()) for (const d of days.keys()) dateSet.add(d);
    const dates = [...dateSet].sort();

    const points = dates.map((date) => {
      const metrics: Record<
        string,
        { plan: number | null; fact: number | null; percent: number | null; dayFact: number | null }
      > = {};
      for (const d of b.base) {
        let plan = 0;
        let fact = 0;
        let day = 0;
        let dayCount = 0;
        let covered = 0;
        for (const days of b.byStore.values()) {
          const known = [...days.keys()].filter((k) => k <= date).sort();
          const last = known.length ? known[known.length - 1] : null;
          const r = last ? days.get(last)?.get(d.code) : undefined;
          if (r && r.plan !== null && r.fact !== null) {
            plan += r.plan;
            fact += r.fact;
            covered += 1;
          }
          // продаж за день — лише якщо магазин має запис саме на цю дату
          const own = days.get(date)?.get(d.code);
          if (own && own.dayFact !== null) {
            day += own.dayFact;
            dayCount += 1;
          }
        }
        metrics[d.code] = {
          plan: covered ? plan : null,
          fact: covered ? fact : null,
          percent: covered ? num(completion(fact, plan)) : null,
          dayFact: dayCount ? day : null,
        };
      }
      const eff: Record<string, number | null> = {};
      for (const d of b.eff) {
        const n = d.numerator ? (metrics[d.numerator]?.fact ?? null) : null;
        const m = d.denominator ? (metrics[d.denominator]?.fact ?? null) : null;
        eff[d.code] = num(efficiency(n, m));
      }
      return { date, metrics, efficiency: eff };
    });

    return {
      month: b.period.key,
      metrics: b.base.map((d) => ({ code: d.code, name: d.name, shortName: d.shortName })),
      efficiency: b.eff.map((d) => ({ code: d.code, name: d.name, shortName: d.shortName })),
      points,
    };
  }

  // Підсумок по місяцях календарного року. Значення місяця — останній знімок кожного магазину
  // за цей місяць; незакриті місяці (поточний або з неповними даними) позначені partial.
  async year(
    viewer: Actor,
    scopes: Scope[],
    f: { year?: string; regionId?: string; storeId?: string },
  ) {
    const nowYear = Number(iso(kyivDay()).slice(0, 4));
    const year = f.year ? Number(f.year) : nowYear;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Некоректний рік');
    }
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31));

    const [defs, stores] = await Promise.all([
      this.defs(),
      this.prisma.store.findMany({
        where: this.storeWhere(scopes, viewer, { regionId: f.regionId, storeId: f.storeId }),
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          city: { select: { name: true } },
          region: { select: { name: true } },
        },
      }),
    ]);
    const base = defs.filter((d) => d.kind === 'base');
    const eff = defs.filter((d) => d.kind === 'efficiency');
    const ids = stores.map((s) => s.id);

    const [rows, snaps] = ids.length
      ? await Promise.all([
          this.prisma.salesMetric.findMany({
            where: { storeId: { in: ids }, date: { gte: start, lte: end } },
            select: { storeId: true, date: true, metricCode: true, plan: true, fact: true },
          }),
          this.prisma.salesSnapshot.findMany({
            where: { storeId: { in: ids }, date: { gte: start, lte: end } },
            select: { storeId: true, date: true, daysLeft: true },
          }),
        ])
      : [[], []];

    // місяць → магазин → остання дата з даними
    const lastDate = new Map<string, Map<string, string>>();
    for (const r of rows) {
      const d = iso(r.date);
      const mk = d.slice(0, 7);
      const perStore = lastDate.get(mk) ?? new Map<string, string>();
      if (!perStore.has(r.storeId) || perStore.get(r.storeId)! < d) perStore.set(r.storeId, d);
      lastDate.set(mk, perStore);
    }
    const left = new Map<string, number | null>();
    for (const s of snaps) left.set(`${s.storeId}|${iso(s.date)}`, s.daysLeft);

    const currentKey = iso(kyivDay()).slice(0, 7);
    const months: Record<string, unknown>[] = [];

    // магазин → місяць → показники на останню дату місяця (основний розріз «по кожному магазину»)
    type StoreMonth = {
      lastDate: string;
      partial: boolean;
      metrics: Record<string, { plan: number | null; fact: number | null; percent: number | null; level: Level | null }>;
      efficiency: Record<string, EffCell>;
    };
    const perStoreMonths = new Map<string, Record<string, StoreMonth>>();

    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      const perStore = lastDate.get(key);
      if (!perStore) {
        months.push({ month: key, hasData: false });
        continue;
      }
      const at = new Map<string, Map<string, { plan: number | null; fact: number | null }>>();
      for (const r of rows) {
        if (iso(r.date) !== perStore.get(r.storeId)) continue;
        const per = at.get(r.storeId) ?? new Map();
        per.set(r.metricCode, { plan: r.plan, fact: r.fact });
        at.set(r.storeId, per);
      }

      for (const [sid, per] of at) {
        const sm: StoreMonth['metrics'] = {};
        for (const d of base) {
          const r = per.get(d.code);
          const pct = r && r.plan !== null && r.fact !== null ? completion(r.fact, r.plan) : null;
          sm[d.code] = {
            plan: r?.plan ?? null,
            fact: r?.fact ?? null,
            percent: num(pct),
            level: levelOf(pct === null ? null : round1(pct), d.thresholds),
          };
        }
        const se: Record<string, EffCell> = {};
        for (const d of eff) {
          const v = efficiency(
            d.numerator ? (sm[d.numerator]?.fact ?? null) : null,
            d.denominator ? (sm[d.denominator]?.fact ?? null) : null,
          );
          se[d.code] = { value: num(v), level: levelOf(v === null ? null : round1(v), d.thresholds) };
        }
        const last = perStore.get(sid)!;
        const bucket = perStoreMonths.get(sid) ?? {};
        bucket[key] = {
          lastDate: last,
          partial: key === currentKey || left.get(`${sid}|${last}`) !== 0,
          metrics: sm,
          efficiency: se,
        };
        perStoreMonths.set(sid, bucket);
      }

      const metrics: Record<
        string,
        { plan: number | null; fact: number | null; percent: number | null; level: Level | null }
      > = {};
      for (const d of base) {
        let plan = 0;
        let fact = 0;
        let covered = 0;
        for (const per of at.values()) {
          const r = per.get(d.code);
          if (r && r.plan !== null && r.fact !== null) {
            plan += r.plan;
            fact += r.fact;
            covered += 1;
          }
        }
        const pct = covered ? completion(fact, plan) : null;
        metrics[d.code] = {
          plan: covered ? plan : null,
          fact: covered ? fact : null,
          percent: num(pct),
          level: levelOf(pct === null ? null : round1(pct), d.thresholds),
        };
      }
      const efficiencies: Record<string, EffCell> = {};
      for (const d of eff) {
        const n = d.numerator ? (metrics[d.numerator]?.fact ?? null) : null;
        const den = d.denominator ? (metrics[d.denominator]?.fact ?? null) : null;
        const v = efficiency(n, den);
        efficiencies[d.code] = {
          value: num(v),
          level: levelOf(v === null ? null : round1(v), d.thresholds),
        };
      }

      const dates = [...perStore.values()].sort();
      // місяць закритий, якщо в усіх магазинів останній знімок мав 0 днів до кінця
      const closed =
        key !== currentKey &&
        [...perStore.entries()].every(([sid, d]) => left.get(`${sid}|${d}`) === 0);

      months.push({
        month: key,
        hasData: true,
        stores: perStore.size,
        lastDate: dates[dates.length - 1],
        partial: !closed,
        metrics,
        efficiency: efficiencies,
      });
    }

    return {
      year,
      metrics: base.map((d) => ({ code: d.code, name: d.name, shortName: d.shortName })),
      efficiency: eff.map((d) => ({ code: d.code, name: d.name, shortName: d.shortName })),
      // по кожному магазину окремо
      stores: stores.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        city: s.city?.name ?? null,
        region: s.region.name,
        months: perStoreMonths.get(s.id) ?? {},
      })),
      // зведення по мережі лишається в API для сумісності, інтерфейс його не використовує
      months,
    };
  }

  // Рейтинг із явним критерієм (ANALYTICS §13): виконання плану, прогноз або ефективність
  async rankings(
    viewer: Actor,
    scopes: Scope[],
    f: SalesFilters,
    opts: { by: 'completion' | 'forecast' | 'efficiency'; metric: string; level: 'stores' | 'regions' },
  ) {
    const b = await this.build(viewer, scopes, f);
    const def = b.defs.find((d) => d.code === opts.metric);
    if (!def) throw new BadRequestException('Невідома метрика');
    if (opts.by === 'efficiency' ? def.kind !== 'efficiency' : def.kind !== 'base') {
      throw new BadRequestException('Критерій не підходить до цієї метрики');
    }

    const pick = (cells: { metrics: Record<string, MetricCell>; efficiency: Record<string, EffCell> }) => {
      if (opts.by === 'efficiency') {
        const c = cells.efficiency[def.code];
        return { value: c?.value ?? null, level: c?.level ?? null };
      }
      const c = cells.metrics[def.code];
      return opts.by === 'forecast'
        ? { value: c?.forecastPercent ?? null, level: c?.forecastLevel ?? null }
        : { value: c?.percent ?? null, level: c?.level ?? null };
    };

    let items: { id: string; name: string; extra: string | null; value: number | null; level: Level | null }[];
    if (opts.level === 'regions') {
      const groups = new Map<string, StoreRow[]>();
      for (const r of b.rows.filter((x) => x.dataDate)) {
        groups.set(r.regionId, [...(groups.get(r.regionId) ?? []), r]);
      }
      items = [...groups.entries()].map(([id, rows]) => {
        const agg = this.aggregate(rows, b.base, b.eff);
        return { id, name: rows[0].region, extra: `${rows.length} магазинів`, ...pick(agg) };
      });
    } else {
      items = b.rows.map((r) => ({
        id: r.id,
        name: r.name,
        extra: [r.city, r.region].filter(Boolean).join(' · '),
        ...pick(r),
      }));
    }

    const ranked = items.filter((i) => i.value !== null).sort((a, b2) => b2.value! - a.value!);
    let prev: number | null = null;
    let rank = 0;
    const rows = ranked.map((it, i) => {
      if (it.value !== prev) rank = i + 1; // однакові значення — однакове місце
      prev = it.value;
      return { rank, ...it };
    });

    const labels = {
      completion: 'Виконання плану, %',
      forecast: 'Прогноз виконання плану, %',
      efficiency: 'Ефективність, %',
    } as const;

    return {
      month: b.period.key,
      criterion: { by: opts.by, metric: def.code, metricName: def.name, label: labels[opts.by] },
      rows,
      withoutData: items.filter((i) => i.value === null).map((i) => ({ id: i.id, name: i.name })),
    };
  }
}
