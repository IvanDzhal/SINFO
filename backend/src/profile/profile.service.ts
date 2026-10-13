import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Scope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, scopesFor } from '../knowledge/helpers';
import { ItemsService } from '../knowledge/items/items.service';
import { AttemptsService } from '../testing/attempts.service';
import { userScopeWhere } from '../testing/visibility';
import { addDays, kyivDay } from '../presence/day.util';
import { AvatarService } from './avatar.service';

const SELLER_ROLE = 'Продавець';
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
  ) {}

  // Чи потрапляє цільовий користувач у scope перегляду глядача за правом `code`
  private async inScope(viewer: Actor, targetId: string, code: string) {
    const scopes: Scope[] = await scopesFor(this.prisma, viewer.id, code);
    if (scopes.length === 0) return false;
    const found = await this.prisma.user.findFirst({
      where: { AND: [{ id: targetId }, userScopeWhere(scopes, viewer)] },
      select: { id: true },
    });
    return !!found;
  }

  async get(viewer: Actor, targetId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
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
    const [canKnowledge, canTests] = self
      ? [true, true]
      : await Promise.all([
          this.inScope(viewer, target.id, 'knowledge.view_read_status'),
          this.inScope(viewer, target.id, 'testing.view_attempts'),
        ]);
    if (!canKnowledge && !canTests) throw new ForbiddenException('Немає доступу до цього профілю');

    const roleNames = target.roles.map((r) => r.role.name);
    const isSeller = roleNames.includes(SELLER_ROLE);
    const actor: Actor = {
      id: target.id,
      regionId: target.regionId,
      storeId: target.storeId,
      managedRegionIds: target.managedRegions.map((m) => m.regionId),
    };

    const showPresence = (await scopesFor(this.prisma, viewer.id, 'analytics.online_status.view')).includes(
      'GLOBAL',
    );

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
      lastActivityAt: showPresence ? (target.presence?.lastActivityAt ?? null) : undefined,
    };

    const [knowledge, tests, activeDays, activity] = await Promise.all([
      canKnowledge ? this.knowledge(actor) : null,
      canTests ? this.tests(target.id) : null,
      this.activeDays(target.id),
      // Активність РМ/Admin показуємо лише власнику
      self || isSeller ? this.activity(target.id, canKnowledge, canTests) : null,
    ]);

    return {
      user: header,
      isSelf: self,
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

  private async knowledge(actor: Actor) {
    const visible = await this.items.visibleWhere(actor);
    const base = { AND: [visible, { type: 'instruction' as const }] };
    const [total, read, last] = await Promise.all([
      this.prisma.knowledgeItem.count({ where: base }),
      this.prisma.knowledgeItem.count({
        where: { AND: [base, { reads: { some: { userId: actor.id } } }] },
      }),
      this.prisma.knowledgeRead.findFirst({
        where: { userId: actor.id, item: base },
        orderBy: { readAt: 'desc' },
        select: { readAt: true, item: { select: { id: true, title: true } } },
      }),
    ]);
    return {
      read,
      total,
      percent: total > 0 ? Math.round((read / total) * 100) : 0,
      last: last ? { id: last.item.id, title: last.item.title, readAt: last.readAt } : null,
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
        test: { select: { title: true, passingScorePercent: true } },
      },
    });

    const byTest = new Map<
      string,
      { testId: string; title: string; best: number; passingScorePercent: number; attempts: number; lastAt: Date | null }
    >();
    for (const r of rows) {
      const score = r.scorePercent as number;
      const cur = byTest.get(r.testId);
      if (!cur) {
        byTest.set(r.testId, {
          testId: r.testId,
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
  async ranking(viewerId: string) {
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
        avatarUrl: this.avatars.link({ id: r.userId, ...r.user }),
        isMe: r.userId === viewerId,
      }));

    return {
      period: monthStart.toISOString().slice(0, 7),
      top: ranked.slice(0, TOP_LIMIT),
      me: ranked.find((r) => r.isMe && r.rank > TOP_LIMIT) ?? null,
    };
  }
}
