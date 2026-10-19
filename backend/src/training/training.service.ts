import { newSlug } from '../common/slug-key';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Actor, scopesFor } from '../knowledge/helpers';
import { FilesService } from '../knowledge/files/files.service';
import type { UploadedFileData } from '../knowledge/files/file-rules';
import { userScopeWhere } from '../testing/visibility';
import { notifyIfCompleted, progressFor } from './progress';
import {
  CreateLessonDto,
  CreateStageDto,
  UpdateLessonDto,
  UpdateStageDto,
} from './dto/training.dto';

const lessonSelect = {
  id: true,
  kind: true,
  title: true,
  position: true,
  version: true,
  videoUrl: true,
  fileId: true,
} satisfies Prisma.TrainingLessonSelect;

@Injectable()
export class TrainingService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private files: FilesService,
  ) {}

  private async canManage(user: Actor) {
    return (await scopesFor(this.prisma, user.id, 'training.manage')).length > 0;
  }

  // ---------- для співробітника ----------

  async overview(user: Actor) {
    const [stages, progress, done] = await Promise.all([
      this.prisma.trainingStage.findMany({
        where: { status: 'published' },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          title: true,
          description: true,
          test: {
            select: { id: true, slug: true, title: true, passingScorePercent: true, maxAttempts: true },
          },
          lessons: {
            where: { archivedAt: null },
            orderBy: { position: 'asc' },
            select: { id: true, slug: true, kind: true, title: true },
          },
        },
      }),
      progressFor(this.prisma, user.id),
      this.prisma.trainingLessonDone.findMany({
        where: { userId: user.id },
        select: { lessonId: true },
      }),
    ]);
    const doneSet = new Set(done.map((d) => d.lessonId));
    const byId = new Map(progress.map((p) => [p.id, p]));

    const testIds = stages.map((s) => s.test?.id).filter((x): x is string => !!x);
    const attempts = testIds.length
      ? await this.prisma.testAttempt.findMany({
          where: { userId: user.id, testId: { in: testIds } },
          select: { testId: true, status: true, passed: true, scorePercent: true },
        })
      : [];

    const out = stages.map((s, i) => {
      const p = byId.get(s.id);
      const mine = attempts.filter((a) => a.testId === s.test?.id);
      const best = mine.reduce<number | null>(
        (m, a) =>
          a.scorePercent !== null && (m === null || a.scorePercent > m) ? a.scorePercent : m,
        null,
      );
      return {
        id: s.id,
        number: i + 1,
        title: s.title,
        description: s.description,
        state: p?.state ?? 'locked',
        lessonsTotal: p?.lessonsTotal ?? 0,
        lessonsDone: p?.lessonsDone ?? 0,
        lessons: s.lessons.map((l) => ({ ...l, done: doneSet.has(l.id) })),
        test: s.test
          ? {
              id: s.test.id,
              slug: s.test.slug,
              title: s.test.title,
              passingScorePercent: s.test.passingScorePercent,
              passed: p?.testPassed ?? false,
              attemptsUsed: mine.length,
              maxAttempts: s.test.maxAttempts,
              bestPercent: best,
              available: !!p?.theoryDone && p.state !== 'locked',
            }
          : null,
      };
    });

    const total = out.length;
    const complete = out.filter((s) => s.state === 'done').length;
    return {
      stages: out,
      stagesTotal: total,
      stagesDone: complete,
      percent: total ? Math.round((complete / total) * 100) : 0,
    };
  }

  private async lessonFor(user: Actor, id: string) {
    const lesson = await this.prisma.trainingLesson.findFirst({
      where: { id, archivedAt: null },
      include: { stage: { select: { id: true, title: true, status: true } } },
    });
    if (!lesson) throw new NotFoundException('Урок не знайдено');
    if (await this.canManage(user)) return lesson;
    if (lesson.stage.status !== 'published') throw new NotFoundException('Урок не знайдено');
    const p = (await progressFor(this.prisma, user.id)).find((s) => s.id === lesson.stageId);
    if (!p || p.state === 'locked') {
      throw new BadRequestException('Цей етап ще закритий: пройдіть попередні');
    }
    return lesson;
  }

  async lesson(user: Actor, id: string) {
    const l = await this.lessonFor(user, id);
    const [done, siblings] = await Promise.all([
      this.prisma.trainingLessonDone.findUnique({
        where: { userId_lessonId: { userId: user.id, lessonId: id } },
      }),
      this.prisma.trainingLesson.findMany({
        where: { stageId: l.stageId, archivedAt: null },
        orderBy: { position: 'asc' },
        select: { id: true, slug: true },
      }),
    ]);
    const idx = siblings.findIndex((s) => s.id === id);
    return {
      id: l.id,
      kind: l.kind,
      title: l.title,
      content: l.content,
      videoUrl: l.videoUrl,
      hasFile: !!l.fileId,
      stage: { id: l.stage.id, title: l.stage.title },
      done: !!done,
      nextLessonId: siblings[idx + 1]?.slug ?? siblings[idx + 1]?.id ?? null,
    };
  }

  async fileUrl(user: Actor, id: string) {
    const l = await this.lessonFor(user, id);
    if (!l.fileId) throw new NotFoundException('Файл не прикріплено');
    return { url: this.files.rawUrl(l.fileId, true) };
  }

  async complete(user: Actor, id: string) {
    await this.lessonFor(user, id);
    await this.prisma.trainingLessonDone.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: id } },
      update: {},
      create: { userId: user.id, lessonId: id },
    });
    await notifyIfCompleted(this.prisma, user.id).catch(() => undefined);
    return { ok: true };
  }

  // ---------- CMS ----------

  manageList() {
    return this.prisma.trainingStage.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        test: { select: { id: true, title: true, status: true } },
        lessons: {
          where: { archivedAt: null },
          orderBy: { position: 'asc' },
          select: lessonSelect,
        },
      },
    });
  }

  testOptions() {
    return this.prisma.test.findMany({
      where: { status: 'published' },
      orderBy: { title: 'asc' },
      select: { id: true, title: true },
    });
  }

  async createStage(user: Actor, dto: CreateStageDto) {
    const last = await this.prisma.trainingStage.aggregate({ _max: { position: true } });
    const stage = await this.prisma.trainingStage.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        position: (last._max.position ?? -1) + 1,
      },
    });
    await this.audit.log(user.id, 'training.stage_created', 'TrainingStage', stage.id, {
      title: stage.title,
    });
    return stage;
  }

  private async stageOrFail(id: string) {
    const s = await this.prisma.trainingStage.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Етап не знайдено');
    return s;
  }

  async updateStage(user: Actor, id: string, dto: UpdateStageDto) {
    await this.stageOrFail(id);
    if (dto.testId) {
      const t = await this.prisma.test.findUnique({
        where: { id: dto.testId },
        select: { id: true },
      });
      if (!t) throw new BadRequestException('Тест не знайдено');
    }
    const stage = await this.prisma.trainingStage.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        testId: dto.testId,
      },
    });
    await this.audit.log(user.id, 'training.stage_updated', 'TrainingStage', id);
    return stage;
  }

  async setStageStatus(user: Actor, id: string, status: 'published' | 'archived' | 'draft') {
    const s = await this.stageOrFail(id);
    if (status === 'published') {
      const lessons = await this.prisma.trainingLesson.count({
        where: { stageId: id, archivedAt: null },
      });
      if (lessons === 0 && !s.testId) {
        throw new BadRequestException('Додайте до етапу хоча б один урок або тест');
      }
      if (s.testId) {
        const t = await this.prisma.test.findUnique({
          where: { id: s.testId },
          select: { status: true },
        });
        if (t?.status !== 'published') {
          throw new BadRequestException('Тест етапу має бути опублікований');
        }
      }
    }
    await this.prisma.trainingStage.update({ where: { id }, data: { status } });
    await this.audit.log(user.id, `training.stage_${status}`, 'TrainingStage', id);
    return { ok: true };
  }

  // Етап, який уже використовується, не видаляємо — лише архівуємо
  async removeStage(user: Actor, id: string) {
    const s = await this.stageOrFail(id);
    const used = await this.prisma.trainingLessonDone.count({
      where: { lesson: { stageId: id } },
    });
    if (used > 0 || s.status === 'published') {
      throw new BadRequestException('Етап уже використовується: архівуйте його замість видалення');
    }
    await this.prisma.trainingStage.delete({ where: { id } });
    await this.audit.log(user.id, 'training.stage_deleted', 'TrainingStage', id, {
      title: s.title,
    });
    return { ok: true };
  }

  async reorderStages(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.trainingStage.update({ where: { id }, data: { position: i } })),
    );
    return { ok: true };
  }

  async reorderLessons(stageId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.trainingLesson.updateMany({ where: { id, stageId }, data: { position: i } }),
      ),
    );
    return { ok: true };
  }

  private async checkFile(fileId: string) {
    const f = await this.prisma.knowledgeFile.findUnique({ where: { id: fileId } });
    if (!f || f.mimeType !== 'application/pdf') throw new BadRequestException('Потрібен PDF-файл');
  }

  async createLesson(user: Actor, stageId: string, dto: CreateLessonDto) {
    await this.stageOrFail(stageId);
    if (dto.kind === 'video' && !dto.videoUrl) {
      throw new BadRequestException('Вкажіть посилання на YouTube');
    }
    if (dto.kind === 'pdf') {
      if (!dto.fileId) throw new BadRequestException('Завантажте PDF-файл');
      await this.checkFile(dto.fileId);
    }
    const last = await this.prisma.trainingLesson.aggregate({
      where: { stageId },
      _max: { position: true },
    });
    const lesson = await this.prisma.$transaction(async (tx) => {
      const l = await tx.trainingLesson.create({
        data: {
          slug: await newSlug(this.prisma, 'trainingLesson', dto.title),
          stageId,
          kind: dto.kind,
          title: dto.title.trim(),
          position: (last._max.position ?? -1) + 1,
          content:
            dto.kind === 'text' ? ((dto.content ?? []) as Prisma.InputJsonValue) : undefined,
          videoUrl: dto.kind === 'video' ? dto.videoUrl : null,
          fileId: dto.kind === 'pdf' ? dto.fileId : null,
        },
      });
      await tx.trainingLessonVersion.create({
        data: {
          lessonId: l.id,
          version: 1,
          title: l.title,
          content: l.content ?? undefined,
          videoUrl: l.videoUrl,
          fileId: l.fileId,
          authorId: user.id,
        },
      });
      return l;
    });
    await this.audit.log(user.id, 'training.lesson_created', 'TrainingLesson', lesson.id, {
      title: lesson.title,
    });
    return lesson;
  }

  async getLessonForEdit(id: string) {
    const l = await this.prisma.trainingLesson.findFirst({ where: { id, archivedAt: null } });
    if (!l) throw new NotFoundException('Урок не знайдено');
    return l;
  }

  async updateLesson(user: Actor, id: string, dto: UpdateLessonDto) {
    const cur = await this.getLessonForEdit(id);
    if (dto.videoUrl && cur.kind !== 'video') throw new BadRequestException('Це не відео-урок');
    if (dto.fileId) {
      if (cur.kind !== 'pdf') throw new BadRequestException('Це не PDF-урок');
      await this.checkFile(dto.fileId);
    }
    if (dto.content && cur.kind !== 'text') {
      throw new BadRequestException('Це не текстовий урок');
    }

    const lesson = await this.prisma.$transaction(async (tx) => {
      const l = await tx.trainingLesson.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          content: dto.content as Prisma.InputJsonValue | undefined,
          videoUrl: dto.videoUrl,
          fileId: dto.fileId,
          version: { increment: 1 },
        },
      });
      await tx.trainingLessonVersion.create({
        data: {
          lessonId: id,
          version: l.version,
          title: l.title,
          content: l.content ?? undefined,
          videoUrl: l.videoUrl,
          fileId: l.fileId,
          authorId: user.id,
        },
      });
      return l;
    });
    await this.audit.log(user.id, 'training.lesson_updated', 'TrainingLesson', id);
    return lesson;
  }

  async archiveLesson(user: Actor, id: string) {
    await this.getLessonForEdit(id);
    await this.prisma.trainingLesson.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log(user.id, 'training.lesson_archived', 'TrainingLesson', id);
    return { ok: true };
  }

  async versions(id: string) {
    await this.getLessonForEdit(id);
    return this.prisma.trainingLessonVersion.findMany({
      where: { lessonId: id },
      orderBy: { version: 'desc' },
      select: { version: true, title: true, createdAt: true, authorId: true },
    });
  }

  async restoreVersion(user: Actor, id: string, version: number) {
    await this.getLessonForEdit(id);
    const v = await this.prisma.trainingLessonVersion.findUnique({
      where: { lessonId_version: { lessonId: id, version } },
    });
    if (!v) throw new NotFoundException('Версію не знайдено');
    return this.updateLesson(user, id, {
      title: v.title,
      content: (v.content as unknown[] | null) ?? undefined,
      videoUrl: v.videoUrl ?? undefined,
      fileId: v.fileId ?? undefined,
    });
  }

  async uploadPdf(user: Actor, file: UploadedFileData) {
    const res = await this.files.upload(user, file);
    if (res.mime !== 'application/pdf') {
      throw new BadRequestException('Для навчання підтримується лише PDF');
    }
    return res;
  }

  // ---------- аналітика ----------

  async analytics(user: Actor) {
    const scopes = await scopesFor(this.prisma, user.id, 'training.view_analytics');
    const stages = await this.prisma.trainingStage.findMany({
      where: { status: 'published' },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        testId: true,
        lessons: { where: { archivedAt: null }, select: { id: true } },
      },
    });

    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          userScopeWhere(scopes, user),
          { status: 'active' },
          {
            roles: {
              some: {
                role: {
                  archivedAt: null,
                  permissions: { some: { permission: { code: 'training.view' } } },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        store: { select: { name: true } },
        roles: { select: { role: { select: { name: true } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const userIds = users.map((u) => u.id);
    const lessonIds = stages.flatMap((s) => s.lessons.map((l) => l.id));
    const testIds = stages.map((s) => s.testId).filter((x): x is string => !!x);

    const [done, passed, attempts] = await Promise.all([
      this.prisma.trainingLessonDone.findMany({
        where: { userId: { in: userIds }, lessonId: { in: lessonIds } },
        select: { userId: true, lessonId: true },
      }),
      this.prisma.testAttempt.findMany({
        where: { userId: { in: userIds }, testId: { in: testIds }, passed: true },
        select: { userId: true, testId: true },
      }),
      this.prisma.testAttempt.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, testId: { in: testIds }, status: 'completed' },
        _count: { _all: true },
      }),
    ]);

    const doneBy = new Map<string, Set<string>>();
    for (const d of done) {
      const set = doneBy.get(d.userId) ?? new Set<string>();
      set.add(d.lessonId);
      doneBy.set(d.userId, set);
    }
    const passedBy = new Map<string, Set<string>>();
    for (const p of passed) {
      const set = passedBy.get(p.userId) ?? new Set<string>();
      set.add(p.testId);
      passedBy.set(p.userId, set);
    }
    const attemptsBy = new Map(attempts.map((a) => [a.userId, a._count._all]));

    const rows = users.map((u) => {
      const d = doneBy.get(u.id) ?? new Set<string>();
      const pm = passedBy.get(u.id) ?? new Set<string>();
      let prevComplete = true;
      let current: string | null = null;
      let complete = 0;
      for (const s of stages) {
        const ok = s.lessons.every((l) => d.has(l.id)) && (!s.testId || pm.has(s.testId));
        if (ok) complete++;
        else if (prevComplete && current === null) current = s.title;
        prevComplete = prevComplete && ok;
      }
      const completed = stages.length > 0 && complete === stages.length;
      return {
        id: u.id,
        name: `${u.lastName} ${u.firstName}`.trim(),
        store: u.store?.name ?? null,
        roles: u.roles.map((r) => r.role.name),
        stagesDone: complete,
        stagesTotal: stages.length,
        percent: stages.length ? Math.round((complete / stages.length) * 100) : 0,
        currentStage: completed ? null : current,
        completed,
        testAttempts: attemptsBy.get(u.id) ?? 0,
      };
    });
    return { stagesTotal: stages.length, rows };
  }
}
