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
  }) {
    return this.prisma.auditLog.findMany({
      where: {
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
      take: 200,
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