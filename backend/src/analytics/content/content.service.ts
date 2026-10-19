import { Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeType, Prisma, Scope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Actor } from '../../knowledge/helpers';
import { userScopeWhere } from '../../testing/visibility';
import { isVisibleTo } from './visibility';
import type { Sheet } from '../../common/xlsx';

// Продавець визначається так само, як у профілі (див. ProfileService)
const SELLER_ROLE = 'Продавець';

export type ContentFilters = {
  regionId?: string;
  storeId?: string;
  userId?: string;
  search?: string;
  type?: KnowledgeType;
  from?: Date;
  to?: Date;
};

type Stats = { total: number; viewed: number; requiredTotal: number; requiredViewed: number };

type SellerRow = Stats & {
  id: string;
  name: string;
  login: string;
  regionId: string | null;
  region: string | null;
  storeId: string | null;
  store: string | null;
  city: string | null;
  lastActivityAt: Date | null;
  unviewed: { id: string; slug: string | null; title: string; isRequired: boolean }[];
};

const percent = (viewed: number, total: number) =>
  total > 0 ? Math.round((viewed / total) * 100) : null;

const withPercent = <T extends Stats>(s: T) => ({
  ...s,
  unviewedCount: s.total - s.viewed,
  percent: percent(s.viewed, s.total),
  requiredPercent: percent(s.requiredViewed, s.requiredTotal),
});

const emptyStats = (): Stats => ({ total: 0, viewed: 0, requiredTotal: 0, requiredViewed: 0 });

function addStats(into: Stats, row: Stats) {
  into.total += row.total;
  into.viewed += row.viewed;
  into.requiredTotal += row.requiredTotal;
  into.requiredViewed += row.requiredViewed;
}

@Injectable()
export class ContentAnalyticsService {
  constructor(private prisma: PrismaService) {}

