import { Injectable, NotFoundException, OnModuleInit, PipeTransform, Type } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueSlug } from '../knowledge/slug';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SlugModel = 'test' | 'trainingLesson';

const TABLE: Record<SlugModel, string> = { test: 'Test', trainingLesson: 'TrainingLesson' };
const NOT_FOUND: Record<SlugModel, string> = {
  test: 'Тест не знайдено',
  trainingLesson: 'Урок не знайдено',
};

// Модельні делегати Prisma мають однаковий шаблон для findUnique/findMany
function delegate(prisma: PrismaService, model: SlugModel) {
  return prisma[model] as unknown as {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    findMany(args: unknown): Promise<{ id: string; title: string }[]>;
  };
}

export function newSlug(prisma: PrismaService, model: SlugModel, title: string) {
  return uniqueSlug(
    async (s) => !!(await delegate(prisma, model).findUnique({ where: { slug: s }, select: { id: true } })),
    title,
  );
}

// slug або старий uuid → id
export function slugKeyPipe(model: SlugModel): Type<PipeTransform<string, Promise<string>>> {
  @Injectable()
  class SlugKeyPipe implements PipeTransform<string, Promise<string>> {
    constructor(private prisma: PrismaService) {}
    async transform(key: string) {
      if (UUID_RE.test(key)) return key;
      const found = await delegate(this.prisma, model).findUnique({
        where: { slug: key },
        select: { id: true },
      });
      if (!found) throw new NotFoundException(NOT_FOUND[model]);
      return found.id;
    }
  }
  return SlugKeyPipe;
}

// Старим записам без slug створює його при старті
@Injectable()
export class SlugBackfill implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    for (const model of Object.keys(TABLE) as SlugModel[]) {
      const rows = await delegate(this.prisma, model).findMany({
        where: { slug: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, title: true },
      });
      for (const r of rows) {
        const slug = await newSlug(this.prisma, model, r.title);
        // raw-запит, щоб не змінювати дату «Оновлено»
        await this.prisma.$executeRawUnsafe(
          `UPDATE "${TABLE[model]}" SET "slug" = $1 WHERE "id" = $2`,
          slug,
          r.id,
        );
      }
    }
  }
}
