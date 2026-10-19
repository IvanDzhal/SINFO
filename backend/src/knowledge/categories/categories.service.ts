import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  list(includeArchived: boolean) {
    return this.prisma.knowledgeCategory.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async get(id: string) {
    const cat = await this.prisma.knowledgeCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Категорію не знайдено');
    return cat;
  }

  async create(actorId: string, dto: CreateCategoryDto) {
    if (dto.parentId) {
      const parent = await this.get(dto.parentId);
      if (parent.parentId) {
        throw new BadRequestException('Підкатегорія не може мати власних підкатегорій');
      }
    }
    const last = await this.prisma.knowledgeCategory.findFirst({
      where: { parentId: dto.parentId ?? null },
      orderBy: { sortOrder: 'desc' },
    });
    const cat = await this.prisma.knowledgeCategory.create({
      data: {
        name: dto.name.trim(),
        icon: dto.icon?.trim() || null,
        parentId: dto.parentId,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    await this.audit.log(actorId, 'knowledge_category.created', 'KnowledgeCategory', cat.id, {
      name: cat.name,
    });
    return cat;
  }

  async update(actorId: string, id: string, dto: UpdateCategoryDto) {
    await this.get(id);
    const cat = await this.prisma.knowledgeCategory.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        icon: dto.icon === undefined ? undefined : dto.icon.trim() || null,
      },
    });
    await this.audit.log(actorId, 'knowledge_category.updated', 'KnowledgeCategory', id, {
      ...dto,
    });
    return cat;
  }

  async move(id: string, direction: string) {
    if (direction !== 'up' && direction !== 'down') {
      throw new BadRequestException('Невірний напрямок');
    }
    const cat = await this.get(id);
    const siblings = await this.prisma.knowledgeCategory.findMany({
      where: { parentId: cat.parentId, archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const i = siblings.findIndex((s) => s.id === id);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= siblings.length) return { ok: true };
    const reordered = [...siblings];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    await this.prisma.$transaction(
      reordered.map((s, idx) =>
        this.prisma.knowledgeCategory.update({ where: { id: s.id }, data: { sortOrder: idx } }),
      ),
    );
    return { ok: true };
  }

  async archive(actorId: string, id: string) {
    await this.get(id);
    await this.prisma.knowledgeCategory.updateMany({
      where: { OR: [{ id }, { parentId: id }], archivedAt: null },
      data: { archivedAt: new Date() },
    });
    await this.audit.log(actorId, 'knowledge_category.archived', 'KnowledgeCategory', id);
    return { ok: true };
  }

  // Перше видалення ховає категорію (з підкатегоріями) в кошик, повторне видаляє назавжди.
  // Матеріали й тести лишаються без категорії.
  async purge(actorId: string, id: string) {
    const cat = await this.get(id);
    if (!cat.trashedAt) {
      await this.prisma.knowledgeCategory.updateMany({
        where: { OR: [{ id }, { parentId: id }] },
        data: { trashedAt: new Date(), archivedAt: new Date() },
      });
      await this.audit.log(actorId, 'knowledge_category.trashed', 'KnowledgeCategory', id, {
        name: cat.name,
      });
      return { ok: true, trashed: true };
    }
    const ids = [
      id,
      ...(await this.prisma.knowledgeCategory.findMany({ where: { parentId: id }, select: { id: true } })).map(
        (c) => c.id,
      ),
    ];
    await this.prisma.$transaction([
      // raw-запит, щоб не змінювати дату «Оновлено» матеріалів
      this.prisma.$executeRaw`UPDATE "KnowledgeItem" SET "categoryId" = NULL WHERE "categoryId" = ANY(${ids})`,
      this.prisma.test.updateMany({ where: { categoryId: { in: ids } }, data: { categoryId: null } }),
      this.prisma.knowledgeCategory.deleteMany({ where: { parentId: id } }),
      this.prisma.knowledgeCategory.delete({ where: { id } }),
    ]);
    await this.audit.log(actorId, 'knowledge_category.deleted', 'KnowledgeCategory', id, {
      name: cat.name,
    });
    return { ok: true };
  }

  async restore(actorId: string, id: string) {
    const cat = await this.get(id);
    if (cat.parentId) {
      const parent = await this.get(cat.parentId);
      if (parent.archivedAt) {
        throw new BadRequestException('Спочатку відновіть батьківську категорію');
      }
    }
    await this.prisma.knowledgeCategory.updateMany({
      where: cat.trashedAt ? { OR: [{ id }, { parentId: id, trashedAt: { not: null } }] } : { id },
      data: { archivedAt: null, trashedAt: null },
    });
    await this.audit.log(actorId, 'knowledge_category.restored', 'KnowledgeCategory', id);
    return { ok: true };
  }
}