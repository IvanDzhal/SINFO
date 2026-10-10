import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KnowledgeStatus, KnowledgeType, Prisma, VisibilityKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  Actor,
  authorWhere,
  extractText,
  readingTime,
  regionIdsOf,
  scopesFor,
} from '../helpers';
import { CreateItemDto, UpdateItemDto, VisibilityRuleDto } from './dto/item.dto';

type Rule = { kind: VisibilityKind; targetId: string | null };

const asJson = (v: unknown) => v as Prisma.InputJsonValue;

@Injectable()
export class ManageService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(user: Actor, type?: string, status?: string) {
    const scopes = await scopesFor(this.prisma, user.id, 'knowledge.edit');
    const st: KnowledgeStatus = status === 'archived' ? 'archived' : 'draft';
    const validType = type && (Object.values(KnowledgeType) as string[]).includes(type);
    return this.prisma.knowledgeItem.findMany({
      where: {
        AND: [
          { status: st },
          validType ? { type: type as KnowledgeType } : {},
          authorWhere(scopes, user),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        status: true,
        readingTimeMinutes: true,
        isRequired: true,
        updatedAt: true,
        category: { select: { id: true, name: true, icon: true, parentId: true } },
      },
    });
  }

  async options(user: Actor) {
    const scopes = await scopesFor(this.prisma, user.id, 'knowledge.manage_visibility');
    const global = scopes.includes('GLOBAL');
    const regionIds = regionIdsOf(user);

    const regions = await this.prisma.region.findMany({
      where: global ? { status: 'active' } : { status: 'active', id: { in: regionIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const storeWhere: Prisma.StoreWhereInput = global
      ? { status: 'active' }
      : {
          status: 'active',
          OR: [
            { regionId: { in: regionIds } },
            ...(user.storeId ? [{ id: user.storeId }] : []),
          ],
        };
    const stores = await this.prisma.store.findMany({
      where: storeWhere,
      select: { id: true, name: true, regionId: true },
      orderBy: { name: 'asc' },
    });

    const roles = await this.prisma.role.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const brands = await this.prisma.brandFormat.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return { global, regions, stores, roles, brands };
  }

  async getForEdit(user: Actor, id: string) {
    const item = await this.loadManageable(user, id, 'knowledge.edit');
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      content: item.content,
      categoryId: item.categoryId,
      status: item.status,
      version: item.version,
      isRequired: item.isRequired,
      visibility: item.visibility.map((v) => ({ kind: v.kind, targetId: v.targetId })),
    };
  }

  async create(user: Actor, dto: CreateItemDto) {
    if (dto.categoryId) await this.assertCategory(dto.categoryId);
    const rules = (await this.resolveVisibility(user, dto.visibility, true)) ?? [];
    const incoming = dto.content ?? undefined;
    const text = extractText(incoming);

    const item = await this.prisma.knowledgeItem.create({
      data: {
        type: dto.type,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        content: incoming === undefined ? undefined : asJson(incoming),
        contentText: text,
        categoryId: dto.categoryId ?? undefined,
        authorId: user.id,
        isRequired: !!dto.isRequired,
        readingTimeMinutes: readingTime(text),
        visibility: { create: rules },
      },
    });
    await this.audit.log(user.id, 'knowledge_item.created', 'KnowledgeItem', item.id, {
      title: item.title,
      type: item.type,
    });
    return { id: item.id, status: item.status, version: item.version };
  }

  async update(user: Actor, id: string, dto: UpdateItemDto) {
    const item = await this.loadManageable(user, id, 'knowledge.edit');
    if (dto.categoryId) await this.assertCategory(dto.categoryId);
    const rules = await this.resolveVisibility(user, dto.visibility, false);

    const incoming = dto.content ?? undefined;
    const title = dto.title === undefined ? item.title : dto.title.trim();
    const description = dto.description === undefined ? item.description : dto.description.trim();
    const contentChanged =
      incoming !== undefined && JSON.stringify(incoming) !== JSON.stringify(item.content);
    const textChanged =
      title !== item.title || description !== item.description || contentChanged;

    const data: Prisma.KnowledgeItemUncheckedUpdateInput = { title, description };
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.isRequired !== undefined) data.isRequired = dto.isRequired;
    if (contentChanged) {
      const text = extractText(incoming);
      data.content = asJson(incoming);
      data.contentText = text;
      data.readingTimeMinutes = readingTime(text);
    }
    const bump = item.status === 'published' && textChanged;
    if (bump) data.version = item.version + 1;
    if (rules) data.visibility = { deleteMany: {}, create: rules };

    const updated = await this.prisma.knowledgeItem.update({ where: { id }, data });
    if (bump) await this.snapshot(updated, user.id);

    await this.audit.log(user.id, 'knowledge_item.updated', 'KnowledgeItem', id, {
      version: updated.version,
    });
    return { id, status: updated.status, version: updated.version };
  }

  async publish(user: Actor, id: string) {
    const item = await this.loadManageable(user, id, 'knowledge.publish');
    if (item.status === 'published') throw new BadRequestException('Матеріал вже опубліковано');
    if (item.title.trim().length < 2) throw new BadRequestException('Введіть назву матеріалу');

    // якщо стаття вже публікувалась раніше, нова публікація це нова версія
    const had = await this.prisma.knowledgeVersion.count({ where: { itemId: id } });
    const version = had > 0 ? item.version + 1 : item.version;

    const updated = await this.prisma.knowledgeItem.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date(), version },
    });
    await this.snapshot(updated, user.id);
    await this.audit.log(user.id, 'knowledge_item.published', 'KnowledgeItem', id, { version });
    return { id, status: updated.status, version: updated.version };
  }

  async archive(user: Actor, id: string) {
    const item = await this.loadManageable(user, id, 'knowledge.archive');
    if (item.status !== 'published') {
      throw new BadRequestException('В архів можна перенести лише опублікований матеріал');
    }
    await this.prisma.knowledgeItem.update({ where: { id }, data: { status: 'archived' } });
    await this.audit.log(user.id, 'knowledge_item.archived', 'KnowledgeItem', id);
    return { ok: true };
  }

  async restore(user: Actor, id: string) {
    const item = await this.loadManageable(user, id, 'knowledge.archive');
    if (item.status !== 'archived') throw new BadRequestException('Матеріал не в архіві');
    await this.prisma.knowledgeItem.update({ where: { id }, data: { status: 'draft' } });
    await this.audit.log(user.id, 'knowledge_item.restored', 'KnowledgeItem', id);
    return { ok: true };
  }

  async remove(user: Actor, id: string) {
    const item = await this.loadManageable(user, id, 'knowledge.delete');
    if (item.status !== 'draft') {
      throw new BadRequestException('Видалити можна лише чернетку. Для решти використайте архів');
    }
    await this.prisma.knowledgeItem.delete({ where: { id } });
    await this.audit.log(user.id, 'knowledge_item.deleted', 'KnowledgeItem', id, {
      title: item.title,
    });
    return { ok: true };
  }

  // ---------- допоміжне ----------

  private async loadManageable(user: Actor, id: string, code: string) {
    const item = await this.prisma.knowledgeItem.findUnique({
      where: { id },
      include: { visibility: true },
    });
    if (!item) throw new NotFoundException('Матеріал не знайдено');
    const scopes = await scopesFor(this.prisma, user.id, code);
    const ok = await this.prisma.knowledgeItem.findFirst({
      where: { AND: [{ id }, authorWhere(scopes, user)] },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('Недостатньо прав для цього матеріалу');
    return item;
  }

  private async assertCategory(id: string) {
    const cat = await this.prisma.knowledgeCategory.findFirst({
      where: { id, archivedAt: null },
    });
    if (!cat) throw new BadRequestException('Категорію не знайдено');
  }

  private snapshot(
    item: {
      id: string;
      version: number;
      title: string;
      description: string;
      content: Prisma.JsonValue | null;
    },
    authorId: string,
  ) {
    const content = (item.content ?? undefined) as Prisma.InputJsonValue | undefined;
    return this.prisma.knowledgeVersion.upsert({
      where: { itemId_version: { itemId: item.id, version: item.version } },
      update: { title: item.title, description: item.description, content, authorId },
      create: {
        itemId: item.id,
        version: item.version,
        title: item.title,
        description: item.description,
        content,
        authorId,
      },
    });
  }

  private normalize(rules: VisibilityRuleDto[]): Rule[] {
    const out: Rule[] = [];
    for (const r of rules) {
      if (r.kind === 'GLOBAL') out.push({ kind: 'GLOBAL', targetId: null });
      else if (r.targetId) out.push({ kind: r.kind, targetId: r.targetId });
    }
    return out;
  }

  // Повертає правила видимості, які треба записати (undefined = не чіпати)
  private async resolveVisibility(
    user: Actor,
    requested: VisibilityRuleDto[] | undefined,
    isCreate: boolean,
  ): Promise<Rule[] | undefined> {
    const visScopes = await scopesFor(this.prisma, user.id, 'knowledge.manage_visibility');

    if (visScopes.length > 0 && requested !== undefined) {
      const rules = this.normalize(requested);
      if (visScopes.includes('GLOBAL')) return rules;

      const regions = regionIdsOf(user);
      const storeIds = rules.filter((r) => r.kind === 'STORE').map((r) => r.targetId as string);
      const stores = storeIds.length
        ? await this.prisma.store.findMany({
            where: { id: { in: storeIds } },
            select: { id: true, regionId: true },
          })
        : [];

      // обмежений автор мусить вказати область або магазин зі свого доступу,
      // а бренд і ролі можуть лише звужувати коло
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
      if (!ok) throw new BadRequestException('Видимість виходить за межі вашого доступу');
      return rules;
    }

    if (!isCreate) return undefined;

    // немає права керувати видимістю: за замовчуванням обмежуємо за scope автора
    const createScopes = await scopesFor(this.prisma, user.id, 'knowledge.create');
    if (createScopes.includes('GLOBAL')) return [];
    const regions = regionIdsOf(user);
    if (createScopes.includes('REGION') && regions.length) {
      return regions.map((id) => ({ kind: 'REGION' as const, targetId: id }));
    }
    if (user.storeId) return [{ kind: 'STORE' as const, targetId: user.storeId }];
    return [];
  }
}