  // Єдине місце розрахунку: працівники в межах доступу, їхні релевантні матеріали
  // (опубліковані й видимі саме їм) та які з них переглянуто.
  private async compute(viewer: Actor, scopes: Scope[], f: ContentFilters) {
    const and: Prisma.UserWhereInput[] = [
      userScopeWhere(scopes, viewer),
      {
        status: 'active',
        roles: { some: { role: { name: SELLER_ROLE, archivedAt: null } } },
      },
    ];
    if (f.regionId) and.push({ regionId: f.regionId });
    if (f.storeId) and.push({ storeId: f.storeId });
    if (f.userId) and.push({ id: f.userId });
    if (f.search) {
      and.push({
        OR: [
          { firstName: { contains: f.search, mode: 'insensitive' } },
          { lastName: { contains: f.search, mode: 'insensitive' } },
          { login: { contains: f.search, mode: 'insensitive' } },
        ],
      });
    }

    const [users, items] = await Promise.all([
      this.prisma.user.findMany({
        where: { AND: and },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          login: true,
          regionId: true,
          storeId: true,
          region: { select: { name: true } },
          store: { select: { name: true, brandFormatId: true, city: { select: { name: true } } } },
          managedRegions: { select: { regionId: true } },
          roles: { where: { role: { archivedAt: null } }, select: { roleId: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.knowledgeItem.findMany({
        where: { status: 'published', type: f.type ?? 'instruction' },
        select: {
          id: true,
          slug: true,
          title: true,
          isRequired: true,
          visibility: { select: { kind: true, targetId: true } },
        },
      }),
    ]);

    const reads =
      users.length && items.length
        ? await this.prisma.knowledgeRead.findMany({
            where: {
              userId: { in: users.map((u) => u.id) },
              itemId: { in: items.map((i) => i.id) },
              ...(f.from || f.to ? { readAt: { gte: f.from, lte: f.to } } : {}),
            },
            select: { userId: true, itemId: true, readAt: true },
          })
        : [];

    const readsByUser = new Map<string, Map<string, Date>>();
    for (const r of reads) {
      const m = readsByUser.get(r.userId) ?? new Map<string, Date>();
      m.set(r.itemId, r.readAt);
      readsByUser.set(r.userId, m);
    }

    const sellers: SellerRow[] = [];
    // аудиторія кожного матеріалу — для зведення «які матеріали ігнорують»
    const materials = new Map<
      string,
      { id: string; slug: string | null; title: string; isRequired: boolean; audience: number; viewed: number }
    >();

    for (const u of users) {
      const who = {
        regionIds: [u.regionId, ...u.managedRegions.map((m) => m.regionId)].filter(
          (x): x is string => !!x,
        ),
        storeId: u.storeId,
        brandId: u.store?.brandFormatId ?? null,
        roleIds: u.roles.map((r) => r.roleId),
      };
      const done = readsByUser.get(u.id);
      const row: SellerRow = {
        id: u.id,
        name: `${u.lastName} ${u.firstName}`.trim(),
        login: u.login,
        regionId: u.regionId,
        region: u.region?.name ?? null,
        storeId: u.storeId,
        store: u.store?.name ?? null,
        city: u.store?.city.name ?? null,
        lastActivityAt: null,
        unviewed: [],
        ...emptyStats(),
      };

      for (const item of items) {
        if (!isVisibleTo(item.visibility, who)) continue;
        const readAt = done?.get(item.id);
        const m = materials.get(item.id) ?? {
          id: item.id,
          slug: item.slug,
          title: item.title,
          isRequired: item.isRequired,
          audience: 0,
          viewed: 0,
        };
        m.audience += 1;

        row.total += 1;
        if (item.isRequired) row.requiredTotal += 1;
        if (readAt) {
          row.viewed += 1;
          m.viewed += 1;
          if (item.isRequired) row.requiredViewed += 1;
          if (!row.lastActivityAt || readAt > row.lastActivityAt) row.lastActivityAt = readAt;
        } else {
          row.unviewed.push({ id: item.id, slug: item.slug, title: item.title, isRequired: item.isRequired });
        }
        materials.set(item.id, m);
      }
      sellers.push(row);
    }

    return { sellers, materials: [...materials.values()] };
  }

  async overview(viewer: Actor, scopes: Scope[], f: ContentFilters) {
    const { sellers } = await this.compute(viewer, scopes, f);
    const totals = emptyStats();
    for (const s of sellers) addStats(totals, s);

    return {
      sellers: sellers.length,
      // 100% за всіма релевантними матеріалами
      completed: sellers.filter((s) => s.total > 0 && s.viewed === s.total).length,
      // без релевантних матеріалів прогрес не визначений
      withoutMaterials: sellers.filter((s) => s.total === 0).length,
      ...withPercent(totals),
    };
  }

  private group(
    sellers: SellerRow[],
    key: (s: SellerRow) => { id: string | null; name: string; extra?: Record<string, unknown> },
  ) {
    type Group = { id: string | null; name: string; sellers: number } & Stats &
      Record<string, unknown>;
    const map = new Map<string, Group>();
    for (const s of sellers) {
      const k = key(s);
      const mapKey = k.id ?? `none:${k.name}`;
      const cur =
        map.get(mapKey) ??
        ({ id: k.id, name: k.name, ...k.extra, sellers: 0, ...emptyStats() } as Group);
      cur.sellers += 1;
      addStats(cur, s);
      map.set(mapKey, cur);
    }
    return [...map.values()]
      .map((g) => withPercent(g))
      .sort((a, b) => (a.percent ?? -1) - (b.percent ?? -1));
  }

  async regions(viewer: Actor, scopes: Scope[], f: ContentFilters) {
    const { sellers } = await this.compute(viewer, scopes, f);
    return this.group(sellers, (s) => ({ id: s.regionId, name: s.region ?? 'Без області' }));
  }

  async stores(viewer: Actor, scopes: Scope[], f: ContentFilters) {
    const { sellers } = await this.compute(viewer, scopes, f);
    return this.group(sellers, (s) => ({
      id: s.storeId,
      name: s.store ?? 'Без магазину',
      extra: { city: s.city, region: s.region },
    }));
  }

  async sellers(viewer: Actor, scopes: Scope[], f: ContentFilters) {
    const { sellers } = await this.compute(viewer, scopes, f);
    return sellers.map(({ unviewed: _unviewed, ...s }) => withPercent(s));
  }

  async unviewed(viewer: Actor, scopes: Scope[], userId: string, f: ContentFilters) {
    const { sellers } = await this.compute(viewer, scopes, { ...f, userId });
    const seller = sellers[0];
    if (!seller) throw new NotFoundException('Працівника не знайдено або він поза вашим доступом');
    const { unviewed, ...rest } = seller;
    return { seller: withPercent(rest), unviewed };
  }

  // Матеріали за охопленням: найменш переглянуті — першими
  async materials(viewer: Actor, scopes: Scope[], f: ContentFilters) {
    const { materials } = await this.compute(viewer, scopes, f);
    return materials
      .map((m) => ({
        ...m,
        notViewed: m.audience - m.viewed,
        percent: percent(m.viewed, m.audience),
      }))
      .sort((a, b) => (a.percent ?? 101) - (b.percent ?? 101) || a.title.localeCompare(b.title));
  }

  // Статистика по кожній статті окремо: відкриття (усі) та унікальні читачі (у межах доступу)
  async articles(viewer: Actor, scopes: Scope[], f: ContentFilters) {
    const items = await this.prisma.knowledgeItem.findMany({
      where: {
        status: 'published',
        ...(f.type ? { type: f.type } : {}),
        ...(f.search ? { title: { contains: f.search, mode: 'insensitive' as const } } : {}),
      },
      select: {
        id: true,
        slug: true,
        type: true,
        title: true,
        version: true,
        viewsCount: true,
        publishedAt: true,
        updatedAt: true,
        category: { select: { name: true } },
      },
    });
    const readers = items.length
      ? await this.prisma.knowledgeRead.groupBy({
          by: ['itemId'],
          where: {
            itemId: { in: items.map((i) => i.id) },
            user: userScopeWhere(scopes, viewer),
            ...(f.from || f.to ? { readAt: { gte: f.from, lte: f.to } } : {}),
          },
          _count: { _all: true },
          _max: { readAt: true },
        })
      : [];
    const byItem = new Map(readers.map((r) => [r.itemId, r]));
    return items
      .map(({ category, ...i }) => ({
        ...i,
        category: category?.name ?? null,
        readers: byItem.get(i.id)?._count._all ?? 0,
        lastReadAt: byItem.get(i.id)?._max.readAt ?? null,
      }))
      .sort((a, b) => b.viewsCount - a.viewsCount || a.title.localeCompare(b.title));
  }

  async articleReaders(viewer: Actor, scopes: Scope[], itemId: string) {
    const item = await this.prisma.knowledgeItem.findUnique({
      where: { id: itemId },
      select: { id: true, title: true, viewsCount: true },
    });
    if (!item) throw new NotFoundException('Матеріал не знайдено');
    const reads = await this.prisma.knowledgeRead.findMany({
      where: { itemId, user: userScopeWhere(scopes, viewer) },
      orderBy: { readAt: 'desc' },
      select: {
        readAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            login: true,
            region: { select: { name: true } },
            store: { select: { name: true } },
          },
        },
      },
    });
    return {
      item,
      readers: reads.map((r) => ({
        name: `${r.user.firstName} ${r.user.lastName}`,
        login: r.user.login,
        region: r.user.region?.name ?? null,
        store: r.user.store?.name ?? null,
        readAt: r.readAt,
      })),
    };
  }

  // Таблиці для Excel: прогрес по продавцях і статистика по статтях
  async exportSheets(viewer: Actor, scopes: Scope[], f: ContentFilters): Promise<Sheet[]> {
    const { sellers } = await this.compute(viewer, scopes, f);
    const sellersSheet: Sheet = {
      name: 'Продавці',
      columns: [
        { header: 'Працівник', key: 'name', width: 28 },
        { header: 'Логін', key: 'login', width: 16 },
        { header: 'Область', key: 'region', width: 22 },
        { header: 'Магазин', key: 'store', width: 26 },
        { header: 'Матеріалів', key: 'total', width: 12 },
        { header: 'Переглянуто', key: 'viewed', width: 14 },
        { header: 'Прогрес, %', key: 'percent', width: 12 },
        { header: 'Обов’язкові, %', key: 'required', width: 16 },
        { header: 'Остання активність', key: 'last', width: 20 },
      ],
      rows: sellers.map((s) => ({
        name: s.name,
        login: s.login,
        region: s.region ?? '',
        store: s.store ?? '',
        total: s.total,
        viewed: s.viewed,
        percent: percent(s.viewed, s.total),
        required: percent(s.requiredViewed, s.requiredTotal),
        last: s.lastActivityAt,
      })),
    };

    const articles = await this.articles(viewer, scopes, { ...f, search: undefined });
    const TYPE: Record<string, string> = { instruction: 'Інструкція', material: 'Матеріал', news: 'Новина' };
    const articlesSheet: Sheet = {
      name: 'Статті',
      columns: [
        { header: 'Стаття', key: 'title', width: 44 },
        { header: 'Тип', key: 'type', width: 14 },
        { header: 'Категорія', key: 'category', width: 24 },
        { header: 'Відкриття', key: 'views', width: 12 },
        { header: 'Прочитали', key: 'readers', width: 12 },
        { header: 'Остання відмітка', key: 'last', width: 20 },
        { header: 'Опубліковано', key: 'published', width: 16 },
      ],
      rows: articles.map((a) => ({
        title: a.title,
        type: TYPE[a.type] ?? a.type,
        category: a.category ?? '',
        views: a.viewsCount,
        readers: a.readers,
        last: a.lastReadAt,
        published: a.publishedAt,
      })),
    };
    return [sellersSheet, articlesSheet];
  }
}
