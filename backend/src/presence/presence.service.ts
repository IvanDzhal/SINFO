import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PresenceService {
  constructor(private prisma: PrismaService) {}

  heartbeat(userId: string) {
    const now = new Date();
    return this.prisma.userPresence.upsert({
      where: { userId },
      update: { lastActivityAt: now },
      create: { userId, lastActivityAt: now },
    });
  }

  async online() {
    const since = new Date(Date.now() - 90_000);
    const rows = await this.prisma.userPresence.findMany({
      where: { lastActivityAt: { gte: since }, user: { status: 'active' } },
      orderBy: { lastActivityAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            store: { select: { name: true } },
            region: { select: { name: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.user.id,
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      store: r.user.store?.name ?? null,
      region: r.user.region?.name ?? null,
    }));
  }
}