import { PrismaClient } from '@prisma/client';
import { uniqueSlug } from '../src/knowledge/slug';

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.knowledgeItem.findMany({
    where: { slug: null },
    orderBy: { createdAt: 'asc' },
  });
  for (const item of items) {
    const slug = await uniqueSlug(
      async (s) =>
        !!(await prisma.knowledgeItem.findUnique({ where: { slug: s }, select: { id: true } })),
      item.title,
    );
    // raw-запит, щоб не змінювати дату «Оновлено»
    await prisma.$executeRaw`UPDATE "KnowledgeItem" SET "slug" = ${slug} WHERE "id" = ${item.id}`;
  }
  console.log(`Slugs done: ${items.length}`);
}

main().finally(() => prisma.$disconnect());