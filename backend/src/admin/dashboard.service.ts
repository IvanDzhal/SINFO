import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async get() {
    const [activeUsers, inactiveUsers, stores, regions, cities, brands, roles, recent] =
      await Promise.all([
        this.prisma.user.count({ where: { status: 'active' } }),
        this.prisma.user.count({ where: { status: 'inactive' } }),
        this.prisma.store.count({ where: { status: 'active' } }),
        this.prisma.region.count({ where: { status: 'active' } }),
        this.prisma.city.count({ where: { status: 'active' } }),
        this.prisma.brandFormat.count({ where: { status: 'active' } }),
        this.prisma.role.count({ where: { archivedAt: null } }),
        this.prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { actor: { select: { firstName: true, lastName: true } } },
        }),
      ]);

    return { activeUsers, inactiveUsers, stores, regions, cities, brands, roles, recent };
  }
}