import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AttemptsService } from './attempts.service';
import { computeStatus } from './status';
import { assignedUsersWhere } from './visibility';

const EVERY_MS = 10 * 60 * 1000;

@Injectable()
export class TestRemindersService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private attempts: AttemptsService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    const run = () => this.run().catch((e) => console.error('Test reminders failed', e));
    setTimeout(run, 30_000).unref();
    this.timer = setInterval(run, EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    // оцінюємо спроби, у яких вийшов час
    await this.attempts.finalizeAllExpired();

    const now = new Date();
    const horizon = new Date(now.getTime() + 72 * 3600_000);
    const tests = await this.prisma.test.findMany({
      where: { status: 'published', deadline: { gt: now, lte: horizon } },
      select: {
        id: true,
        title: true,
        deadline: true,
        maxAttempts: true,
        visibility: { select: { kind: true, targetId: true } },
      },
    });

    for (const t of tests) {
      if (!t.deadline) continue;
      const users = await this.prisma.user.findMany({
        where: assignedUsersWhere(t.visibility),
        select: { id: true },
      });
      if (users.length === 0) continue;

      const attempts = await this.prisma.testAttempt.findMany({
        where: { testId: t.id, userId: { in: users.map((u) => u.id) } },
        select: { userId: true, status: true, passed: true },
      });

      // нагадуємо лише тим, хто ще може пройти тест
      const pending = users.filter((u) => {
        const status = computeStatus(
          t,
          attempts.filter((a) => a.userId === u.id),
          now,
        );
        return status === 'not_started' || status === 'in_progress';
      });

      const last = (t.deadline.getTime() - now.getTime()) / 3600_000 <= 24;
      await this.notifications.notifyUsers(
        pending.map((u) => u.id),
        {
          kind: last ? 'test_deadline_last' : 'test_deadline_soon',
          title: last
            ? `Термін проходження закінчується: ${t.title}`
            : `Наближається дедлайн: ${t.title}`,
          body: last ? 'Залишилось менше доби' : 'Залишилось менше 3 днів',
          link: `/testing/${t.id}`,
          itemId: t.id,
        },
      );
    }
  }
}