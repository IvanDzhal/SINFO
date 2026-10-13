import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, scopesFor } from '../knowledge/helpers';
import { AttemptsService } from './attempts.service';
import { describeAnswer, describeCorrect } from './grading';
import { computeStatus, MyStatus } from './status';
import { assignedUsersWhere, userScopeWhere } from './visibility';

type Filters = { testId?: string; storeId?: string; regionId?: string; search?: string };

type UserInfo = {
  id: string;
  firstName: string;
  lastName: string;
  login: string;
  regionId: string | null;
  storeId: string | null;
  region: { name: string } | null;
  store: { name: string; city: { name: string } } | null;
};

type Row = { testId: string; user: UserInfo; status: MyStatus; best: number | null };

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  login: true,
  regionId: true,
  storeId: true,
  region: { select: { name: true } },
  store: { select: { name: true, city: { select: { name: true } } } },
} satisfies Prisma.UserSelect;

const TEST_SELECT = {
  id: true,
  title: true,
  isRequired: true,
  deadline: true,
  maxAttempts: true,
  passingScorePercent: true,
  visibility: { select: { kind: true, targetId: true } },
} satisfies Prisma.TestSelect;

function summarize(rows: { status: MyStatus; best: number | null }[]) {
  const count = (s: MyStatus) => rows.filter((r) => r.status === s).length;
  let sum = 0;
  let scored = 0;
  for (const r of rows) {
    if (r.best !== null) {
      sum += r.best;
      scored += 1;
    }
  }
  return {
    assigned: rows.length,
    passed: count('passed'),
    failed: count('failed'),
    inProgress: count('in_progress'),
    notStarted: count('not_started'),
    overdue: count('overdue'),
    average: scored > 0 ? Math.round((sum / scored) * 10) / 10 : null,
  };
}

