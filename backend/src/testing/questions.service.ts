import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Actor, scopesFor } from '../knowledge/helpers';
import {
  AcceptedDto,
  CreateQuestionDto,
  OptionDto,
  UpdateQuestionDto,
} from './dto/question.dto';
import { testAuthorWhere } from './visibility';

type CleanOption = { id?: string; label: string; matchLabel: string | null; isCorrect: boolean };

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async create(user: Actor, testId: string, dto: CreateQuestionDto) {
    await this.loadTest(user, testId);
    const last = await this.prisma.testQuestion.findFirst({
      where: { testId, archivedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const options = this.cleanOptions(dto.type, dto.options);

    const q = await this.prisma.testQuestion.create({
      data: {
        testId,
        type: dto.type,
        text: dto.text.trim(),
        explanation: dto.explanation?.trim() ?? '',
        difficulty: dto.difficulty ?? 'medium',
        points: dto.points ?? 2,
        position: (last?.position ?? -1) + 1,
        accepted: dto.type === 'input' ? this.cleanAccepted(dto.accepted) : undefined,
        options: {
          create: options.map((o, i) => ({
            label: o.label,
            matchLabel: o.matchLabel,
            isCorrect: o.isCorrect,
            position: i,
          })),
        },
      },
    });
    await this.audit.log(user.id, 'test_question.created', 'TestQuestion', q.id, {
      testId,
      type: q.type,
    });
    return { id: q.id };
  }

  async update(user: Actor, questionId: string, dto: UpdateQuestionDto) {
    const { q } = await this.loadQuestion(user, questionId);

    const data: Prisma.TestQuestionUncheckedUpdateInput = {};
    if (dto.text !== undefined) data.text = dto.text.trim();
    if (dto.explanation !== undefined) data.explanation = dto.explanation.trim();
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.points !== undefined) data.points = dto.points;
    if (q.type === 'input' && dto.accepted !== undefined) {
      data.accepted = this.cleanAccepted(dto.accepted);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.testQuestion.update({ where: { id: questionId }, data });
      if (q.type !== 'input' && dto.options !== undefined) {
        await this.syncOptions(
          tx,
          questionId,
          q.options.map((o) => o.id),
          this.cleanOptions(q.type, dto.options),
        );
      }
    });

    await this.audit.log(user.id, 'test_question.updated', 'TestQuestion', questionId);
    return { id: questionId };
  }

  async remove(user: Actor, questionId: string) {
    const { q, test } = await this.loadQuestion(user, questionId);
    const answered = await this.prisma.testAnswer.count({ where: { questionId } });
    const hard = test.status === 'draft' && answered === 0;

    if (hard) {
      await this.prisma.testQuestion.delete({ where: { id: questionId } });
    } else {
      // якщо вже були спроби, питання архівуємо, щоб історія не зламалась
      await this.prisma.testQuestion.update({
        where: { id: questionId },
        data: { archivedAt: new Date() },
      });
    }
    await this.audit.log(user.id, 'test_question.deleted', 'TestQuestion', questionId, {
      testId: q.testId,
      archived: !hard,
    });
    return { ok: true };
  }

  async reorder(user: Actor, testId: string, ids: string[]) {
    await this.loadTest(user, testId);
    const existing = await this.prisma.testQuestion.findMany({
      where: { testId, archivedAt: null },
      select: { id: true },
    });
    const known = new Set(existing.map((e) => e.id));
    if (
      new Set(ids).size !== ids.length ||
      ids.length !== known.size ||
      !ids.every((id) => known.has(id))
    ) {
      throw new BadRequestException('Невірний порядок питань');
    }
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.testQuestion.update({ where: { id }, data: { position: i } }),
      ),
    );
    return { ok: true };
  }

  // ---------- допоміжне ----------

  private async loadTest(user: Actor, testId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: { id: true, status: true },
    });
    if (!test) throw new NotFoundException('Тест не знайдено');

    const scopes = await scopesFor(this.prisma, user.id, 'testing.manage_questions');
    const ok = await this.prisma.test.findFirst({
      where: { AND: [{ id: testId }, testAuthorWhere(scopes, user)] },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('Недостатньо прав для цього тесту');
    if (test.status === 'archived') {
      throw new BadRequestException(
        'Тест в архіві. Поверніть його в чернетки, щоб редагувати питання',
      );
    }
    return test;
  }

  private async loadQuestion(user: Actor, questionId: string) {
    const q = await this.prisma.testQuestion.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!q || q.archivedAt) throw new NotFoundException('Питання не знайдено');
    const test = await this.loadTest(user, q.testId);
    return { q, test };
  }

  private cleanOptions(type: QuestionType, options: OptionDto[] | undefined): CleanOption[] {
    if (type === 'input') return [];
    return (options ?? []).map((o) => ({
      id: o.id,
      label: o.label.trim(),
      matchLabel: type === 'matching' ? (o.matchLabel ?? '').trim() : null,
      isCorrect: type === 'matching' ? false : !!o.isCorrect,
    }));
  }

  private cleanAccepted(accepted: AcceptedDto | undefined): Prisma.InputJsonValue {
    if (!accepted) return { kind: 'text', answers: [] };
    const answers = accepted.answers.map((a) => a.trim()).filter(Boolean);
    return accepted.kind === 'number' && accepted.tolerance !== undefined
      ? { kind: accepted.kind, answers, tolerance: accepted.tolerance }
      : { kind: accepted.kind, answers };
  }

  // Оновлює варіанти на місці (зберігаючи id), додає нові, прибирає зайві
  private async syncOptions(
    tx: Prisma.TransactionClient,
    questionId: string,
    existingIds: string[],
    options: CleanOption[],
  ) {
    const keep = new Set(
      options.filter((o) => o.id && existingIds.includes(o.id)).map((o) => o.id as string),
    );
    const removed = existingIds.filter((id) => !keep.has(id));
    if (removed.length > 0) {
      await tx.testOption.deleteMany({ where: { id: { in: removed } } });
    }
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      const data = {
        label: o.label,
        matchLabel: o.matchLabel,
        isCorrect: o.isCorrect,
        position: i,
      };
      if (o.id && keep.has(o.id)) {
        await tx.testOption.update({ where: { id: o.id }, data });
      } else {
        await tx.testOption.create({ data: { ...data, questionId } });
      }
    }
  }
}