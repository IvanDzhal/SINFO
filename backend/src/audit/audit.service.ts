import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  list(filters: {
    actorId?: string;
    action?: string;
    entityType?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    offset?: string;
    limit?: string;
  }) {
    const search = filters.search?.trim();
    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const offset = Math.max(Number(filters.offset) || 0, 0);
    return this.prisma.auditLog.findMany({
      where: {
        actor: search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { login: { contains: search, mode: 'insensitive' } },
              ],
            }
          : undefined,
        actorId: filters.actorId,
        action: filters.action ? { contains: filters.action } : undefined,
        entityType: filters.entityType,
        createdAt:
          filters.dateFrom || filters.dateTo
            ? {
                gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
                lte: filters.dateTo ? new Date(filters.dateTo) : undefined,
              }
            : undefined,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: { actor: { select: { login: true, firstName: true, lastName: true } } },
    });
  }

  log(
    actorId: string | null,
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        details: details as Prisma.InputJsonValue | undefined,
      },
    });
  }
}