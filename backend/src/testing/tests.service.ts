import { newSlug } from '../common/slug-key';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Actor, regionIdsOf, scopesFor } from '../knowledge/helpers';
import { CreateTestDto, UpdateTestDto } from './dto/test.dto';
import { toQuestionData, validateQuestion, validateTest } from './validation';
import {
  assignedUsersWhere,
  resolveAssignment,
  testAuthorWhere,
  testVisibleWhere,
} from './visibility';
import { NotificationsService } from '../notifications/notifications.service';
import { AttemptsService } from './attempts.service';

@Injectable()
export class TestsService {
    constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private attempts: AttemptsService,
    private notifications: NotificationsService,
  ) {}

  // Опубліковані тести, призначені користувачу
    async list(user: Actor) {
    const where = await testVisibleWhere(this.prisma, user);
    const tests = await this.prisma.test.findMany({
      where,
      orderBy: [{ isRequired: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        isRequired: true,
        deadline: true,
        questionCount: true,
        timeLimitMinutes: true,
        passingScorePercent: true,
        maxAttempts: true,
        category: { select: { id: true, name: true, icon: true } },
        linkedItem: { select: { id: true, slug: true, title: true } },
      },
    });
    return this.attempts.decorate(user, tests);
  }

  async manageList(user: Actor, status?: string) {
    const scopes = await scopesFor(this.prisma, user.id, 'testing.edit');
    const st: TestStatus =
      status === 'draft' ? 'draft' : status === 'archived' ? 'archived' : 'published';
    return this.prisma.test.findMany({
      where: { AND: [{ status: st }, testAuthorWhere(scopes, user)] },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        isRequired: true,
        deadline: true,
        questionCount: true,
        updatedAt: true,
        category: { select: { id: true, name: true, icon: true } },
        _count: { select: { questions: { where: { archivedAt: null } } } },
      },
    });
  }

  async options(user: Actor) {
    const scopes = await scopesFor(this.prisma, user.id, 'testing.edit');
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
    const categories = await this.prisma.knowledgeCategory.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, parentId: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return { global, regions, stores, roles, brands, categories };
  }

  async getForEdit(user: Actor, id: string) {
    const test = await this.loadManageable(user, id, 'testing.edit');
    const rows = await this.questionsOf(id);
    const errors = validateTest(test, rows.map(toQuestionData), test.status !== 'published');

    return {
      id: test.id,
      title: test.title,
      description: test.description,
      categoryId: test.categoryId,
      linkedItem: test.linkedItem ? { id: test.linkedItem.id, title: test.linkedItem.title } : null,
      status: test.status,
      isRequired: test.isRequired,
      deadline: test.deadline,
      questionCount: test.questionCount,
      timeLimitMinutes: test.timeLimitMinutes,
      passingScorePercent: test.passingScorePercent,
      maxAttempts: test.maxAttempts,
      visibility: test.visibility.map((v) => ({ kind: v.kind, targetId: v.targetId })),
      questions: rows.map((q) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        explanation: q.explanation,
        difficulty: q.difficulty,
        points: q.points,
        position: q.position,
        accepted: q.accepted,
        options: q.options.map((o) => ({
          id: o.id,
          label: o.label,
          matchLabel: o.matchLabel,
          isCorrect: o.isCorrect,
        })),
        errors: validateQuestion(toQuestionData(q)),
      })),
      errors,
    };
  }

  async create(user: Actor, dto: CreateTestDto) {
    await this.assertRefs(dto.categoryId, dto.linkedItemId);
    const rules = dto.visibility ? await resolveAssignment(this.prisma, user, dto.visibility) : [];
    const canRequired = await this.allowed(user, 'testing.manage_required');
    const canDeadline = await this.allowed(user, 'testing.manage_deadlines');

    const test = await this.prisma.test.create({
      data: {
        slug: await newSlug(this.prisma, 'test', dto.title),
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        categoryId: dto.categoryId ?? undefined,
        linkedItemId: dto.linkedItemId ?? undefined,
        isRequired: canRequired ? !!dto.isRequired : false,
        deadline: canDeadline && dto.deadline ? new Date(dto.deadline) : undefined,
        questionCount: dto.questionCount ?? 20,
        timeLimitMinutes: dto.timeLimitMinutes ?? 25,
        passingScorePercent: dto.passingScorePercent ?? 80,
        maxAttempts: dto.maxAttempts ?? 2,
        createdById: user.id,
        visibility: { create: rules },
      },
    });
    await this.audit.log(user.id, 'test.created', 'Test', test.id, { title: test.title });
    return { id: test.id, status: test.status };
  }

  async update(user: Actor, id: string, dto: UpdateTestDto) {
    await this.loadManageable(user, id, 'testing.edit');
    await this.assertRefs(dto.categoryId, dto.linkedItemId);
    const rules = dto.visibility ? await resolveAssignment(this.prisma, user, dto.visibility) : undefined;

    const data: Prisma.TestUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.linkedItemId !== undefined) data.linkedItemId = dto.linkedItemId;
    if (dto.questionCount !== undefined) data.questionCount = dto.questionCount;
    if (dto.timeLimitMinutes !== undefined) data.timeLimitMinutes = dto.timeLimitMinutes;
    if (dto.passingScorePercent !== undefined) data.passingScorePercent = dto.passingScorePercent;
    if (dto.maxAttempts !== undefined) data.maxAttempts = dto.maxAttempts;
    if (dto.isRequired !== undefined && (await this.allowed(user, 'testing.manage_required'))) {
      data.isRequired = dto.isRequired;
    }
    if (dto.deadline !== undefined && (await this.allowed(user, 'testing.manage_deadlines'))) {
      data.deadline = dto.deadline ? new Date(dto.deadline) : null;
    }
    if (rules) data.visibility = { deleteMany: {}, create: rules };

    const test = await this.prisma.test.update({ where: { id }, data });
    await this.audit.log(user.id, 'test.updated', 'Test', id);
    return { id, status: test.status };
  }

  async publish(user: Actor, id: string) {
    const test = await this.loadManageable(user, id, 'testing.publish');
    if (test.status === 'published') throw new BadRequestException('Тест вже опубліковано');

    const rows = await this.questionsOf(id);
    const errors = validateTest(test, rows.map(toQuestionData), true);
    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Неможливо опублікувати тест', errors });
    }

    await this.prisma.test.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
    });
    await this.audit.log(user.id, 'test.published', 'Test', id, { title: test.title });
    // сповіщення призначеним працівникам (крім автора)
    const assignees = await this.prisma.user.findMany({
      where: { AND: [assignedUsersWhere(test.visibility), { id: { not: user.id } }] },
      select: { id: true },
    });
    await this.notifications
      .notifyUsers(
        assignees.map((u) => u.id),
        {
          kind: test.isRequired ? 'test_required' : 'test_assigned',
          title: test.isRequired
            ? `Новий обов'язковий тест: ${test.title}`
            : `Вам призначено новий тест: ${test.title}`,
          link: `/testing/${id}`,
          itemId: id,
        },
      )
      .catch(() => 0);
    return { id, status: 'published' };
  }

  async archive(user: Actor, id: string) {
    const test = await this.loadManageable(user, id, 'testing.archive');
    if (test.status !== 'published') {
      throw new BadRequestException('В архів можна перенести лише опублікований тест');
    }
    await this.prisma.test.update({ where: { id }, data: { status: 'archived' } });
    await this.audit.log(user.id, 'test.archived', 'Test', id);
    return { ok: true };
  }

  async restore(user: Actor, id: string) {
    const test = await this.loadManageable(user, id, 'testing.archive', true);
    if (test.status === 'trashed') {
      // з кошика повертаємо в той стан, у якому тест був до видалення
      await this.prisma.$executeRaw`UPDATE "Test" SET "status" = ${test.trashedFrom ?? 'draft'}::"TestStatus", "trashedAt" = NULL, "trashedFrom" = NULL WHERE "id" = ${id}`;
      await this.audit.log(user.id, 'test.untrashed', 'Test', id, { title: test.title });
      return { ok: true };
    }
    if (test.status !== 'archived') throw new BadRequestException('Тест не в архіві');
    await this.prisma.test.update({ where: { id }, data: { status: 'draft' } });
    await this.audit.log(user.id, 'test.restored', 'Test', id);
    return { ok: true };
  }

  // Перше видалення переносить у кошик, повторне (з кошика) видаляє назавжди
  async remove(user: Actor, id: string) {
    const test = await this.loadManageable(user, id, 'testing.delete', true);
    if (test.status !== 'trashed') {
      await this.prisma.$executeRaw`UPDATE "Test" SET "trashedFrom" = "status", "status" = 'trashed', "trashedAt" = NOW() WHERE "id" = ${id}`;
      await this.audit.log(user.id, 'test.trashed', 'Test', id, { title: test.title });
      return { ok: true, trashed: true };
    }
    // спроби (разом з відповідями) видаляються разом з тестом
    await this.prisma.$transaction([
      this.prisma.testAttempt.deleteMany({ where: { testId: id } }),
      this.prisma.test.delete({ where: { id } }),
    ]);
    await this.audit.log(user.id, 'test.deleted', 'Test', id, { title: test.title });
    return { ok: true };
  }

  // ---------- допоміжне ----------

  private async allowed(user: Actor, code: string) {
    return (await scopesFor(this.prisma, user.id, code)).length > 0;
  }

  private questionsOf(testId: string) {
    return this.prisma.testQuestion.findMany({
      where: { testId, archivedAt: null },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      include: { options: { orderBy: { position: 'asc' } } },
    });
  }

  private async loadManageable(user: Actor, id: string, code: string, allowTrashed = false) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: {
        visibility: true,
        linkedItem: { select: { id: true, slug: true, title: true } },
      },
    });
    if (!test) throw new NotFoundException('Тест не знайдено');
    if (test.status === 'trashed' && !allowTrashed) {
      throw new BadRequestException('Тест у кошику. Спершу відновіть його');
    }
    const scopes = await scopesFor(this.prisma, user.id, code);
    const ok = await this.prisma.test.findFirst({
      where: { AND: [{ id }, testAuthorWhere(scopes, user)] },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('Недостатньо прав для цього тесту');
    return test;
  }

  private async assertRefs(categoryId?: string | null, linkedItemId?: string | null) {
    if (categoryId) {
      const cat = await this.prisma.knowledgeCategory.findFirst({
        where: { id: categoryId, archivedAt: null },
      });
      if (!cat) throw new BadRequestException('Категорію не знайдено');
    }
    if (linkedItemId) {
      const item = await this.prisma.knowledgeItem.findUnique({
        where: { id: linkedItemId },
        select: { id: true },
      });
      if (!item) throw new BadRequestException('Матеріал для підготовки не знайдено');
    }
  }
}