import { PrismaClient, Scope } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const permissionCodes = [
  'knowledge.view', 'knowledge.create', 'knowledge.edit', 'knowledge.delete', 'knowledge.publish',
  'testing.view', 'testing.create', 'testing.edit', 'testing.delete', 'testing.publish', 'testing.view_results',
  'analytics.sales.view', 'analytics.sales.view_region', 'analytics.sales.view_store',
  'analytics.sales.view_employee', 'analytics.sales.export',
  'analytics.content.view', 'analytics.content.view_region', 'analytics.content.view_store',
  'analytics.content.view_employee', 'analytics.content.export',
  'analytics.online_status.view',  'admin.access', 'admin.audit.view',
  'core.users.view', 'core.users.create', 'core.users.edit', 'core.users.deactivate',
  'core.users.reset_password', 'core.users.change_login', 'core.users.manage_roles',
  'core.roles.view', 'core.roles.create', 'core.roles.edit', 'core.roles.archive',
  'core.regions.view', 'core.regions.create', 'core.regions.edit',
  'core.cities.view', 'core.cities.create', 'core.cities.edit',
  'core.stores.view', 'core.stores.create', 'core.stores.edit',
  'core.brands.view', 'core.brands.create', 'core.brands.edit',
];

const roleNames = ['Гість', 'Стажер', 'Продавець', 'Регіональний менеджер', 'CEO', 'Адмін'];

async function main() {
  for (const code of permissionCodes) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
  }

  for (const name of roleNames) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name, isSystem: true } });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Адмін' } });
  const permissions = await prisma.permission.findMany();

  for (const p of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId_scope: { roleId: adminRole.id, permissionId: p.id, scope: Scope.GLOBAL } },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id, scope: Scope.GLOBAL },
    });
  }

  const admin = await prisma.user.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      passwordHash: await argon2.hash('ChangeMe123!'),
      firstName: 'Іван',
      lastName: 'Admin',
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  console.log('Seed done');
}

main().finally(() => prisma.$disconnect());