import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, regionIdsOf } from '../knowledge/helpers';

export const SELLER_ROLE = 'Продавець';
const GLOBAL_ROLES = ['CEO', 'Адмін'];
const REGION_ROLE = 'Регіональний менеджер';

// self — лише власний профіль; region — продавці своїх областей; global — усі
export type Level = 'self' | 'region' | 'global';

export type Target = { id: string; regionId: string | null; isSeller: boolean };

@Injectable()
export class ProfileAccessService {
  constructor(private prisma: PrismaService) {}

  async level(userId: string): Promise<Level> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId, role: { archivedAt: null } },
      select: { role: { select: { name: true } } },
    });
    const names = roles.map((r) => r.role.name);
    if (names.some((n) => GLOBAL_ROLES.includes(n))) return 'global';
    if (names.includes(REGION_ROLE)) return 'region';
    return 'self';
  }

  // Предикат «чи може глядач відкрити профіль цього користувача»
  async canOpen(viewer: Actor): Promise<(t: Target) => boolean> {
    const level = await this.level(viewer.id);
    const regions = regionIdsOf(viewer);
    return (t) =>
      t.id === viewer.id ||
      level === 'global' ||
      (level === 'region' && t.isSeller && !!t.regionId && regions.includes(t.regionId));
  }
}