function group(rows: Row[], key: (r: Row) => string) {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

const seconds = (from: Date, to: Date) =>
  Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService, private attempts: AttemptsService) {}

  // Усі призначення (тест × працівник) у межах доступу керівника
  private async load(viewer: Actor, f: Filters) {
    const scopes = await scopesFor(this.prisma, viewer.id, 'testing.view_analytics');
    const scopeWhere = userScopeWhere(scopes, viewer);
    await this.attempts.finalizeAllExpired();

    const tests = await this.prisma.test.findMany({
      where: { status: 'published', ...(f.testId ? { id: f.testId } : {}) },
      orderBy: { createdAt: 'desc' },
      select: TEST_SELECT,
    });

    const search = f.search?.trim();
    const extra: Prisma.UserWhereInput = {
      ...(f.storeId ? { storeId: f.storeId } : {}),
      ...(f.regionId ? { regionId: f.regionId } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { login: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const now = new Date();
    const rows: Row[] = [];
    const times = new Map<string, number[]>();

    for (const t of tests) {
      const users: UserInfo[] = await this.prisma.user.findMany({
        where: { AND: [assignedUsersWhere(t.visibility), scopeWhere, extra] },
        select: USER_SELECT,
      });
      if (users.length === 0) continue;

      const attempts = await this.prisma.testAttempt.findMany({
        where: { testId: t.id, userId: { in: users.map((u) => u.id) } },
        select: {
          userId: true,
          status: true,
          passed: true,
          scorePercent: true,
          startedAt: true,
          completedAt: true,
        },
      });

      const secs: number[] = [];
      for (const a of attempts) {
        if (a.status === 'completed' && a.completedAt) {
          secs.push(seconds(a.startedAt, a.completedAt));
        }
      }
      times.set(t.id, secs);

      for (const u of users) {
        const mine = attempts.filter((a) => a.userId === u.id);
        const scored = mine
          .filter((a) => a.status === 'completed' && a.scorePercent !== null)
          .map((a) => a.scorePercent as number);
        rows.push({
          testId: t.id,
          user: u,
          status: computeStatus(t, mine, now),
          best: scored.length > 0 ? Math.max(...scored) : null,
        });
      }
    }
    return { tests, rows, times };
  }

  async summary(viewer: Actor, f: Filters) {
    const { rows } = await this.load(viewer, f);
    return summarize(rows);
  }

  async tests(viewer: Actor) {
    const { tests, rows, times } = await this.load(viewer, {});
    return tests.map((t) => {
      const secs = times.get(t.id) ?? [];
      return {
        id: t.id,
        title: t.title,
        isRequired: t.isRequired,
        deadline: t.deadline,
        ...summarize(rows.filter((r) => r.testId === t.id)),
        avgTimeSec:
          secs.length > 0 ? Math.round(secs.reduce((a, b) => a + b, 0) / secs.length) : null,
      };
    });
  }

  async stores(viewer: Actor, f: Filters) {
    const { rows } = await this.load(viewer, { testId: f.testId, regionId: f.regionId });
    return [...group(rows, (r) => r.user.storeId ?? 'none').entries()]
      .map(([key, list]) => {
        const u = list[0].user;
        return {
          key,
          storeId: u.storeId,
          name: u.store?.name ?? 'Без магазину',
          city: u.store?.city.name ?? null,
          region: u.region?.name ?? null,
          ...summarize(list),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  }

  async regions(viewer: Actor, f: Filters) {
    const { rows } = await this.load(viewer, { testId: f.testId });
    return [...group(rows, (r) => r.user.regionId ?? 'none').entries()]
      .map(([key, list]) => {
        const u = list[0].user;
        return {
          key,
          regionId: u.regionId,
          name: u.region?.name ?? 'Без області',
          ...summarize(list),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  }

  async users(viewer: Actor, f: Filters) {
    const { rows } = await this.load(viewer, f);
    return [...group(rows, (r) => r.user.id).entries()]
      .map(([id, list]) => {
        const u = list[0].user;
        const single = f.testId ? list[0] : null;
        return {
          id,
          name: `${u.firstName} ${u.lastName}`,
          login: u.login,
          store: u.store?.name ?? null,
          region: u.region?.name ?? null,
          ...summarize(list),
          status: single ? single.status : null,
          best: single ? single.best : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  }

  async questions(viewer: Actor, testId: string) {
    if (!testId || testId === '_') return [];
    const scopes = await scopesFor(this.prisma, viewer.id, 'testing.view_analytics');
    const scopeWhere = userScopeWhere(scopes, viewer);

    const test = await this.prisma.test.findUnique({ where: { id: testId }, select: { id: true } });
    if (!test) throw new NotFoundException('Тест не знайдено');

    const [questions, answers] = await Promise.all([
      this.prisma.testQuestion.findMany({
        where: { testId },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: { id: true, type: true, text: true, points: true, archivedAt: true },
      }),
      this.prisma.testAnswer.findMany({
        where: {
          isCorrect: { not: null },
          attempt: { testId, status: 'completed', user: scopeWhere },
        },
        select: { questionId: true, isCorrect: true },
      }),
    ]);

    const stat = new Map<string, { total: number; correct: number }>();
    for (const a of answers) {
      const s = stat.get(a.questionId) ?? { total: 0, correct: 0 };
      s.total += 1;
      if (a.isCorrect) s.correct += 1;
      stat.set(a.questionId, s);
    }

    let n = 0;
    return questions.map((q) => {
      const s = stat.get(q.id) ?? { total: 0, correct: 0 };
      const archived = !!q.archivedAt;
      if (!archived) n += 1;
      const pct = s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : null;
      return {
        id: q.id,
        number: archived ? null : n,
        type: q.type,
        text: q.text,
        points: q.points,
        archived,
        answered: s.total,
        correctPercent: pct,
        wrongPercent: pct === null ? null : Math.round((100 - pct) * 10) / 10,
        problem: s.total >= 5 && pct !== null && pct < 50,
      };
    });
  }

  // Результати і історія спроб одного працівника
  async userResults(viewer: Actor, userId: string) {
    const scopes = await scopesFor(this.prisma, viewer.id, 'testing.view_attempts');
    const user = await this.prisma.user.findFirst({
      where: { AND: [{ id: userId }, userScopeWhere(scopes, viewer)] },
      select: USER_SELECT,
    });
    if (!user) throw new ForbiddenException('Немає доступу до цього користувача');
    await this.attempts.finalizeExpired(userId);

    const attempts = await this.prisma.testAttempt.findMany({
      where: { userId },
      orderBy: [{ testId: 'asc' }, { attemptNumber: 'asc' }],
      select: {
        id: true,
        testId: true,
        attemptNumber: true,
        status: true,
        startedAt: true,
        completedAt: true,
        timedOut: true,
        score: true,
        maxScore: true,
        scorePercent: true,
        passed: true,
      },
    });

    const published = await this.prisma.test.findMany({
      where: { status: 'published' },
      select: TEST_SELECT,
    });
    const assigned: string[] = [];
    for (const t of published) {
      const n = await this.prisma.user.count({
        where: { AND: [{ id: userId }, assignedUsersWhere(t.visibility)] },
      });
      if (n > 0) assigned.push(t.id);
    }

    const ids = [...new Set([...assigned, ...attempts.map((a) => a.testId)])];
    const tests = await this.prisma.test.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: 'desc' },
      select: TEST_SELECT,
    });

    const now = new Date();
    return {
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        login: user.login,
        store: user.store?.name ?? null,
        region: user.region?.name ?? null,
      },
      tests: tests.map((t) => {
        const mine = attempts.filter((a) => a.testId === t.id);
        const scored = mine
          .filter((a) => a.status === 'completed' && a.scorePercent !== null)
          .map((a) => a.scorePercent as number);
        return {
          test: {
            id: t.id,
            title: t.title,
            isRequired: t.isRequired,
            deadline: t.deadline,
            passingScorePercent: t.passingScorePercent,
          },
          status: computeStatus(t, mine, now),
          best: scored.length > 0 ? Math.max(...scored) : null,
          attempts: mine.map((a) => ({
            id: a.id,
            attemptNumber: a.attemptNumber,
            status: a.status,
            startedAt: a.startedAt,
            completedAt: a.completedAt,
            timedOut: a.timedOut,
            score: a.score,
            maxScore: a.maxScore,
            scorePercent: a.scorePercent,
            passed: a.passed,
            timeSec: a.completedAt ? seconds(a.startedAt, a.completedAt) : null,
          })),
        };
      }),
    };
  }

  // Відповіді конкретної спроби (разом з правильними) для керівника
  async attemptAnswers(viewer: Actor, attemptId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: { select: { title: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!attempt) throw new NotFoundException('Спробу не знайдено');

    const scopes = await scopesFor(this.prisma, viewer.id, 'testing.view_answers');
    const allowed = await this.prisma.user.findFirst({
      where: { AND: [{ id: attempt.userId }, userScopeWhere(scopes, viewer)] },
      select: { id: true },
    });
    if (!allowed) throw new ForbiddenException('Немає доступу до відповідей цього користувача');
    if (attempt.status !== 'completed') throw new BadRequestException('Спробу ще не завершено');

    const rows = await this.prisma.testAnswer.findMany({
      where: { attemptId },
      include: { question: { include: { options: true } } },
    });
    const byQuestion = new Map(rows.map((r) => [r.questionId, r]));

    const items = attempt.questionIds.flatMap((qid) => {
      const r = byQuestion.get(qid);
      if (!r) return [];
      const q = r.question;
      return [
        {
          questionId: qid,
          type: q.type,
          text: q.text,
          points: q.points,
          score: r.score ?? 0,
          isCorrect: !!r.isCorrect,
          explanation: q.explanation,
          userAnswer: describeAnswer(q, attemptId, r.answer),
          correctAnswer: describeCorrect(q),
        },
      ];
    });

    return {
      attempt: {
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        score: attempt.score,
        maxScore: attempt.maxScore,
        scorePercent: attempt.scorePercent,
        passed: attempt.passed,
        userName: `${attempt.user.firstName} ${attempt.user.lastName}`,
        testTitle: attempt.test.title,
      },
      items,
    };
  }
}