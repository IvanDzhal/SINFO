import { VisibilityKind } from '@prisma/client';

export type VisibilityRule = { kind: VisibilityKind; targetId: string | null };

export type Audience = {
  regionIds: string[];
  storeId: string | null;
  brandId: string | null;
  roleIds: string[];
};

// Чи бачить працівник матеріал за правилами видимості. Те саме правило, що й
// ItemsService.visibleWhere, але в пам'яті: аналітика перевіряє багатьох працівників
// проти одного набору матеріалів і не може робити запит на кожного.
// Без правил — бачать усі; GLOBAL — усі; групи «де / бренд / ролі» поєднуються через «і».
export function isVisibleTo(rules: VisibilityRule[], who: Audience): boolean {
  if (rules.length === 0 || rules.some((r) => r.kind === 'GLOBAL')) return true;

  const group = (kinds: VisibilityKind[], match: (r: VisibilityRule) => boolean) => {
    const inGroup = rules.filter((r) => kinds.includes(r.kind));
    return inGroup.length === 0 || inGroup.some(match);
  };

  return (
    group(['REGION', 'STORE'], (r) =>
      r.kind === 'REGION'
        ? !!r.targetId && who.regionIds.includes(r.targetId)
        : !!r.targetId && r.targetId === who.storeId,
    ) &&
    group(['BRAND'], (r) => !!r.targetId && r.targetId === who.brandId) &&
    group(['ROLE'], (r) => !!r.targetId && who.roleIds.includes(r.targetId))
  );
}
