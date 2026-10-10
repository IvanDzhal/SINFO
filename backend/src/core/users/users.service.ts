import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  ChangeLoginDto,
  CreateUserDto,
  ResetPasswordDto,
  SetManagedRegionsDto,
  SetUserRolesDto,
  UpdateUserDto,
} from './dto/user.dto';

const SAFE_INCLUDE = {
  roles: { include: { role: true } },
  region: true,
  city: true,
  store: true,
  managedRegions: { include: { region: true } },
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(filters: {
    status?: string;
    roleId?: string;
    regionId?: string;
    storeId?: string;
    search?: string;
  }) {
    const users = await this.prisma.user.findMany({
      where: {
        status: filters.status as UserStatus | undefined,
        regionId: filters.regionId,
        storeId: filters.storeId,
        roles: filters.roleId ? { some: { roleId: filters.roleId } } : undefined,
        OR: filters.search
          ? [
              { login: { contains: filters.search, mode: 'insensitive' } },
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { lastName: 'asc' },
      include: SAFE_INCLUDE,
    });
    return users.map(({ passwordHash, ...safe }) => safe);
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: SAFE_INCLUDE });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async create(actorId: string, dto: CreateUserDto) {
    const login = dto.login.trim();
    const existing = await this.prisma.user.findFirst({
      where: { login: { equals: login, mode: 'insensitive' } },
    });
    if (existing) throw new BadRequestException('Такий логін вже зайнятий');

    const user = await this.prisma.user.create({
      data: {
        login,
        passwordHash: await argon2.hash(dto.password),
        firstName: dto.firstName,
        lastName: dto.lastName,
        regionId: dto.regionId,
        cityId: dto.cityId,
        storeId: dto.storeId,
        position: dto.position,
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      include: SAFE_INCLUDE,
    });
    await this.audit.log(actorId, 'user.created', 'User', user.id, { login: user.login });
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async update(actorId: string, id: string, dto: UpdateUserDto) {
    await this.get(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      include: SAFE_INCLUDE,
    });
    await this.audit.log(actorId, 'user.updated', 'User', id, { ...dto });
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async setStatus(actorId: string, id: string, status: 'active' | 'inactive') {
    if (id === actorId && status === 'inactive') {
      throw new BadRequestException('Не можна деактивувати себе');
    }
    await this.get(id);
    await this.prisma.user.update({ where: { id }, data: { status } });
    await this.audit.log(
      actorId,
      status === 'active' ? 'user.activated' : 'user.deactivated',
      'User',
      id,
    );
    return { ok: true };
  }

  async resetPassword(actorId: string, id: string, dto: ResetPasswordDto) {
    await this.get(id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await argon2.hash(dto.newPassword) },
    });
    await this.audit.log(actorId, 'user.password_reset', 'User', id);
    return { ok: true };
  }

  async changeLogin(actorId: string, id: string, dto: ChangeLoginDto) {
    const newLogin = dto.newLogin.trim();
    const existing = await this.prisma.user.findFirst({
      where: { id: { not: id }, login: { equals: newLogin, mode: 'insensitive' } },
    });
    if (existing) throw new BadRequestException('Такий логін вже зайнятий');
    const user = await this.get(id);
    await this.prisma.user.update({ where: { id }, data: { login: newLogin } });
    await this.audit.log(actorId, 'user.login_changed', 'User', id, {
      from: user.login,
      to: newLogin,
    });
    return { ok: true };
  }

  async setRoles(actorId: string, id: string, dto: SetUserRolesDto) {
    const adminRole = await this.prisma.userRole.findFirst({
      where: { userId: id, role: { name: 'Адмін' } },
    });
    if (id === actorId && adminRole && !dto.roleIds.includes(adminRole.roleId)) {
      throw new BadRequestException('Не можна забрати у себе роль «Адмін»');
    }
    await this.get(id);
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
      }),
    ]);
    await this.audit.log(actorId, 'user.roles_updated', 'User', id, { roleIds: dto.roleIds });
    return this.get(id);
  }

  async setManagedRegions(actorId: string, id: string, dto: SetManagedRegionsDto) {
    await this.get(id);
    await this.prisma.$transaction([
      this.prisma.userRegion.deleteMany({ where: { userId: id } }),
      this.prisma.userRegion.createMany({
        data: dto.regionIds.map((regionId) => ({ userId: id, regionId })),
      }),
    ]);
    await this.audit.log(actorId, 'user.managed_regions_updated', 'User', id, {
      regionIds: dto.regionIds,
    });
    return this.get(id);
  }
}