import { PrismaService } from '../prisma/prisma.service';

export type StageState = 'locked' | 'open' | 'done';

export type StageProgress = {
  id: string;
  state: StageState;
  lessonsTotal: number;
  lessonsDone: number;
  theoryDone: boolean;
  testId: string | null;
  testPassed: boolean;
};

// Прогрес користувача по всіх опублікованих етапах (за порядком).
// Етап пройдено, коли прочитано всі уроки й зданий тест (якщо він є).
// Наступний етап відкривається лише після повного проходження попереднього.
export async function progressFor(
  prisma: PrismaService,
  userId: string,
): Promise<StageProgress[]> {
  const stages = await prisma.trainingStage.findMany({
    where: { status: 'published' },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      testId: true,
      lessons: { where: { archivedAt: null }, select: { id: true } },
    },
  });
  if (stages.length === 0) return [];

  const lessonIds = stages.flatMap((s) => s.lessons.map((l) => l.id));
  const testIds = stages.map((s) => s.testId).filter((x): x is string => !!x);
  const [done, passed] = await Promise.all([
    prisma.trainingLessonDone.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    }),
    prisma.testAttempt.findMany({
      where: { userId, testId: { in: testIds }, passed: true },
      select: { testId: true },
    }),
  ]);
  const doneSet = new Set(done.map((d) => d.lessonId));
  const passedSet = new Set(passed.map((p) => p.testId));

  let prevComplete = true;
  return stages.map((s) => {
    const lessonsDone = s.lessons.filter((l) => doneSet.has(l.id)).length;
    const theoryDone = lessonsDone === s.lessons.length;
    const testPassed = !s.testId || passedSet.has(s.testId);
    const complete = theoryDone && testPassed;
    const state: StageState = !prevComplete ? 'locked' : complete ? 'done' : 'open';
    prevComplete = prevComplete && complete;
    return {
      id: s.id,
      state,
      lessonsTotal: s.lessons.length,
      lessonsDone,
      theoryDone,
      testId: s.testId,
      testPassed: !!s.testId && passedSet.has(s.testId),
    };
  });
}

// Чи можна зараз починати тест цього етапу: етап відкритий і теорію прочитано.
// Повертає null, якщо тест не прив'язаний до етапу навчання.
export async function testGate(
  prisma: PrismaService,
  userId: string,
  testId: string,
): Promise<{ ok: boolean; reason: string } | null> {
  const stage = await prisma.trainingStage.findFirst({
    where: { testId, status: 'published' },
    select: { id: true },
  });
  if (!stage) return null;
  const all = await progressFor(prisma, userId);
  const p = all.find((x) => x.id === stage.id);
  if (!p) return null;
  if (p.state === 'locked') {
    return { ok: false, reason: 'Спершу пройдіть попередні етапи навчання' };
  }
  if (!p.theoryDone) {
    return { ok: false, reason: 'Спершу опрацюйте всі матеріали етапу' };
  }
  return { ok: true, reason: '' };
}

// Коли стажер пройшов усе навчання — один раз сповіщаємо тих, хто може змінити роль.
export async function notifyIfCompleted(prisma: PrismaService, userId: string) {
  const all = await progressFor(prisma, userId);
  if (all.length === 0 || !all.every((s) => s.state === 'done')) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      status: true,
      roles: { where: { role: { name: 'Стажер', archivedAt: null } }, select: { id: true } },
    },
  });
  if (!user || user.status !== 'active' || user.roles.length === 0) return;

  const admins = await prisma.user.findMany({
    where: {
      status: 'active',
      id: { not: userId },
      roles: {
        some: {
          role: {
            archivedAt: null,
            permissions: { some: { permission: { code: 'training.view_analytics' } } },
          },
        },
      },
    },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      kind: 'training_completed',
      title: `${user.firstName} ${user.lastName} пройшов навчання`,
      body: 'Усі етапи й тести складено. Можна змінити роль зі «Стажер» на «Продавець».',
      link: `/admin/users/${userId}`,
      itemId: userId,
    })),
    skipDuplicates: true,
  });
}
