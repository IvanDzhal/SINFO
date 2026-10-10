import { Injectable } from '@nestjs/common';
import { KnowledgeType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Viewer = {
  id: string;
  regionId: string | null;
  storeId: string | null;
  managedRegionIds?: string[];
};

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  // Умова видимості: що саме цей користувач має право бачити
  private async visibleWhere(user: Viewer): Promise<Prisma.KnowledgeItemWhereInput> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId: user.id, role: { archivedAt: null } },
      select: { roleId: true },
    });
    const roleIds = roles.map((r) => r.roleId);
    const regionIds = [user.regionId, ...(user.managedRegionIds ?? [])].filter(
      (x): x is string => !!x,
    );

    const or: Prisma.KnowledgeItemWhereInput[] = [
      { visibility: { none: {} } },
      { visibility: { some: { kind: 'GLOBAL' } } },
    ];
    if (regionIds.length) {
      or.push({ visibility: { some: { kind: 'REGION', targetId: { in: regionIds } } } });
    }
    if (user.storeId) {
      or.push({ visibility: { some: { kind: 'STORE', targetId: user.storeId } } });
    }
    if (roleIds.length) {
      or.push({ visibility: { some: { kind: 'ROLE', targetId: { in: roleIds } } } });
    }
    return { status: 'published', OR: or };
  }

  async list(user: Viewer, type: KnowledgeType) {
    const where = await this.visibleWhere(user);
    const items = await this.prisma.knowledgeItem.findMany({
      where: { ...where, type },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        readingTimeMinutes: true,
        isRequired: true,
        updatedAt: true,
        category: { select: { id: true, name: true, icon: true, parentId: true } },
        reads: { where: { userId: user.id }, select: { id: true } },
      },
    });
    return items.map(({ reads, ...rest }) => ({ ...rest, isRead: reads.length > 0 }));
  }

  async latest(user: Viewer, limit: number) {
    const where = await this.visibleWhere(user);
    return this.prisma.knowledgeItem.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: Math.min(Math.max(limit || 6, 1), 20),
      select: {
        id: true,
        type: true,
        title: true,
        isRequired: true,
        publishedAt: true,
        author: { select: { firstName: true, lastName: true } },
      },
    });
  }
}