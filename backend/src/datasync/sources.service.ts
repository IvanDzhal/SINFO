import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { normalizeA1 } from './a1';
import { GoogleSheetsConnector } from './connector';
import { extract, Grid } from './extract';
import { suggestMappings } from './suggest';
import { SyncService } from './sync.service';

const MAX_CELLS_PER_KEY = 10;

// Приймає і чистий ID, і посилання на таблицю
export function spreadsheetIdFrom(input: string): string {
  const raw = input.trim();
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(raw);
  const id = m ? m[1] : raw;
  if (!/^[a-zA-Z0-9-_]{20,}$/.test(id)) {
    throw new BadRequestException('Некоректний ID або посилання на Google таблицю');
  }
  return id;
}

@Injectable()
export class SourcesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private connector: GoogleSheetsConnector,
    private sync: SyncService,
  ) {}

  async list() {
    const [sources, { keys }] = await Promise.all([
      this.prisma.dataSource.findMany({
        orderBy: { store: { name: 'asc' } },
        include: {
          store: {
            select: { id: true, name: true, code: true, region: { select: { name: true } } },
          },
          mappings: { select: { key: true, cells: true } },
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              startedAt: true,
              finishedAt: true,
              errorMessage: true,
              errorsCount: true,
            },
          },
        },
      }),
      this.sync.expectedKeys(),
    ]);

    return sources.map(({ mappings, runs, ...s }) => {
      const configured = new Set(mappings.filter((m) => m.cells.length > 0).map((m) => m.key));
      const missing = keys.filter((k) => !configured.has(k) && !k.startsWith('day.'));
      return { ...s, lastRun: runs[0] ?? null, missingKeys: missing };
    });
  }

  private async get(id: string) {
    const source = await this.prisma.dataSource.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true, code: true } },
        mappings: true,
      },
    });
    if (!source) throw new NotFoundException('Джерело не знайдено');
    return source;
  }

  // Деталі джерела з переліком ключів, які редактор має показати
  async detail(id: string) {
    const [source, { defs, keys }] = await Promise.all([this.get(id), this.sync.expectedKeys()]);
    return {
      ...source,
      metrics: defs.map((d) => ({ code: d.code, name: d.name, shortName: d.shortName })),
      keys,
    };
  }

  async create(
    actorId: string,
    dto: { storeId: string; externalId: string; sheetName?: string; copyFromSourceId?: string },
  ) {
    const store = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!store) throw new NotFoundException('Магазин не знайдено');
    const taken = await this.prisma.dataSource.findUnique({ where: { storeId: dto.storeId } });
    if (taken) throw new ConflictException('До цього магазину вже підключено таблицю');

    const source = await this.prisma.dataSource.create({
      data: {
        storeId: dto.storeId,
        externalId: spreadsheetIdFrom(dto.externalId),
        sheetName: dto.sheetName?.trim() || null,
      },
    });

    if (dto.copyFromSourceId) await this.copyMappings(actorId, source.id, dto.copyFromSourceId, true);

    await this.audit.log(actorId, 'datasource.created', 'DataSource', source.id, {
      store: store.name,
    });
    return this.detail(source.id);
  }

  async update(
    actorId: string,
    id: string,
    dto: { externalId?: string; sheetName?: string | null; status?: string },
  ) {
    await this.get(id);
    const source = await this.prisma.dataSource.update({
      where: { id },
      data: {
        externalId: dto.externalId ? spreadsheetIdFrom(dto.externalId) : undefined,
        sheetName: dto.sheetName === undefined ? undefined : dto.sheetName?.trim() || null,
        status: dto.status,
      },
    });
    await this.audit.log(actorId, 'datasource.updated', 'DataSource', id, { ...dto });
    return source;
  }

  async setMappings(
    actorId: string,
    id: string,
    mappings: { key: string; cells: string[] }[],
  ) {
    await this.get(id);
    const { keys } = await this.sync.expectedKeys();
    const allowed = new Set(keys);

    const prepared: { key: string; cells: string[] }[] = [];
    for (const m of mappings) {
      if (!allowed.has(m.key)) throw new BadRequestException(`Невідомий показник: ${m.key}`);
      if (m.cells.length > MAX_CELLS_PER_KEY) {
        throw new BadRequestException(`${m.key}: забагато комірок (макс ${MAX_CELLS_PER_KEY})`);
      }
      const cells = m.cells.map((c) => {
        const n = normalizeA1(c);
        if (!n) throw new BadRequestException(`${m.key}: некоректна комірка «${c}»`);
        return n;
      });
      prepared.push({ key: m.key, cells: [...new Set(cells)] });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const m of prepared) {
        if (m.cells.length === 0) {
          await tx.dataMapping.deleteMany({ where: { sourceId: id, key: m.key } });
        } else {
          await tx.dataMapping.upsert({
            where: { sourceId_key: { sourceId: id, key: m.key } },
            create: { sourceId: id, key: m.key, cells: m.cells },
            update: { cells: m.cells },
          });
        }
      }
    });
    await this.audit.log(actorId, 'datasource.mapping_updated', 'DataSource', id, {
      keys: prepared.map((m) => m.key),
    });
    return this.detail(id);
  }

  // Скопіювати mapping з іншого магазину (більшість таблиць мають спільний шаблон)
  async copyMappings(actorId: string, id: string, fromId: string, silent = false) {
    if (id === fromId) throw new BadRequestException('Неможливо копіювати з самого себе');
    await this.get(id);
    const from = await this.get(fromId);
    await this.prisma.$transaction([
      this.prisma.dataMapping.deleteMany({ where: { sourceId: id } }),
      this.prisma.dataMapping.createMany({
        data: from.mappings.map((m) => ({ sourceId: id, key: m.key, cells: m.cells })),
      }),
    ]);
    if (!silent) {
      await this.audit.log(actorId, 'datasource.mapping_copied', 'DataSource', id, { fromId });
      return this.detail(id);
    }
  }

  private async readGrid(id: string): Promise<{ grid: Grid; source: Awaited<ReturnType<SourcesService['get']>> }> {
    const source = await this.get(id);
    const grid = await this.connector.readGrid({
      externalId: source.externalId,
      sheetName: source.sheetName,
    });
    return { grid, source };
  }

  // Сітка таблиці для редактора + поточні значення за mapping
  async preview(id: string) {
    const { grid, source } = await this.readGrid(id);
    const { keys } = await this.sync.expectedKeys();
    const result = extract(
      grid,
      source.mappings.map((m) => ({ key: m.key, cells: m.cells })),
      keys,
    );
    return { grid, values: result.values, issues: result.issues };
  }

  async suggest(id: string) {
    const { grid } = await this.readGrid(id);
    const { defs } = await this.sync.expectedKeys();
    return suggestMappings(grid, defs);
  }

  runs(filters: { sourceId?: string; limit?: number }) {
    return this.prisma.syncRun.findMany({
      where: { sourceId: filters.sourceId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(filters.limit ?? 50, 200),
      include: {
        source: { select: { id: true, store: { select: { id: true, name: true, code: true } } } },
      },
    });
  }
}
