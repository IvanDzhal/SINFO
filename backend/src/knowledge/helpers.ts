import { Prisma, Scope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type Actor = {
  id: string;
  regionId: string | null;
  storeId: string | null;
  managedRegionIds?: string[];
};

export async function scopesFor(
  prisma: PrismaService,
  userId: string,
  code: string,
): Promise<Scope[]> {
  const rows = await prisma.rolePermission.findMany({
    where: {
      role: { archivedAt: null, users: { some: { userId } } },
      permission: { code },
    },
    select: { scope: true },
  });
  return rows.map((r) => r.scope);
}

export function regionIdsOf(user: Actor): string[] {
  return [user.regionId, ...(user.managedRegionIds ?? [])].filter((x): x is string => !!x);
}

// Умова для статей, якими користувач може керувати (за автором і scope)
export function authorWhere(scopes: Scope[], user: Actor): Prisma.KnowledgeItemWhereInput {
  if (scopes.length === 0) return { id: '__none__' };
  if (scopes.includes('GLOBAL')) return {};
  const or: Prisma.KnowledgeItemWhereInput[] = [{ authorId: user.id }];
  if (scopes.includes('REGION')) {
    const ids = regionIdsOf(user);
    if (ids.length) or.push({ author: { regionId: { in: ids } } });
  }
  if (scopes.includes('STORE') && user.storeId) {
    or.push({ author: { storeId: user.storeId } });
  }
  return { OR: or };
}

export async function canManageItem(
  prisma: PrismaService,
  user: Actor,
  itemId: string,
): Promise<boolean> {
  const scopes = await scopesFor(prisma, user.id, 'knowledge.edit');
  if (scopes.length === 0) return false;
  const found = await prisma.knowledgeItem.findFirst({
    where: { AND: [{ id: itemId }, authorWhere(scopes, user)] },
    select: { id: true },
  });
  return !!found;
}

function inlineText(c: any): string {
  if (Array.isArray(c)) return c.map(inlineText).join('');
  if (c && typeof c === 'object') {
    if (typeof c.text === 'string') return c.text;
    if (Array.isArray(c.rows)) {
      return c.rows.map((r: any) => (r.cells ?? []).map(inlineText).join(' ')).join(' ');
    }
    if (c.content !== undefined) return inlineText(c.content);
  }
  return '';
}

// Чистий текст зі структури редактора (для пошуку й часу читання)
export function extractText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';
  const parts: string[] = [];
  const walk = (list: any[]) =>
    list.forEach((b) => {
      const t = inlineText(b?.content).trim();
      if (t) parts.push(t);
      if (Array.isArray(b?.children)) walk(b.children);
    });
  walk(blocks);
  return parts.join(' ');
}

export function readingTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}