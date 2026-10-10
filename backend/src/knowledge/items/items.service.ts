import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { KnowledgeType, Prisma, VisibilityKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { authorWhere, canManageItem, scopesFor } from '../helpers';

type Viewer = {
  id: string;
  regionId: string | null;
  storeId: string | null;
  managedRegionIds?: string[];
};

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  private async visibleWhere(user: Viewer): Promise<Prisma.KnowledgeItemWhereInput> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId: user.id, role: { archivedAt: null } },
      select: { roleId: true },
    });
    const roleIds = roles.map((r) => r.roleId);
    const regionIds = [user.regionId, ...(user.managedRegionIds ?? [])].filter(
      (x): x is string => !!x,
    );
    const store = user.storeId
      ? await this.prisma.store.findUnique({
          where: { id: user.storeId },
          select: { brandFormatId: true },
        })
      : null;

    // Групи правил поєднуються через «і», всередині групи достатньо одного збігу
    const groupOk = (
      kinds: VisibilityKind[],
      matches: Prisma.KnowledgeVisibilityWhereInput[],
    ): Prisma.KnowledgeItemWhereInput => ({
      OR: [
        { visibility: { none: { kind: { in: kinds } } } },
        ...(matches.length ? [{ visibility: { some: { OR: matches } } }] : []),
      ],
    });

    const place: Prisma.KnowledgeVisibilityWhereInput[] = [];
    if (regionIds.length) place.push({ kind: 'REGION', targetId: { in: regionIds } });
    if (user.storeId) place.push({ kind: 'STORE', targetId: user.storeId });
    const brand: Prisma.KnowledgeVisibilityWhereInput[] = store
      ? [{ kind: 'BRAND', targetId: store.brandFormatId }]
      : [];
    const role: Prisma.KnowledgeVisibilityWhereInput[] = roleIds.length
      ? [{ kind: 'ROLE', targetId: { in: roleIds } }]
      : [];

    return {
      status: 'published',
      OR: [
        { visibility: { none: {} } },
        { visibility: { some: { kind: 'GLOBAL' } } },
        {
          AND: [
            groupOk(['REGION', 'STORE'], place),
            groupOk(['BRAND'], brand),
            groupOk(['ROLE'], role),
          ],
        },
      ],
    };
  }

  async list(user: Viewer, type: KnowledgeType) {
    const where = await this.visibleWhere(user);
    const items = await this.prisma.knowledgeItem.findMany({
      where: { ...where, type },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        readingTimeMinutes: true,
        isRequired: true,
        updatedAt: true,
        category: { select: { id: true, name: true, icon: true, parentId: true } },
        reads: { where: { userId: user.id }, select: { id: true } },
      },
    });
    return items.map(({ reads, ...rest }) => ({ ...rest, isRead: reads.length > 0 }));
  }

  async latest(user: Viewer, limit: number) {
    const where = await this.visibleWhere(user);
    return this.prisma.knowledgeItem.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: Math.min(Math.max(limit || 6, 1), 20),
      select: {
        id: true,
        type: true,
        title: true,
        isRequired: true,
        publishedAt: true,
        author: { select: { firstName: true, lastName: true } },
      },
    });
  }

  private sign(userId: string, itemId: string, ts: number) {
  return createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? 'dev')
    .update(`${userId}.${itemId}.${ts}`)
    .digest('hex');
  }

  async get(user: Viewer, id: string) {
    const where = await this.visibleWhere(user);
    const item = await this.prisma.knowledgeItem.findFirst({
      where: { AND: [where, { id }] },
      include: {
        author: { select: { firstName: true, lastName: true } },
        category: { include: { parent: { select: { name: true } } } },
      },
    });
    if (!item) throw new NotFoundException('Матеріал не знайдено');

    // raw-запит, щоб лічильник не змінював дату «Оновлено»
    await this.prisma
      .$executeRaw`UPDATE "KnowledgeItem" SET "viewsCount" = "viewsCount" + 1 WHERE "id" = ${id}`;

    const read = await this.prisma.knowledgeRead.findUnique({
      where: { userId_itemId: { userId: user.id, itemId: id } },
    });
    const { contentText, ...rest } = item;
    const ts = Date.now();
    return {
      ...rest,
      viewsCount: item.viewsCount + 1,
      isRead: !!read,
      readToken: `${ts}.${this.sign(user.id, id, ts)}`,
      canManage: await canManageItem(this.prisma, user, id),
    };
  }

  async markRead(user: Viewer, id: string, token: string) {
    const [tsRaw, sig] = (token ?? '').split('.');
    const ts = Number(tsRaw);
    const expected = this.sign(user.id, id, ts);
    const valid =
      !!sig &&
      Number.isFinite(ts) &&
      sig.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!valid) throw new BadRequestException('Невірний токен');

    const age = Date.now() - ts;
    if (age < 9000) throw new BadRequestException('Матеріал відкрито менше 10 секунд тому');
    if (age > 6 * 3600 * 1000) throw new BadRequestException('Токен застарів');

    const where = await this.visibleWhere(user);
    const item = await this.prisma.knowledgeItem.findFirst({
      where: { AND: [where, { id }] },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Матеріал не знайдено');

    await this.prisma.knowledgeRead.upsert({
      where: { userId_itemId: { userId: user.id, itemId: id } },
      update: {},
      create: { userId: user.id, itemId: id, storeId: user.storeId, regionId: user.regionId },
    });
    return { isRead: true };
  }

  async similar(user: Viewer, id: string) {
    const base = await this.prisma.knowledgeItem.findUnique({
      where: { id },
      select: { type: true, categoryId: true },
    });
    if (!base) return [];
    const where = await this.visibleWhere(user);
    return this.prisma.knowledgeItem.findMany({
      where: {
        AND: [
          where,
          { id: { not: id }, type: base.type },
          base.categoryId ? { categoryId: base.categoryId } : {},
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 4,
      select: { id: true, title: true, readingTimeMinutes: true },
    });
  }

  async search(user: Viewer, q: string) {
    const words = q.trim().split(/\s+/).filter((w) => w.length >= 2).slice(0, 5);
    if (words.length === 0) return [];
    const where = await this.visibleWhere(user);
    const rows = await this.prisma.knowledgeItem.findMany({
      where: {
        AND: [
          where,
          ...words.map((w) => ({
            OR: [
              { title: { contains: w, mode: 'insensitive' as const } },
              { description: { contains: w, mode: 'insensitive' as const } },
              { contentText: { contains: w, mode: 'insensitive' as const } },
            ],
          })),
        ],
      },
      take: 30,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        contentText: true,
        category: { select: { name: true } },
      },
    });
    const score = (r: (typeof rows)[number]) =>
      words.reduce((s, w) => {
        const x = w.toLowerCase();
        return (
          s +
          (r.title.toLowerCase().includes(x) ? 3 : 0) +
          (r.description.toLowerCase().includes(x) ? 2 : 0) +
          (r.contentText.toLowerCase().includes(x) ? 1 : 0)
        );
      }, 0);
    return rows
      .sort((a, b) => score(b) - score(a))
      .slice(0, 5)
      .map(({ contentText, ...rest }) => rest);
  }

    private async accessibleWhere(
    user: Viewer,
    id: string,
  ): Promise<Prisma.KnowledgeItemWhereInput> {
    const visible = await this.visibleWhere(user);
    const scopes = await scopesFor(this.prisma, user.id, 'knowledge.edit');
    return { AND: [{ id }, { OR: [visible, authorWhere(scopes, user)] }] };
  }

  async versions(user: Viewer, id: string) {
    const item = await this.prisma.knowledgeItem.findFirst({
      where: await this.accessibleWhere(user, id),
    });
    if (!item) throw new NotFoundException('Матеріал не знайдено');

    // старі матеріали без знімка версії: створюємо знімок поточної
    const current = await this.prisma.knowledgeVersion.findUnique({
      where: { itemId_version: { itemId: id, version: item.version } },
    });
    if (!current && item.status === 'published') {
      await this.prisma.knowledgeVersion.create({
        data: {
          itemId: id,
          version: item.version,
          title: item.title,
          description: item.description,
          content: (item.content ?? undefined) as Prisma.InputJsonValue | undefined,
          authorId: item.authorId,
        },
      });
    }

    return this.prisma.knowledgeVersion.findMany({
      where: { itemId: id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        createdAt: true,
        author: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async version(user: Viewer, id: string, version: number) {
    const item = await this.prisma.knowledgeItem.findFirst({
      where: await this.accessibleWhere(user, id),
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Матеріал не знайдено');
    const v = await this.prisma.knowledgeVersion.findUnique({
      where: { itemId_version: { itemId: id, version } },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    if (!v) throw new NotFoundException('Версію не знайдено');
    return v;
  }
}