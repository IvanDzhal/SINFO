import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, authorWhere, scopesFor } from '../knowledge/helpers';
import { testAuthorWhere } from '../testing/visibility';

// Скільки днів видалене лежить у кошику, перш ніж зникне остаточно
export const TRASH_DAYS = 30;
const EVERY_MS = 60 * 60 * 1000;

@Injectable()
export class TrashService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    const run = () => this.purgeExpired().catch((e) => console.error('Trash cleanup failed', e));
    setTimeout(run, 60_000).unref();
    this.timer = setInterval(run, EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private daysLeft(at: Date | null) {
    if (!at) return TRASH_DAYS;
    const left = TRASH_DAYS - (Date.now() - at.getTime()) / 86_400_000;
    return Math.max(0, Math.ceil(left));
  }

  async list(user: Actor) {
    const [itemScopes, testScopes, catScopes] = await Promise.all([
      scopesFor(this.prisma, user.id, 'knowledge.delete'),
      scopesFor(this.prisma, user.id, 'testing.delete'),
      scopesFor(this.prisma, user.id, 'knowledge.manage_categories'),
    ]);

    const [items, tests, categories] = await Promise.all([
      itemScopes.length
        ? this.prisma.knowledgeItem.findMany({
            where: { AND: [{ status: 'trashed' }, authorWhere(itemScopes, user)] },
            orderBy: { trashedAt: 'desc' },
            select: { id: true, title: true, type: true, trashedAt: true, trashedFrom: true },
          })
        : [],
      testScopes.length
        ? this.prisma.test.findMany({
            where: { AND: [{ status: 'trashed' }, testAuthorWhere(testScopes, user)] },
            orderBy: { trashedAt: 'desc' },
            select: { id: true, title: true, trashedAt: true, trashedFrom: true },
          })
        : [],
      catScopes.length
        ? this.prisma.knowledgeCategory.findMany({
            where: { trashedAt: { not: null } },
            orderBy: { trashedAt: 'desc' },
            select: { id: true, name: true, parentId: true, trashedAt: true },
          })
        : [],
    ]);

    return {
      days: TRASH_DAYS,
      items: items.map((i) => ({ ...i, daysLeft: this.daysLeft(i.trashedAt) })),
      tests: tests.map((t) => ({ ...t, daysLeft: this.daysLeft(t.trashedAt) })),
      categories: categories.map((c) => ({ ...c, daysLeft: this.daysLeft(c.trashedAt) })),
    };
  }

  // Остаточно видаляє все, що пролежало в кошику довше за TRASH_DAYS
  async purgeExpired() {
    const before = new Date(Date.now() - TRASH_DAYS * 86_400_000);

    const tests = await this.prisma.test.findMany({
      where: { status: 'trashed', trashedAt: { lt: before } },
      select: { id: true },
    });
    for (const t of tests) {
      await this.prisma.$transaction([
        this.prisma.testAttempt.deleteMany({ where: { testId: t.id } }),
        this.prisma.test.delete({ where: { id: t.id } }),
      ]);
    }

    await this.prisma.knowledgeItem.deleteMany({
      where: { status: 'trashed', trashedAt: { lt: before } },
    });

    const cats = await this.prisma.knowledgeCategory.findMany({
      where: { trashedAt: { lt: before } },
      select: { id: true },
    });
    const ids = cats.map((c) => c.id);
    if (ids.length) {
      await this.prisma.$transaction([
        this.prisma.$executeRaw`UPDATE "KnowledgeItem" SET "categoryId" = NULL WHERE "categoryId" = ANY(${ids})`,
        this.prisma.test.updateMany({ where: { categoryId: { in: ids } }, data: { categoryId: null } }),
        // підкатегорії раніше за батьківські, щоб не порушити зв'язок
        this.prisma.knowledgeCategory.deleteMany({ where: { id: { in: ids }, parentId: { not: null } } }),
        this.prisma.knowledgeCategory.deleteMany({ where: { id: { in: ids } } }),
      ]);
    }
  }
}
