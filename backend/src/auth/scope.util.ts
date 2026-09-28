import { Scope } from '@prisma/client';

type UserCtx = { id: string; regionId: string | null; storeId: string | null };
type Fields = { region?: string; store?: string; self?: string };

export function scopeWhere(scopes: Scope[], user: UserCtx, fields: Fields) {
  if (scopes.includes(Scope.GLOBAL)) return {};

  const or: Record<string, string>[] = [];
  if (scopes.includes(Scope.REGION) && fields.region && user.regionId)
    or.push({ [fields.region]: user.regionId });
  if (scopes.includes(Scope.STORE) && fields.store && user.storeId)
    or.push({ [fields.store]: user.storeId });
  if (scopes.includes(Scope.SELF) && fields.self)
    or.push({ [fields.self]: user.id });

  return or.length ? { OR: or } : { id: '__none__' };
}