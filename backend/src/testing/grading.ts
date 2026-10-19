import { signingSecret } from '../config/secrets';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { parseAccepted, parseNumber } from './validation';

type Opt = {
  id: string;
  label: string;
  matchLabel: string | null;
  isCorrect: boolean;
  position: number;
};

export type GradedQuestion = {
  id: string;
  type: 'single' | 'multiple' | 'matching' | 'input';
  options: Opt[];
  accepted: unknown;
};

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Перемішування, яке завжди дає той самий результат для того самого seed
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const a = [...items];
  const rand = rng(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom<T>(items: T[], count: number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, count);
}

// Права частина пари для користувача: одноразовий код замість id, щоб пару не можна було вгадати
export function rightToken(attemptId: string, optionId: string): string {
  return createHash('sha256')
    .update(`${signingSecret()}:${attemptId}:${optionId}`)
    .digest('hex')
    .slice(0, 12);
}

export function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’ʼ`]/g, "'")
    .replace(/\s+/g, ' ');
}

// Частка правильності відповіді від 0 до 1. Для кількох варіантів і відповідностей
// діє часткове зарахування; для решти типів лише 0 або 1.
export function gradeFraction(q: GradedQuestion, attemptId: string, answer: unknown): number {
  if (answer === null || answer === undefined) return 0;

  switch (q.type) {
    case 'single': {
      const picked = q.options.find((o) => o.id === answer);
      return picked && picked.isCorrect ? 1 : 0;
    }
    case 'multiple': {
      if (!Array.isArray(answer)) return 0;
      const got = new Set(answer.filter((x): x is string => typeof x === 'string'));
      const want = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
      if (want.size === 0) return 0;
      const hits = [...got].filter((id) => want.has(id)).length;
      const wrong = got.size - hits;
      // кожен зайвий вибір «з'їдає» один вірний, щоб не вигравало «відмітити все»
      return Math.max(0, hits - wrong) / want.size;
    }
    case 'matching': {
      if (typeof answer !== 'object' || Array.isArray(answer) || q.options.length === 0) return 0;
      const map = answer as Record<string, unknown>;
      const hits = q.options.filter((o) => map[o.id] === rightToken(attemptId, o.id)).length;
      return hits / q.options.length;
    }
    default: {
      if (typeof answer !== 'string') return 0;
      const acc = parseAccepted(q.accepted);
      if (!acc) return 0;
      if (acc.kind === 'number') {
        const given = parseNumber(answer);
        if (given === null) return 0;
        const tol = (acc.tolerance ?? 0) + 1e-9;
        return acc.answers.some((a) => {
          const n = parseNumber(a);
          return n !== null && Math.abs(n - given) <= tol;
        })
          ? 1
          : 0;
      }
      const given = normalizeText(answer);
      return acc.answers.some((a) => normalizeText(a) === given) ? 1 : 0;
    }
  }
}

export function gradeAnswer(q: GradedQuestion, attemptId: string, answer: unknown): boolean {
  return gradeFraction(q, attemptId, answer) >= 1;
}

// Бали за питання: часткова відповідь дає менше за повну, але не менше 0
export function pointsFor(q: GradedQuestion & { points: number }, attemptId: string, answer: unknown): number {
  const f = gradeFraction(q, attemptId, answer);
  if (f >= 1) return q.points;
  return Math.min(Math.max(q.points - 1, 0), Math.round(f * q.points));
}

// Перевіряє форму відповіді і приводить її до вигляду для збереження (null = очистити)
export function normalizeAnswer(
  q: GradedQuestion,
  attemptId: string,
  answer: unknown,
): Prisma.InputJsonValue | null {
  if (answer === null || answer === undefined) return null;
  const ids = new Set(q.options.map((o) => o.id));
  const bad = () => new BadRequestException('Некоректна відповідь');

  switch (q.type) {
    case 'single': {
      if (answer === '') return null;
      if (typeof answer !== 'string' || !ids.has(answer)) throw bad();
      return answer;
    }
    case 'multiple': {
      if (!Array.isArray(answer)) throw bad();
      const list = [...new Set(answer)];
      if (!list.every((x) => typeof x === 'string' && ids.has(x))) throw bad();
      return list.length > 0 ? (list as string[]) : null;
    }
    case 'matching': {
      if (typeof answer !== 'object' || Array.isArray(answer)) throw bad();
      const tokens = new Set(q.options.map((o) => rightToken(attemptId, o.id)));
      const out: Record<string, string> = {};
      for (const [left, right] of Object.entries(answer as Record<string, unknown>)) {
        if (right === '' || right === null) continue;
        if (!ids.has(left) || typeof right !== 'string' || !tokens.has(right)) throw bad();
        out[left] = right;
      }
      return Object.keys(out).length > 0 ? out : null;
    }
    default: {
      if (typeof answer !== 'string') throw bad();
      const text = answer.trim().slice(0, 200);
      return text ? text : null;
    }
  }
}

const byPosition = (options: Opt[]) => [...options].sort((a, b) => a.position - b.position);

// Відповідь користувача текстом (для перегляду керівником)
export function describeAnswer(q: GradedQuestion, attemptId: string, answer: unknown): string {
  if (answer === null || answer === undefined || answer === '') return '— (без відповіді)';
  const opts = byPosition(q.options);

  switch (q.type) {
    case 'single':
      return opts.find((o) => o.id === answer)?.label ?? '—';
    case 'multiple':
      return Array.isArray(answer)
        ? opts
            .filter((o) => answer.includes(o.id))
            .map((o) => o.label)
            .join('; ') || '—'
        : '—';
    case 'matching': {
      const map = (
        typeof answer === 'object' && !Array.isArray(answer) ? answer : {}
      ) as Record<string, unknown>;
      return opts
        .map((o) => {
          const right = opts.find((x) => rightToken(attemptId, x.id) === map[o.id]);
          return `${o.label} → ${right?.matchLabel ?? '—'}`;
        })
        .join('\n');
    }
    default:
      return typeof answer === 'string' ? answer : String(answer);
  }
}

export function describeCorrect(q: GradedQuestion): string {
  const opts = byPosition(q.options);
  switch (q.type) {
    case 'single':
    case 'multiple':
      return opts
        .filter((o) => o.isCorrect)
        .map((o) => o.label)
        .join('; ');
    case 'matching':
      return opts.map((o) => `${o.label} → ${o.matchLabel ?? ''}`).join('\n');
    default: {
      const acc = parseAccepted(q.accepted);
      if (!acc) return '—';
      const tol = acc.kind === 'number' && acc.tolerance ? ` (± ${acc.tolerance})` : '';
      return `${acc.answers.join(' / ')}${tol}`;
    }
  }
}