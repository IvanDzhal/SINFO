export type QuestionType = 'single' | 'multiple' | 'matching' | 'input';

export type QuestionData = {
  type: QuestionType;
  text: string;
  points: number;
  options: { label: string; matchLabel: string | null; isCorrect: boolean }[];
  accepted: unknown;
};

export type Accepted = { kind: 'text' | 'number'; answers: string[]; tolerance?: number };

export function parseAccepted(raw: unknown): Accepted | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { kind?: unknown; answers?: unknown; tolerance?: unknown };
  const kind = r.kind === 'number' ? 'number' : r.kind === 'text' ? 'text' : null;
  if (!kind || !Array.isArray(r.answers)) return null;
  const answers = r.answers
    .filter((a): a is string => typeof a === 'string' && a.trim() !== '')
    .map((a) => a.trim());
  const tolerance = typeof r.tolerance === 'number' && r.tolerance >= 0 ? r.tolerance : undefined;
  return { kind, answers, tolerance };
}

export function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function toQuestionData(row: {
  type: QuestionType;
  text: string;
  points: number;
  accepted: unknown;
  options: { label: string; matchLabel: string | null; isCorrect: boolean }[];
}): QuestionData {
  return {
    type: row.type,
    text: row.text,
    points: row.points,
    accepted: row.accepted,
    options: row.options.map((o) => ({
      label: o.label,
      matchLabel: o.matchLabel,
      isCorrect: o.isCorrect,
    })),
  };
}

// Повертає список проблем питання (порожній список = питання валідне)
export function validateQuestion(q: QuestionData): string[] {
  const errors: string[] = [];
  if (!q.text.trim()) errors.push('немає тексту питання');
  if (!Number.isInteger(q.points) || q.points < 1) errors.push('вкажіть бали (від 1)');

  const filled = q.options.filter((o) => o.label.trim());
  if (q.type === 'single') {
    if (filled.length < 2) errors.push('потрібно щонайменше 2 варіанти');
    if (filled.filter((o) => o.isCorrect).length !== 1) {
      errors.push('має бути рівно одна правильна відповідь');
    }
  } else if (q.type === 'multiple') {
    if (filled.length < 2) errors.push('потрібно щонайменше 2 варіанти');
    if (filled.filter((o) => o.isCorrect).length < 1) {
      errors.push('позначте хоча б одну правильну відповідь');
    }
  } else if (q.type === 'matching') {
    const pairs = q.options.filter((o) => o.label.trim() && (o.matchLabel ?? '').trim());
    if (pairs.length < 2) errors.push('потрібно щонайменше 2 пари');
    if (pairs.length !== q.options.length) errors.push('усі пари мають бути заповнені');
  } else {
    const acc = parseAccepted(q.accepted);
    if (!acc || acc.answers.length === 0) {
      errors.push('вкажіть правильну відповідь');
    } else if (acc.kind === 'number' && acc.answers.some((a) => parseNumber(a) === null)) {
      errors.push('числова відповідь має бути числом');
    }
  }
  return errors;
}

// Повертає список помилок, які заважають опублікувати тест
export function validateTest(
  test: {
    title: string;
    categoryId: string | null;
    deadline: Date | null;
    questionCount: number;
    visibility: { kind: string }[];
  },
  questions: QuestionData[],
  checkDeadline: boolean,
): string[] {
  const errors: string[] = [];
  if (test.title.trim().length < 2) errors.push('Вкажіть назву тесту');
  if (!test.categoryId) errors.push('Оберіть категорію');
  if (test.visibility.length === 0) {
    errors.push('Вкажіть, кому призначено тест («Всім» або вибрані групи)');
  }
  if (checkDeadline && test.deadline && test.deadline.getTime() <= Date.now()) {
    errors.push('Дедлайн має бути в майбутньому');
  }

  let valid = 0;
  questions.forEach((q, i) => {
    const problems = validateQuestion(q);
    if (problems.length === 0) valid += 1;
    else errors.push(`Питання №${i + 1}: ${problems.join('; ')}`);
  });
  if (valid < test.questionCount) {
    errors.push(`Потрібно щонайменше ${test.questionCount} валідних питань, зараз ${valid}`);
  }
  return errors;
}