import { BadRequestException } from '@nestjs/common';
import { Prisma, Scope, VisibilityKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, regionIdsOf, scopesFor } from '../knowledge/helpers';
import { VisibilityRuleDto } from '../knowledge/manage/dto/item.dto';

export type Rule = { kind: VisibilityKind; targetId: string | null };

export function normalizeRules(rules: VisibilityRuleDto[]): Rule[] {
  const out: Rule[] = [];
  for (const r of rules) {
    if (r.kind === 'GLOBAL') out.push({ kind: 'GLOBAL', targetId: null });
    else if (r.targetId) out.push({ kind: r.kind, targetId: r.targetId });
  }
  return out;
}

// Які опубліковані тести бачить користувач. Без призначення тест не бачить ніхто.
// Групи «де / бренд / ролі» поєднуються через «і», всередині групи достатньо одного збігу.
export async function testVisibleWhere(
  prisma: PrismaService,
  user: Actor,
): Promise<Prisma.TestWhereInput> {
  const roles = await prisma.userRole.findMany({
    where: { userId: user.id, role: { archivedAt: null } },
    select: { roleId: true },
  });
  const roleIds = roles.map((r) => r.roleId);
  const regionIds = regionIdsOf(user);
  const store = user.storeId
    ? await prisma.store.findUnique({
        where: { id: user.storeId },
        select: { brandFormatId: true },
      })
    : null;

  const groupOk = (
    kinds: VisibilityKind[],
    matches: Prisma.TestVisibilityWhereInput[],
  ): Prisma.TestWhereInput => ({
    OR: [
      { visibility: { none: { kind: { in: kinds } } } },
      ...(matches.length ? [{ visibility: { some: { OR: matches } } }] : []),
    ],
  });

  const place: Prisma.TestVisibilityWhereInput[] = [];
  if (regionIds.length) place.push({ kind: 'REGION', targetId: { in: regionIds } });
  if (user.storeId) place.push({ kind: 'STORE', targetId: user.storeId });
  const brand: Prisma.TestVisibilityWhereInput[] = store
    ? [{ kind: 'BRAND', targetId: store.brandFormatId }]
    : [];
  const role: Prisma.TestVisibilityWhereInput[] = roleIds.length
    ? [{ kind: 'ROLE', targetId: { in: roleIds } }]
    : [];

  return {
    status: 'published',
    OR: [
      { visibility: { some: { kind: 'GLOBAL' } } },
      {
        AND: [
          { visibility: { some: {} } },
          groupOk(['REGION', 'STORE'], place),
          groupOk(['BRAND'], brand),
          groupOk(['ROLE'], role),
        ],
      },
    ],
  };
}

// Тести, якими користувач може керувати (за автором і scope)
export function testAuthorWhere(scopes: Scope[], user: Actor): Prisma.TestWhereInput {
  if (scopes.length === 0) return { id: '__none__' };
  if (scopes.includes('GLOBAL')) return {};
  const or: Prisma.TestWhereInput[] = [{ createdById: user.id }];
  if (scopes.includes('REGION')) {
    const ids = regionIdsOf(user);
    if (ids.length) or.push({ createdBy: { regionId: { in: ids } } });
  }
  if (scopes.includes('STORE') && user.storeId) {
    or.push({ createdBy: { storeId: user.storeId } });
  }
  return { OR: or };
}

// Перевірка призначення: автор з обмеженим scope призначає лише в межах свого доступу
export async function resolveAssignment(
  prisma: PrismaService,
  user: Actor,
  requested: VisibilityRuleDto[],
): Promise<Rule[]> {
  const rules = normalizeRules(requested);
  if (rules.length === 0) return [];

  const scopes = await scopesFor(prisma, user.id, 'testing.edit');
  if (scopes.includes('GLOBAL')) return rules;

  const regions = regionIdsOf(user);
  const storeIds = rules.filter((r) => r.kind === 'STORE').map((r) => r.targetId as string);
  const stores = storeIds.length
    ? await prisma.store.findMany({
        where: { id: { in: storeIds } },
        select: { id: true, regionId: true },
      })
    : [];

  // потрібна область або магазин зі свого доступу, а бренд і ролі лише звужують коло
  const hasPlace = rules.some((r) => r.kind === 'REGION' || r.kind === 'STORE');
  const ok =
    hasPlace &&
    rules.every((r) => {
      if (r.kind === 'ROLE' || r.kind === 'BRAND') return true;
      if (r.kind === 'REGION') return regions.includes(r.targetId as string);
      if (r.kind === 'STORE') {
        const s = stores.find((x) => x.id === r.targetId);
        return !!s && (s.id === user.storeId || regions.includes(s.regionId));
      }
      return false;
    });
  if (!ok) throw new BadRequestException('Призначення виходить за межі вашого доступу');
  return rules;
}