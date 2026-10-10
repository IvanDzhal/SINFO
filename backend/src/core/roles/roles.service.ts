import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/role.dto';

const ADMIN_ROLE = 'Адмін';
@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  list() {
    return this.prisma.role.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
  }

  private assertEditable(role: { name: string; isSystem: boolean }) {
    if (role.isSystem && role.name === ADMIN_ROLE) {
      throw new BadRequestException('Роль «Адмін» змінювати не можна');
    }
  }

  async get(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Роль не знайдено');
    return role;
  }

  async create(actorId: string, dto: CreateRoleDto) {
    const role = await this.prisma.role.create({ data: { name: dto.name } });
    await this.audit.log(actorId, 'role.created', 'Role', role.id, { name: role.name });
    return role;
  }

  async update(actorId: string, id: string, dto: UpdateRoleDto) {
    this.assertEditable(await this.get(id));
    const role = await this.prisma.role.update({ where: { id }, data: dto });
    await this.audit.log(actorId, 'role.updated', 'Role', id, { ...dto });
    return role;
  }

  async archive(actorId: string, id: string) {
    const role = await this.get(id);
    if (role.isSystem) throw new BadRequestException('Системну роль архівувати не можна');
    await this.prisma.role.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log(actorId, 'role.archived', 'Role', id);
    return { ok: true };
  }

  async setPermissions(actorId: string, id: string, dto: SetRolePermissionsDto) {
    this.assertEditable(await this.get(id));
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: dto.permissions.map((p) => ({ roleId: id, permissionId: p.permissionId, scope: p.scope })),
      }),
    ]);
    await this.audit.log(actorId, 'role.permissions_updated', 'Role', id, { count: dto.permissions.length });
    return this.get(id);
  }

  async copy(actorId: string, id: string, newName: string) {
    const source = await this.get(id);
    const role = await this.prisma.role.create({ data: { name: newName } });
    await this.prisma.rolePermission.createMany({
      data: source.permissions.map((p) => ({
        roleId: role.id,
        permissionId: p.permissionId,
        scope: p.scope,
      })),
    });
    await this.audit.log(actorId, 'role.copied', 'Role', role.id, { from: id });
    return this.get(role.id);
  }
}