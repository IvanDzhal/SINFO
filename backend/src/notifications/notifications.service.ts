import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

type Rule = { kind: string; targetId: string | null };

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService, private push: PushService) {}

  async list(userId: string) {
    const [unread, items] = await Promise.all([
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { unread, items };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  // Сповіщення для всіх, хто бачить матеріал за правилами видимості
  async notifyItem(
    item: { id: string; slug: string | null; type: string; title: string; description: string },
    rules: Rule[],
    actorId: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: this.recipientsWhere(rules, actorId),
      select: { id: true },
    });
    if (users.length === 0) return 0;

    const link = `/knowledge/${item.slug ?? item.id}`;
    const res = await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        kind: item.type,
        title: item.title,
        body: item.description,
        link,
        itemId: item.id,
      })),
      skipDuplicates: true,
    });
    this.push.sendToUsers(
      users.map((u) => u.id),
      { title: item.title, body: item.description, link },
    );
    return res.count;
  }

  // Та сама логіка, що й у видимості: групи через «і», всередині групи через «або»
  private recipientsWhere(rules: Rule[], actorId: string): Prisma.UserWhereInput {
    const and: Prisma.UserWhereInput[] = [
      { status: 'active' },
      { id: { not: actorId } },
      {
        roles: {
          some: {
            role: {
              archivedAt: null,
              permissions: { some: { permission: { code: 'knowledge.view' } } },
            },
          },
        },
      },
    ];

    const everyone = rules.length === 0 || rules.some((r) => r.kind === 'GLOBAL');
    if (!everyone) {
      const ids = (kind: string) =>
        rules.filter((r) => r.kind === kind && r.targetId).map((r) => r.targetId as string);
      const regions = ids('REGION');
      const stores = ids('STORE');
      const brands = ids('BRAND');
      const roles = ids('ROLE');

      const place: Prisma.UserWhereInput[] = [];
      if (regions.length) {
        place.push(
          { regionId: { in: regions } },
          { managedRegions: { some: { regionId: { in: regions } } } },
        );
      }
      if (stores.length) place.push({ storeId: { in: stores } });
      if (place.length) and.push({ OR: place });
      if (brands.length) and.push({ store: { brandFormatId: { in: brands } } });
      if (roles.length) {
        and.push({ roles: { some: { roleId: { in: roles }, role: { archivedAt: null } } } });
      }
    }
    return { AND: and };
  }

  // Сповіщення вказаним користувачам (дублі за користувач + сутність + тип пропускаються)
  async notifyUsers(
    userIds: string[],
    n: { kind: string; title: string; body?: string; link: string; itemId: string },
  ) {
    if (userIds.length === 0) return 0;
    const res = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        kind: n.kind,
        title: n.title,
        body: n.body ?? '',
        link: n.link,
        itemId: n.itemId,
      })),
      skipDuplicates: true,
    });
    this.push.sendToUsers(userIds, { title: n.title, body: n.body, link: n.link });
    return res.count;
  }
}