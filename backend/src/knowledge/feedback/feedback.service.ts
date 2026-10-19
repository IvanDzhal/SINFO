import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { Actor, authorWhere, scopesFor } from '../helpers';
import { ItemsService } from '../items/items.service';

export const FEEDBACK_KINDS = ['outdated', 'error', 'unclear', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

@Injectable()
export class FeedbackService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private items: ItemsService,
  ) {}

  // Читач залишає відгук до статті; повторний відгук того ж виду оновлює попередній
  async create(user: Actor, itemId: string, kind: string, comment: string) {
    if (!(FEEDBACK_KINDS as readonly string[]).includes(kind)) {
      throw new BadRequestException('Невідомий вид відгуку');
    }
    const text = (comment ?? '').trim().slice(0, 1000);
    if (kind === 'other' && text.length < 3) {
      throw new BadRequestException('Опишіть, що не так');
    }
    if (!(await this.items.canAccess(user, itemId))) {
      throw new NotFoundException('Матеріал не знайдено');
    }
    const item = await this.prisma.knowledgeItem.findUnique({
      where: { id: itemId },
      select: { id: true, slug: true, title: true, authorId: true },
    });
    if (!item) throw new NotFoundException('Матеріал не знайдено');

    const open = await this.prisma.knowledgeFeedback.findFirst({
      where: { itemId, userId: user.id, kind, status: 'open' },
    });
    const row = open
      ? await this.prisma.knowledgeFeedback.update({
          where: { id: open.id },
          data: { comment: text },
        })
      : await this.prisma.knowledgeFeedback.create({
          data: { itemId, userId: user.id, kind, comment: text },
        });

    if (!open && item.authorId !== user.id) {
      await this.notifications
        .notifyUsers([item.authorId], {
          kind: 'feedback',
          title: `Відгук до матеріалу: ${item.title}`,
          body: text,
          link: `/knowledge/${item.slug ?? item.id}`,
          itemId: row.id,
        })
        .catch(() => 0);
    }
    return { ok: true };
  }

  async list(user: Actor, status: string) {
    const scopes = await scopesFor(this.prisma, user.id, 'knowledge.edit');
    const rows = await this.prisma.knowledgeFeedback.findMany({
      where: {
        status: status === 'resolved' ? 'resolved' : 'open',
        item: authorWhere(scopes, user),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        item: { select: { id: true, slug: true, title: true, type: true } },
        user: { select: { firstName: true, lastName: true, login: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      comment: r.comment,
      status: r.status,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      item: r.item,
      author: `${r.user.firstName} ${r.user.lastName}`,
      login: r.user.login,
    }));
  }

  async setStatus(user: Actor, id: string, resolved: boolean) {
    const scopes = await scopesFor(this.prisma, user.id, 'knowledge.edit');
    const row = await this.prisma.knowledgeFeedback.findFirst({
      where: { id, item: authorWhere(scopes, user) },
      select: { id: true, itemId: true },
    });
    if (!row) throw new NotFoundException('Відгук не знайдено');
    await this.prisma.knowledgeFeedback.update({
      where: { id },
      data: resolved
        ? { status: 'resolved', resolvedAt: new Date(), resolvedById: user.id }
        : { status: 'open', resolvedAt: null, resolvedById: null },
    });
    await this.audit.log(
      user.id,
      resolved ? 'feedback.resolved' : 'feedback.reopened',
      'KnowledgeFeedback',
      id,
    );
    return { ok: true };
  }

  async openCount(user: Actor) {
    const scopes = await scopesFor(this.prisma, user.id, 'knowledge.edit');
    return {
      count: await this.prisma.knowledgeFeedback.count({
        where: { status: 'open', item: authorWhere(scopes, user) },
      }),
    };
  }
}
