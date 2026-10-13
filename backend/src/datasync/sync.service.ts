import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma, SyncRun, SyncStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { kyivDay } from '../presence/day.util';
import { GoogleSheetsConnector, SyncError } from './connector';
import {
  dayKey,
  extract,
  ExtractIssue,
  factKey,
  Grid,
  META_DAYS_LEFT,
  META_DAYS_PASSED,
  planKey,
} from './extract';

export type SyncOptions = { trigger: 'auto' | 'manual' | 'retry'; triggeredById?: string };

// Повторний запуск того самого джерела раніше за цей час вважається накладкою
const STALE_RUNNING_MS = 10 * 60 * 1000;

@Injectable()
export class SyncService {
  private readonly log = new Logger(SyncService.name);

  constructor(private prisma: PrismaService, private connector: GoogleSheetsConnector) {}

  // Ключі, які очікуємо від таблиці: за активними базовими метриками + службові дні
  async expectedKeys() {
    const defs = await this.prisma.salesMetricDef.findMany({
      where: { active: true, kind: 'base' },
      orderBy: { displayOrder: 'asc' },
    });
    const keys = [META_DAYS_PASSED, META_DAYS_LEFT];
    for (const d of defs) keys.push(planKey(d.code), factKey(d.code), dayKey(d.code));
    return { defs, keys };
  }

  async runSource(sourceId: string, opts: SyncOptions): Promise<SyncRun> {
    const source = await this.prisma.dataSource.findUnique({
      where: { id: sourceId },
      include: { mappings: true, store: { select: { id: true, name: true } } },
    });
    if (!source) throw new BadRequestException('Джерело не знайдено');
    if (source.status !== 'active') throw new BadRequestException('Джерело вимкнено');

    const running = await this.prisma.syncRun.findFirst({
      where: {
        sourceId,
        status: 'running',
        startedAt: { gte: new Date(Date.now() - STALE_RUNNING_MS) },
      },
      select: { id: true },
    });
    if (running) throw new ConflictException('Синхронізація цього джерела вже виконується');

    const run = await this.prisma.syncRun.create({
      data: {
        sourceId,
        trigger: opts.trigger,
        status: 'running',
        triggeredById: opts.triggeredById,
      },
    });

    const finish = async (data: Prisma.SyncRunUpdateInput, ok: boolean) => {
      const now = new Date();
      const [updated] = await this.prisma.$transaction([
        this.prisma.syncRun.update({ where: { id: run.id }, data: { ...data, finishedAt: now } }),
        this.prisma.dataSource.update({
          where: { id: sourceId },
          data: { lastSyncAt: now, ...(ok ? { lastSuccessfulSyncAt: now } : {}) },
        }),
      ]);
      return updated;
    };

    let grid: Grid;
    try {
      grid = await this.connector.readGrid({
        externalId: source.externalId,
        sheetName: source.sheetName,
      });
    } catch (e) {
      const err =
        e instanceof SyncError ? e : new SyncError(String((e as Error)?.message ?? e), 'UNKNOWN');
      await finish({ status: 'failed', errorsCount: 1, errorMessage: err.message }, false);
      this.log.warn(`[${source.store.name}] ${err.message}`);
      if (err.retryable) throw err; // черга зробить контрольований повтор
      return this.prisma.syncRun.findUniqueOrThrow({ where: { id: run.id } });
    }

    try {
      const { defs, keys } = await this.expectedKeys();
      const result = extract(
        grid,
        source.mappings.map((m) => ({ key: m.key, cells: m.cells })),
        keys,
      );

      // добовий продаж — допоміжний: його відсутність лише попередження
      const issues: ExtractIssue[] = result.issues.map((i) =>
        i.key.startsWith('day.') && i.severity === 'error' ? { ...i, severity: 'warning' } : i,
      );
      const errorCount = issues.filter((i) => i.severity === 'error').length;

      const date = kyivDay();
      const v = result.values;

      const existing = await this.prisma.salesMetric.findMany({
        where: { storeId: source.storeId, date },
        select: { metricCode: true },
      });
      const had = new Set(existing.map((m) => m.metricCode));

      let saved = 0;
      let updated = 0;

      await this.prisma.$transaction(async (tx) => {
        await tx.salesSnapshot.upsert({
          where: { storeId_date: { storeId: source.storeId, date } },
          create: {
            storeId: source.storeId,
            date,
            sourceId,
            syncId: run.id,
            daysPassed: v[META_DAYS_PASSED] ?? null,
            daysLeft: v[META_DAYS_LEFT] ?? null,
            raw: { values: v, issues } as unknown as Prisma.InputJsonValue,
          },
          update: {
            sourceId,
            syncId: run.id,
            daysPassed: v[META_DAYS_PASSED] ?? null,
            daysLeft: v[META_DAYS_LEFT] ?? null,
            raw: { values: v, issues } as unknown as Prisma.InputJsonValue,
          },
        });

        for (const d of defs) {
          const plan = v[planKey(d.code)] ?? null;
          const fact = v[factKey(d.code)] ?? null;
          const dayFact = v[dayKey(d.code)] ?? null;
          if (plan === null && fact === null && dayFact === null) continue;

          await tx.salesMetric.upsert({
            where: {
              storeId_date_metricCode: { storeId: source.storeId, date, metricCode: d.code },
            },
            create: {
              storeId: source.storeId,
              date,
              metricCode: d.code,
              plan,
              fact,
              dayFact,
              sourceId,
              syncId: run.id,
            },
            update: { plan, fact, dayFact, sourceId, syncId: run.id },
          });
          if (had.has(d.code)) updated += 1;
          else saved += 1;
        }
      });

      const touched = saved + updated;
      const status: SyncStatus =
        errorCount === 0 ? 'success' : touched > 0 ? 'partial' : 'failed';
      const firstError = issues.find((i) => i.severity === 'error');

      return await finish(
        {
          status,
          recordsRead: result.read,
          recordsSaved: saved,
          recordsUpdated: updated,
          errorsCount: errorCount,
          errorMessage: firstError ? `${firstError.key}: ${firstError.message}` : null,
          details: { issues } as unknown as Prisma.InputJsonValue,
        },
        status === 'success',
      );
    } catch (e) {
      const message = String((e as Error)?.message ?? e);
      this.log.error(`[${source.store.name}] ${message}`);
      return finish({ status: 'failed', errorsCount: 1, errorMessage: message }, false);
    }
  }

  // Усі активні джерела по черзі; помилка одного магазину не зупиняє решту
  async runAll(trigger: SyncOptions['trigger'], triggeredById?: string) {
    const sources = await this.prisma.dataSource.findMany({
      where: { status: 'active' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    const out: { sourceId: string; status: SyncStatus | 'error'; message?: string }[] = [];
    for (const s of sources) {
      try {
        const run = await this.runSource(s.id, { trigger, triggeredById });
        out.push({ sourceId: s.id, status: run.status, message: run.errorMessage ?? undefined });
      } catch (e) {
        out.push({ sourceId: s.id, status: 'error', message: String((e as Error)?.message ?? e) });
      }
    }
    return out;
  }
}
