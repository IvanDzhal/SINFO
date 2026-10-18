import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

// Одноразовий імпорт підсумків тесту зі старого сайту (без відповідей по питаннях).
// Дані: prisma/data/legacy-attempts.json (у git не потрапляє — персональні дані).
// Запуск:  npx ts-node prisma/import-legacy-attempts.ts            — лише звіт (dry-run)
//          npx ts-node prisma/import-legacy-attempts.ts --apply    — записати в БД
// Повторний запуск безпечний: якщо у користувача вже є спроби цього тесту, він пропускається.

interface Legacy {
  test: string;
  user: string;
  startedAt: string;
  expiresAt: string;
  finishedAt: string;
  score: number;
  maxScore: number;
  percent: number;
}

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const norm = (s: string) =>
  s.toLowerCase().replace(/[’ʼ`‘]/g, "'").replace(/\s+/g, ' ').trim();

async function main() {
  const rows: Legacy[] = JSON.parse(
    readFileSync(join(__dirname, 'data', 'legacy-attempts.json'), 'utf8'),
  );

  const title = rows[0].test;
  const tests = await prisma.test.findMany({ where: { title: { equals: title, mode: 'insensitive' } } });
  if (tests.length !== 1) {
    console.error(`Тест «${title}»: знайдено ${tests.length}, потрібен рівно 1.`);
    process.exit(1);
  }
  const test = tests[0];
  console.log(`Тест: ${test.title} (прохідний бал ${test.passingScorePercent}%, статус ${test.status})\n`);

  const users = await prisma.user.findMany({ select: { id: true, firstName: true, lastName: true } });
  const byName = new Map<string, typeof users>();
  for (const u of users) {
    for (const key of [`${u.firstName} ${u.lastName}`, `${u.lastName} ${u.firstName}`]) {
      const k = norm(key);
      byName.set(k, [...(byName.get(k) ?? []), u]);
    }
  }

  const grouped = new Map<string, Legacy[]>();
  for (const r of rows) grouped.set(norm(r.user), [...(grouped.get(norm(r.user)) ?? []), r]);

  let created = 0;
  const problems: string[] = [];
  for (const [key, list] of grouped) {
    const name = list[0].user;
    const found = byName.get(key) ?? [];
    if (found.length !== 1) {
      problems.push(`${name}: ${found.length === 0 ? 'користувача не знайдено' : `знайдено ${found.length} збігів`}`);
      continue;
    }
    const user = found[0];
    const existing = await prisma.testAttempt.count({ where: { testId: test.id, userId: user.id } });
    if (existing > 0) {
      problems.push(`${name}: уже має ${existing} спроб(и) цього тесту — пропущено`);
      continue;
    }
    list.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    for (const [i, r] of list.entries()) {
      const passed = r.percent >= test.passingScorePercent;
      console.log(`${name} #${i + 1}: ${r.score}/${r.maxScore} (${r.percent}%) ${passed ? 'склав' : 'не склав'}`);
      if (apply) {
        await prisma.testAttempt.create({
          data: {
            testId: test.id,
            userId: user.id,
            attemptNumber: i + 1,
            startedAt: new Date(r.startedAt),
            expiresAt: new Date(r.expiresAt),
            completedAt: new Date(r.finishedAt),
            status: 'completed',
            questionIds: [],
            seed: 0,
            score: r.score,
            maxScore: r.maxScore,
            scorePercent: r.percent,
            passed,
          },
        });
      }
      created++;
    }
  }

  console.log(`\n${apply ? 'Створено' : 'Буде створено'} спроб: ${created} з ${rows.length}`);
  if (problems.length) console.log('\nПотребує уваги:\n' + problems.map((p) => ' - ' + p).join('\n'));
  if (!apply) console.log('\nЦе пробний прогін. Для запису додайте --apply');
}

main().finally(() => prisma.$disconnect());
