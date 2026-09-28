import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Scope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('Недостатньо прав');

    const rows = await this.prisma.rolePermission.findMany({
      where: {
        role: { archivedAt: null, users: { some: { userId: user.id } } },
        permission: { code: { in: required } },
      },
      include: { permission: true },
    });

    const access: Record<string, Scope[]> = {};
    for (const r of rows) {
      (access[r.permission.code] ??= []).push(r.scope);
    }

    if (!required.every((code) => access[code]?.length)) {
      throw new ForbiddenException('Недостатньо прав');
    }

    req.access = access; // { "knowledge.view": ["GLOBAL"], ... }
    return true;
  }
}