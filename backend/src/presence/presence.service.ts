import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarService } from '../profile/avatar.service';
import { ProfileAccessService, SELLER_ROLE } from '../profile/profile-access.service';
import type { Actor } from '../knowledge/helpers';
import { kyivDay } from './day.util';

@Injectable()
export class PresenceService {
  // Останній записаний день активності по користувачу, щоб не писати в БД на кожен ping
  private lastDay = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private avatars: AvatarService,
    private access: ProfileAccessService,
  ) {}

  async heartbeat(userId: string) {
    const now = new Date();
    const day = kyivDay(now);
    if (this.lastDay.get(userId) !== day.getTime()) {
      await this.prisma.userActivityDay.upsert({
        where: { userId_day: { userId, day } },
        update: {},
        create: { userId, day },
      });
      this.lastDay.set(userId, day.getTime());
    }
    return this.prisma.userPresence.upsert({
      where: { userId },
      update: { lastActivityAt: now },
      create: { userId, lastActivityAt: now },
    });
  }

  async online(viewer: Actor) {
    const canOpen = await this.access.canOpen(viewer);
    const since = new Date(Date.now() - 90_000);
    const rows = await this.prisma.userPresence.findMany({
      where: { lastActivityAt: { gte: since }, user: { status: 'active' } },
      orderBy: { lastActivityAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            login: true,
            regionId: true,
            roles: { select: { role: { select: { name: true, archivedAt: true } } } },
            firstName: true,
            lastName: true,
            avatarKey: true,
            avatarUpdatedAt: true,
            store: { select: { name: true } },
            region: { select: { name: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.user.id,
      login: r.user.login,
      canOpen: canOpen({
        id: r.user.id,
        regionId: r.user.regionId,
        isSeller: r.user.roles.some((x) => x.role.name === SELLER_ROLE && !x.role.archivedAt),
      }),
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      avatarUrl: this.avatars.link(r.user),
      store: r.user.store?.name ?? null,
      region: r.user.region?.name ?? null,
    }));
  }
}
