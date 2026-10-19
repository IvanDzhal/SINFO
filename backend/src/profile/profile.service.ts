import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, regionIdsOf } from '../knowledge/helpers';
import { ItemsService } from '../knowledge/items/items.service';
import { AttemptsService } from '../testing/attempts.service';
import { addDays, kyivDay } from '../presence/day.util';
import { AvatarService } from './avatar.service';
import { ProfileAccessService, SELLER_ROLE } from './profile-access.service';

const ACTIVITY_LIMIT = 5;
const RECENT_TESTS_LIMIT = 5;
const TOP_LIMIT = 10;
const ACTIVITY_WINDOW_DAYS = 7;

const round1 = (n: number) => Math.round(n * 10) / 10;

type Activity = {
  type: 'knowledge_read' | 'test_completed';
  title: string;
  targetId: string;
  at: Date;
};

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private items: ItemsService,
    private attempts: AttemptsService,
    private avatars: AvatarService,
    private access: ProfileAccessService,
  ) {}

  async get(viewer: Actor, ref: string) {
    // у посиланнях використовуємо login, але приймаємо й id
    const target = await this.prisma.user.findFirst({
      where: { OR: [{ id: ref }, { login: { equals: ref, mode: 'insensitive' } }] },
      select: {
        id: true,
        login: true,
        firstName: true,
        lastName: true,
        status: true,
        regionId: true,
        storeId: true,
        avatarKey: true,
        avatarUpdatedAt: true,
        region: { select: { name: true } },
        city: { select: { name: true } },
        store: { select: { name: true, city: { select: { name: true } }, brandFormat: { select: { name: true } } } },
        roles: { where: { role: { archivedAt: null } }, select: { role: { select: { name: true } } } },
        managedRegions: { select: { regionId: true } },
        presence: { select: { lastActivityAt: true } },
      },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const self = target.id === viewer.id;
    const roleNames = target.roles.map((r) => r.role.name);
    const isSeller = roleNames.includes(SELLER_ROLE);
    const canOpen = await this.access.canOpen(viewer);
    if (!canOpen({ id: target.id, regionId: target.regionId, isSeller })) {
      throw new ForbiddenException('Немає доступу до цього профілю');
    }
    const hasTeam = self && (await this.access.level(viewer.id)) !== 'self';
    const actor: Actor = {
      id: target.id,
      regionId: target.regionId,
      storeId: target.storeId,
      managedRegionIds: target.managedRegions.map((m) => m.regionId),
    };

    const store = target.store;
    const header = {
      id: target.id,
      firstName: target.firstName,
      lastName: target.lastName,
      login: target.login,
      status: target.status,
      roles: roleNames,
      region: target.region?.name ?? null,
      city: target.city?.name ?? store?.city.name ?? null,
      store: store?.name ?? null,
      brand: store?.brandFormat.name ?? null,
      avatarUrl: this.avatars.link(target),
      lastActivityAt: target.presence?.lastActivityAt ?? null,
    };

    const [knowledge, tests, activeDays, activity] = await Promise.all([
      this.knowledge(actor),
      this.tests(target.id),
      this.activeDays(target.id),
      // Активність РМ/Admin показуємо лише власнику
      self || isSeller ? this.activity(target.id, true, true) : null,
    ]);

    return {
      user: header,
      isSelf: self,
      // Список продавців показуємо на власному профілі РМ/CEO/Admin
      hasTeam,
      kpi: {
        instructionsRead: knowledge?.read ?? null,
        testsPassed: tests?.count ?? null,
        averagePercent: tests?.average ?? null,
        activeDays,
        activeDaysWindow: ACTIVITY_WINDOW_DAYS,
      },
      knowledge,
      tests: tests?.recent ?? null,
      activity,
    };
  }

  // Продавці в межах доступу: РМ — свої області, CEO/Admin — вся компанія
  async team(viewer: Actor) {
    const level = await this.access.level(viewer.id);
    if (level === 'self') throw new ForbiddenException('Немає доступу');

    const regionIds = regionIdsOf(viewer);
    const users = await this.prisma.user.findMany({
      where: {
        status: 'active',
        roles: { some: { role: { name: SELLER_ROLE, archivedAt: null } } },
        ...(level === 'region' ? { regionId: { in: regionIds.length ? regionIds : ['__none__'] } } : {}),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        login: true,
        firstName: true,
        lastName: true,
        avatarKey: true,
        avatarUpdatedAt: true,
        region: { select: { id: true, name: true } },
        store: { select: { name: true, city: { select: { name: true } } } },
        presence: { select: { lastActivityAt: true } },
      },
    });

    const attempts = users.length
      ? await this.prisma.testAttempt.findMany({
          where: {
            userId: { in: users.map((u) => u.id) },
            status: 'completed',
            scorePercent: { not: null },
          },
          select: { userId: true, testId: true, scorePercent: true },
        })
      : [];
    const best = new Map<string, Map<string, number>>();
    for (const a of attempts) {
      const m = best.get(a.userId) ?? new Map<string, number>();
      m.set(a.testId, Math.max(m.get(a.testId) ?? 0, a.scorePercent as number));
      best.set(a.userId, m);
    }

    const since = Date.now() - 90_000;
    return users.map((u) => {
      const scores = [...(best.get(u.id)?.values() ?? [])];
      return {
        id: u.id,
        login: u.login,
        firstName: u.firstName,
        lastName: u.lastName,
        avatarUrl: this.avatars.link(u),
        region: u.region?.name ?? null,
        store: u.store?.name ?? null,
        city: u.store?.city.name ?? null,
        tests: scores.length,
        percent: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
        online: !!u.presence && u.presence.lastActivityAt.getTime() >= since,
      };
    });
  }

  private async knowledge(actor: Actor) {
    const visible = await this.items.visibleWhere(actor, true);
    const base = { AND: [visible, { type: 'instruction' as const }] };
    const [total, read, last] = await Promise.all([
      this.prisma.knowledgeItem.count({ where: base }),
      this.prisma.knowledgeItem.count({
        where: { AND: [base, { reads: { some: { userId: actor.id } } }] },
      }),
      this.prisma.knowledgeRead.findFirst({
        where: { userId: actor.id, item: base },
        orderBy: { readAt: 'desc' },
        select: { readAt: true, item: { select: { id: true, slug: true, title: true } } },
      }),
    ]);
    return {
      read,
      total,
      percent: total > 0 ? Math.round((read / total) * 100) : 0,
      last: last ? { id: last.item.id, slug: last.item.slug, title: last.item.title, readAt: last.readAt } : null,
    };
  }

  // Унікальні тести: з кількох спроб рахується найкращий результат
  private async tests(userId: string) {
    await this.attempts.finalizeExpired(userId);
    const rows = await this.prisma.testAttempt.findMany({
      where: { userId, status: 'completed', scorePercent: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: {
        testId: true,
        scorePercent: true,
        completedAt: true,
        test: { select: { slug: true, title: true, passingScorePercent: true } },
      },
    });

    const byTest = new Map<
      string,
      { testId: string; slug: string | null; title: string; best: number; passingScorePercent: number; attempts: number; lastAt: Date | null }
    >();
    for (const r of rows) {
      const score = r.scorePercent as number;
      const cur = byTest.get(r.testId);
      if (!cur) {
        byTest.set(r.testId, {
          testId: r.testId,
          slug: r.test.slug,
          title: r.test.title,
          best: score,
          passingScorePercent: r.test.passingScorePercent,
          attempts: 1,
          lastAt: r.completedAt,
        });
      } else {
        cur.attempts += 1;
        cur.best = Math.max(cur.best, score);
      }
    }

    const all = [...byTest.values()];
    const average = all.length > 0 ? round1(all.reduce((s, t) => s + t.best, 0) / all.length) : null;
    const recent = all.slice(0, RECENT_TESTS_LIMIT).map((t) => ({
      testId: t.testId,
      slug: t.slug,
      title: t.title,
      percent: Math.round(t.best),
      passed: t.best >= t.passingScorePercent,
      passingScorePercent: t.passingScorePercent,
      attempts: t.attempts,
      lastAt: t.lastAt,
    }));
    return { count: all.length, average, recent };
  }

  private activeDays(userId: string) {
    const today = kyivDay();
    return this.prisma.userActivityDay.count({
      where: { userId, day: { gte: addDays(today, -(ACTIVITY_WINDOW_DAYS - 1)) } },
    });
  }

  private async activity(userId: string, withReads: boolean, withTests: boolean) {
    const [reads, attempts] = await Promise.all([
      withReads
        ? this.prisma.knowledgeRead.findMany({
            where: { userId },
            orderBy: { readAt: 'desc' },
            take: ACTIVITY_LIMIT,
            select: { readAt: true, item: { select: { id: true, title: true } } },
          })
        : [],
      withTests
        ? this.prisma.testAttempt.findMany({
            where: { userId, status: 'completed', completedAt: { not: null } },
            orderBy: { completedAt: 'desc' },
            take: ACTIVITY_LIMIT,
            select: { completedAt: true, test: { select: { id: true, title: true } } },
          })
        : [],
    ]);

    const list: Activity[] = [
      ...reads.map((r) => ({
        type: 'knowledge_read' as const,
        title: r.item.title,
        targetId: r.item.id,
        at: r.readAt,
      })),
      ...attempts.map((a) => ({
        type: 'test_completed' as const,
        title: a.test.title,
        targetId: a.test.id,
        at: a.completedAt as Date,
      })),
    ];
    return list.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, ACTIVITY_LIMIT);
  }

  // Глобальний TOP-10: середній з найкращих результатів обов'язкових тестів за поточний місяць
  async ranking(viewer: Actor) {
    const canOpen = await this.access.canOpen(viewer);
    const today = kyivDay();
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const rows = await this.prisma.testAttempt.findMany({
      where: {
        status: 'completed',
        scorePercent: { not: null },
        completedAt: { gte: monthStart },
        test: { isRequired: true },
        user: { status: 'active', roles: { some: { role: { name: SELLER_ROLE, archivedAt: null } } } },
      },
      select: {
        userId: true,
        testId: true,
        scorePercent: true,
        user: {
          select: {
            login: true,
            regionId: true,
            firstName: true,
            lastName: true,
            avatarKey: true,
            avatarUpdatedAt: true,
            store: { select: { name: true } },
          },
        },
      },
    });

    type Agg = { user: (typeof rows)[number]['user']; userId: string; best: Map<string, number> };
    const users = new Map<string, Agg>();
    for (const r of rows) {
      const agg = users.get(r.userId) ?? { user: r.user, userId: r.userId, best: new Map() };
      const score = r.scorePercent as number;
      agg.best.set(r.testId, Math.max(agg.best.get(r.testId) ?? 0, score));
      users.set(r.userId, agg);
    }

    const ranked = [...users.values()]
      .map((a) => {
        const scores = [...a.best.values()];
        return {
          userId: a.userId,
          user: a.user,
          tests: scores.length,
          percent: scores.reduce((s, v) => s + v, 0) / scores.length,
        };
      })
      .sort(
        (a, b) =>
          b.percent - a.percent ||
          b.tests - a.tests ||
          `${a.user.lastName} ${a.user.firstName}`.localeCompare(`${b.user.lastName} ${b.user.firstName}`, 'uk'),
      )
      .map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        name: `${r.user.firstName} ${r.user.lastName}`,
        store: r.user.store?.name ?? null,
        percent: Math.round(r.percent),
        login: r.user.login,
        avatarUrl: this.avatars.link({ id: r.userId, ...r.user }),
        isMe: r.userId === viewer.id,
        canOpen: canOpen({ id: r.userId, regionId: r.user.regionId, isSeller: true }),
      }));

    return {
      period: monthStart.toISOString().slice(0, 7),
      top: ranked.slice(0, TOP_LIMIT),
      me: ranked.find((r) => r.isMe && r.rank > TOP_LIMIT) ?? null,
    };
  }
}
