import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuestionType } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, scopesFor } from '../knowledge/helpers';
import { normalizeAnswer, pointsFor, pickRandom, rightToken, seededShuffle } from './grading';
import { computeStatus } from './status';
import { parseAccepted, toQuestionData, validateQuestion } from './validation';
import { testVisibleWhere } from './visibility';
import { NotificationsService } from '../notifications/notifications.service';
import { notifyIfCompleted, testGate } from '../training/progress';

@Injectable()
export class AttemptsService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  // Додає до списку тестів статус користувача, спроби й найкращий результат
  async decorate<T extends { id: string; deadline: Date | null; maxAttempts: number }>(
    user: Actor,
    tests: T[],
  ) {
    if (tests.length === 0) return [];
    await this.finalizeExpired(user.id);

    const attempts = await this.prisma.testAttempt.findMany({
      where: { userId: user.id, testId: { in: tests.map((t) => t.id) } },
      select: { id: true, testId: true, status: true, passed: true, scorePercent: true },
    });
    const now = new Date();

    return tests.map((t) => {
      const mine = attempts.filter((a) => a.testId === t.id);
      const done = mine.filter((a) => a.status === 'completed');
      const running = mine.find((a) => a.status === 'in_progress');
      const best = done.reduce<number | null>(
        (m, a) => (a.scorePercent !== null && (m === null || a.scorePercent > m) ? a.scorePercent : m),
        null,
      );
      return {
        ...t,
        myStatus: computeStatus(t, mine, now),
        attemptsUsed: mine.length,
        bestPercent: best,
        inProgressAttemptId: running?.id ?? null,
      };
    });
  }

  async detail(user: Actor, testId: string) {
    const visible = await testVisibleWhere(this.prisma, user);
    const test = await this.prisma.test.findFirst({
      where: { AND: [{ id: testId }, visible] },
      include: {
        category: { select: { id: true, name: true, icon: true } },
        linkedItem: { select: { id: true, slug: true, title: true } },
      },
    });
    if (!test) throw new NotFoundException('Тест не знайдено');
    await this.finalizeExpired(user.id);

    const attempts = await this.prisma.testAttempt.findMany({
      where: { testId, userId: user.id },
      orderBy: { attemptNumber: 'asc' },
      select: {
        id: true,
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
    const myStatus = computeStatus(test, attempts, new Date());
    const running = attempts.find((a) => a.status === 'in_progress');
    const mayStart = (await scopesFor(this.prisma, user.id, 'testing.start')).length > 0;

    let blockedReason: string | null = null;
    if (!running) {
      if (!mayStart) blockedReason = 'У вас немає права проходити тести';
      else if (test.maxAttempts > 0 && attempts.length >= test.maxAttempts) {
        blockedReason = 'Усі спроби вичерпано';
      } else if (test.deadline && test.deadline <= new Date()) {
        blockedReason = 'Термін проходження минув';
      }
      else {
        const gate = await testGate(this.prisma, user.id, testId);
        if (gate && !gate.ok) blockedReason = gate.reason;
      }
    }

    return {
      id: test.id,
      slug: test.slug,
      title: test.title,
      description: test.description,
      isRequired: test.isRequired,
      deadline: test.deadline,
      questionCount: test.questionCount,
      timeLimitMinutes: test.timeLimitMinutes,
      passingScorePercent: test.passingScorePercent,
      maxAttempts: test.maxAttempts,
      category: test.category,
      linkedItem: test.linkedItem,
      myStatus,
      attempts,
      inProgressAttemptId: running?.id ?? null,
      canStart: !running && blockedReason === null,
      blockedReason,
    };
  }

  async start(user: Actor, testId: string) {
    const visible = await testVisibleWhere(this.prisma, user);
    const test = await this.prisma.test.findFirst({ where: { AND: [{ id: testId }, visible] } });
    if (!test) throw new NotFoundException('Тест не знайдено');
    await this.finalizeExpired(user.id);

    const gate = await testGate(this.prisma, user.id, testId);
    if (gate && !gate.ok) throw new BadRequestException(gate.reason);

    const now = new Date();
    if (test.deadline && test.deadline <= now) {
      throw new BadRequestException('Термін проходження цього тесту минув');
    }

    const attempts = await this.prisma.testAttempt.findMany({
      where: { testId, userId: user.id },
      select: { id: true, status: true, passed: true },
    });
    const running = attempts.find((a) => a.status === 'in_progress');
    if (running) return { attemptId: running.id };
    if (test.maxAttempts > 0 && attempts.length >= test.maxAttempts) {
      throw new BadRequestException('Усі спроби вичерпано');
    }

    const rows = await this.prisma.testQuestion.findMany({
      where: { testId, archivedAt: null },
      include: { options: true },
    });
    const pool = rows.filter((q) => validateQuestion(toQuestionData(q)).length === 0);
    if (pool.length < test.questionCount) {
      throw new BadRequestException('Тест тимчасово недоступний: недостатньо питань');
    }

    const chosen = pickRandom(pool, test.questionCount);
    const maxScore = chosen.reduce((sum, q) => sum + q.points, 0);
    const limitEnd = now.getTime() + test.timeLimitMinutes * 60_000;
    const expiresAt = new Date(
      test.deadline ? Math.min(limitEnd, test.deadline.getTime()) : limitEnd,
    );

    try {
      const attempt = await this.prisma.testAttempt.create({
        data: {
          testId,
          userId: user.id,
          attemptNumber: (await this.nextNumber(testId, user.id)),
          expiresAt,
          questionIds: chosen.map((q) => q.id),
          seed: randomInt(1, 2_000_000_000),
          maxScore,
        },
      });
      return { attemptId: attempt.id };
    } catch (err) {
      // подвійний клік по «Почати»: повертаємо вже створену спробу
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await this.prisma.testAttempt.findFirst({
          where: { testId, userId: user.id, status: 'in_progress' },
        });
        if (again) return { attemptId: again.id };
      }
      throw err;
    }
  }

  async get(user: Actor, attemptId: string) {
    let attempt = await this.loadOwn(user, attemptId);
    if (attempt.status === 'in_progress' && attempt.expiresAt <= new Date()) {
      await this.finalizeById(attempt.id, true);
      attempt = await this.loadOwn(user, attemptId);
    }

    if (attempt.status === 'completed') {
      const used = await this.prisma.testAttempt.count({
        where: { testId: attempt.testId, userId: user.id },
      });
      const end = attempt.completedAt ?? attempt.expiresAt;
      return {
        state: 'completed' as const,
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        test: attempt.test,
        score: attempt.score,
        maxScore: attempt.maxScore,
        scorePercent: attempt.scorePercent,
        passed: attempt.passed,
        timedOut: attempt.timedOut,
        timeSpentSec: Math.max(
          0,
          Math.round((end.getTime() - attempt.startedAt.getTime()) / 1000),
        ),
        attemptsUsed: used,
        attemptsAllowed: attempt.test.maxAttempts,
      };
    }

    const rows = await this.prisma.testQuestion.findMany({
      where: { id: { in: attempt.questionIds } },
      include: { options: true },
    });
    const byId = new Map(rows.map((q) => [q.id, q]));
    const questions = attempt.questionIds.flatMap((qid, idx) => {
      const q = byId.get(qid);
      return q ? [this.sanitize(q, idx, attempt.id, attempt.seed)] : [];
    });
    const answers: Record<string, unknown> = {};
    for (const a of attempt.answers) {
      if (a.answer !== null) answers[a.questionId] = a.answer;
    }

    return {
      state: 'in_progress' as const,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      test: { id: attempt.test.id, slug: attempt.test.slug, title: attempt.test.title },
      expiresAt: attempt.expiresAt,
      serverNow: new Date(),
      questions,
      answers,
    };
  }

  async saveAnswer(user: Actor, attemptId: string, questionId: string, answer: unknown) {
    const attempt = await this.loadOwn(user, attemptId);
    if (attempt.status !== 'in_progress') throw new BadRequestException('Спробу вже завершено');
    if (attempt.expiresAt <= new Date()) {
      await this.finalizeById(attempt.id, true);
      throw new BadRequestException('Час вичерпано, тест завершено');
    }
    if (!attempt.questionIds.includes(questionId)) {
      throw new BadRequestException('Це питання не належить цій спробі');
    }

    const q = await this.prisma.testQuestion.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!q) throw new NotFoundException('Питання не знайдено');

    const clean = normalizeAnswer(q, attempt.id, answer);
    if (clean === null) {
      await this.prisma.testAnswer.deleteMany({ where: { attemptId, questionId } });
    } else {
      await this.prisma.testAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        update: { answer: clean, answeredAt: new Date() },
        create: { attemptId, questionId, answer: clean },
      });
    }
    return { ok: true };
  }

  async finish(user: Actor, attemptId: string) {
    const attempt = await this.loadOwn(user, attemptId);
    if (attempt.status === 'in_progress') {
      await this.finalizeById(attemptId, attempt.expiresAt <= new Date());
    }
    return this.get(user, attemptId);
  }

  // Завершує всі прострочені спроби користувача (оцінює те, що встиг відповісти)
  async finalizeExpired(userId: string) {
    const expired = await this.prisma.testAttempt.findMany({
      where: { userId, status: 'in_progress', expiresAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const a of expired) await this.finalizeById(a.id, true);
  }

  // Оцінює спробу на сервері. Правильні відповіді нікуди не віддаються.
  async finalizeAllExpired() {
    const expired = await this.prisma.testAttempt.findMany({
      where: { status: 'in_progress', expiresAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const a of expired) await this.finalizeById(a.id, true);
  }

  // Оцінює спробу на сервері. Правильні відповіді нікуди не віддаються.
  async finalizeById(attemptId: string, timedOut: boolean) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: { select: { title: true, passingScorePercent: true } },
        answers: { select: { questionId: true, answer: true } },
      },
    });
    if (!attempt || attempt.status !== 'in_progress') return;

    const questions = await this.prisma.testQuestion.findMany({
      where: { id: { in: attempt.questionIds } },
      include: { options: true },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    const saved = new Map(attempt.answers.map((a) => [a.questionId, a.answer]));

    let score = 0;
    let maxScore = 0;
    const rows: {
      questionId: string;
      answer: Prisma.JsonValue | null;
      isCorrect: boolean;
      score: number;
    }[] = [];

    for (const qid of attempt.questionIds) {
      const q = byId.get(qid);
      if (!q) continue;
      const answer = saved.get(qid) ?? null;
      const points = answer === null ? 0 : pointsFor(q, attempt.id, answer);
      const correct = points === q.points;
      maxScore += q.points;
      score += points;
      rows.push({ questionId: qid, answer, isCorrect: correct, score: points });
    }

    const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const passed = maxScore > 0 && score * 100 >= attempt.test.passingScorePercent * maxScore;
    const completedAt = timedOut ? attempt.expiresAt : new Date();

    const done = { value: false };
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.testAttempt.updateMany({
        where: { id: attemptId, status: 'in_progress' },
        data: {
          status: 'completed',
          completedAt,
          timedOut,
          score,
          maxScore,
          scorePercent: Math.round(percent * 10) / 10,
          passed,
        },
      });
      if (res.count === 0) return; // вже завершено паралельним запитом
      done.value = true;

      for (const r of rows) {
        await tx.testAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: r.questionId } },
          update: { isCorrect: r.isCorrect, score: r.score },
          create: {
            attemptId,
            questionId: r.questionId,
            answer: r.answer === null ? undefined : (r.answer as Prisma.InputJsonValue),
            isCorrect: r.isCorrect,
            score: r.score,
          },
        });
      }
    });

    if (done.value) {
      await this.notifications
        .notifyUsers([attempt.userId], {
          kind: passed ? 'test_passed' : 'test_failed',
          title: passed
            ? `Тест пройдено: ${attempt.test.title}`
            : `Тест не пройдено: ${attempt.test.title}`,
          body: `Результат: ${Math.floor(percent)}%`,
          link: `/testing/attempt/${attemptId}`,
          itemId: attemptId,
        })
        .catch(() => 0);
      if (passed) await notifyIfCompleted(this.prisma, attempt.userId).catch(() => undefined);
    }
  }

  // ---------- допоміжне ----------

  // після видалення спроби в нумерації можуть бути прогалини, тому береться максимум + 1
  private async nextNumber(testId: string, userId: string) {
    const last = await this.prisma.testAttempt.aggregate({
      where: { testId, userId },
      _max: { attemptNumber: true },
    });
    return (last._max.attemptNumber ?? 0) + 1;
  }

  private async loadOwn(user: Actor, attemptId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          select: { id: true, slug: true, title: true, passingScorePercent: true, maxAttempts: true },
        },
        answers: { select: { questionId: true, answer: true } },
      },
    });
    if (!attempt || attempt.userId !== user.id) throw new NotFoundException('Спробу не знайдено');
    return attempt;
  }

  // Питання для користувача: без правильних відповідей і з перемішаними варіантами
  private sanitize(
    q: {
      id: string;
      type: QuestionType;
      text: string;
      points: number;
      accepted: unknown;
      options: { id: string; label: string; matchLabel: string | null; position: number }[];
    },
    idx: number,
    attemptId: string,
    seed: number,
  ) {
    const qSeed = seed + idx * 7919;
    const ordered = [...q.options].sort((a, b) => a.position - b.position);
    const base = { id: q.id, type: q.type, text: q.text, points: q.points };

    if (q.type === 'single' || q.type === 'multiple') {
      return {
        ...base,
        options: seededShuffle(ordered, qSeed).map((o) => ({ id: o.id, label: o.label })),
      };
    }
    if (q.type === 'matching') {
      return {
        ...base,
        left: seededShuffle(ordered, qSeed).map((o) => ({ id: o.id, label: o.label })),
        right: seededShuffle(ordered, qSeed ^ 0x5bd1e995).map((o) => ({
          id: rightToken(attemptId, o.id),
          label: o.matchLabel ?? '',
        })),
      };
    }
    return { ...base, inputKind: parseAccepted(q.accepted)?.kind ?? 'text' };
  }
}