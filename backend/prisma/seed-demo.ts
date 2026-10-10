import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const text = (t: string) => ({ type: 'text', text: t, styles: {} });
const para = (t: string) => ({ type: 'paragraph', content: [text(t)] });
const head = (t: string) => ({ type: 'heading', props: { level: 2 }, content: [text(t)] });

type Sample = {
  type: 'instruction' | 'material' | 'news';
  title: string;
  description: string;
  isRequired: boolean;
  minutes: number;
  read?: boolean;
};

const samples: Sample[] = [
  { type: 'instruction', title: 'Етапи роботи з клієнтом', description: 'Регламент процесу та ключові вимоги для виконання завдання', isRequired: true, minutes: 4, read: true },
  { type: 'instruction', title: 'Стандарти обслуговування', description: 'Регламент процесу та ключові вимоги для виконання завдання', isRequired: false, minutes: 5, read: true },
  { type: 'instruction', title: 'Продаж по терміналу', description: 'Регламент процесу та ключові вимоги для виконання завдання', isRequired: false, minutes: 3 },
  { type: 'instruction', title: 'Оформлення кредиту Monobank', description: 'Регламент процесу та ключові вимоги для виконання завдання', isRequired: true, minutes: 6 },
  { type: 'instruction', title: 'Повернення та обмін товару', description: 'Регламент процесу та ключові вимоги для виконання завдання', isRequired: false, minutes: 5 },
  { type: 'instruction', title: 'Гарантійний ремонт: покрокова інструкція', description: 'Регламент процесу та ключові вимоги для виконання завдання', isRequired: true, minutes: 6 },
  { type: 'material', title: 'Умови роботи в мережі', description: 'Графік, форма одягу та базові правила для співробітників', isRequired: false, minutes: 4 },
  { type: 'material', title: 'Шаблон акту повернення', description: 'Бланк для оформлення повернення товару', isRequired: false, minutes: 2 },
  { type: 'news', title: 'Нова акція на аксесуари', description: 'Діє з понеділка у всіх магазинах мережі', isRequired: false, minutes: 1 },
];

async function main() {
  const author = await prisma.user.findFirst({
    where: { roles: { some: { role: { name: 'Адмін' } } } },
  });
  if (!author) throw new Error('Не знайдено користувача з роллю «Адмін»');

  const cats = await prisma.knowledgeCategory.findMany({
    where: { archivedAt: null, parentId: null },
    orderBy: { sortOrder: 'asc' },
  });
  if (cats.length === 0) throw new Error('Спочатку створіть категорії в адмінці');

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const exists = await prisma.knowledgeItem.findFirst({ where: { title: s.title } });
    if (exists) continue;

    const paragraphs = [
      'Це демонстраційний матеріал. Справжній текст з\'явиться після створення статей у редакторі.',
      'Тут описуються кроки, вимоги та приклади для співробітників.',
    ];
    const published = new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000);

    const item = await prisma.knowledgeItem.create({
      data: {
        type: s.type,
        title: s.title,
        description: s.description,
        content: [head('Загальна інформація'), ...paragraphs.map(para)],
        contentText: `Загальна інформація ${paragraphs.join(' ')}`,
        categoryId: cats[i % cats.length].id,
        authorId: author.id,
        status: 'published',
        isRequired: s.isRequired,
        readingTimeMinutes: s.minutes,
        publishedAt: published,
      },
    });

    if (s.read) {
      await prisma.knowledgeRead.create({
        data: {
          userId: author.id,
          itemId: item.id,
          storeId: author.storeId,
          regionId: author.regionId,
        },
      });
    }
  }
  console.log('Demo seed done');
}

main().finally(() => prisma.$disconnect());