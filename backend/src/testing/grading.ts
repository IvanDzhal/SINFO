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
    .update(`${process.env.JWT_ACCESS_SECRET ?? 'dev'}:${attemptId}:${optionId}`)
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

export function gradeAnswer(q: GradedQuestion, attemptId: string, answer: unknown): boolean {
  if (answer === null || answer === undefined) return false;

  switch (q.type) {
    case 'single': {
      const picked = q.options.find((o) => o.id === answer);
      return !!picked && picked.isCorrect;
    }
    case 'multiple': {
      if (!Array.isArray(answer)) return false;
      const got = new Set(answer.filter((x): x is string => typeof x === 'string'));
      const want = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
      return got.size === want.size && [...want].every((id) => got.has(id));
    }
    case 'matching': {
      if (typeof answer !== 'object' || Array.isArray(answer)) return false;
      const map = answer as Record<string, unknown>;
      return (
        q.options.length > 0 &&
        Object.keys(map).length === q.options.length &&
        q.options.every((o) => map[o.id] === rightToken(attemptId, o.id))
      );
    }
    default: {
      if (typeof answer !== 'string') return false;
      const acc = parseAccepted(q.accepted);
      if (!acc) return false;
      if (acc.kind === 'number') {
        const given = parseNumber(answer);
        if (given === null) return false;
        const tol = (acc.tolerance ?? 0) + 1e-9;
        return acc.answers.some((a) => {
          const n = parseNumber(a);
          return n !== null && Math.abs(n - given) <= tol;
        });
      }
      const given = normalizeText(answer);
      return acc.answers.some((a) => normalizeText(a) === given);
    }
  }
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