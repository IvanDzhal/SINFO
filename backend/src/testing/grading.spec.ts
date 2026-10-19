// grading.ts підтягує Nest і Prisma лише заради типів/винятків; для розрахунку балів вони не потрібні
jest.mock('@nestjs/common', () => ({ BadRequestException: class extends Error {} }));
jest.mock('@prisma/client', () => ({ Prisma: {} }));
jest.mock('../config/secrets', () => ({ signingSecret: () => 'test' }));

import { pointsFor, type GradedQuestion } from './grading';

const opt = (id: string, isCorrect: boolean) => ({
  id,
  label: id,
  matchLabel: null,
  isCorrect,
  position: 0,
});

const q: GradedQuestion & { points: number } = {
  id: 'q',
  type: 'multiple',
  accepted: null,
  points: 5,
  options: [opt('a', true), opt('b', true), opt('c', true), opt('d', false)],
};

describe('pointsFor (multiple)', () => {
  it('gives full points for a fully correct answer', () => {
    expect(pointsFor(q, 'att', ['a', 'b', 'c'])).toBe(5);
  });
  it('gives partial points for 2 of 3 correct', () => {
    expect(pointsFor(q, 'att', ['a', 'b'])).toBe(3);
  });
  it('penalises wrong picks', () => {
    expect(pointsFor(q, 'att', ['a', 'b', 'd'])).toBe(2);
    expect(pointsFor(q, 'att', ['a', 'b', 'c', 'd'])).toBe(3);
  });
  it('gives zero for nothing or only wrong picks', () => {
    expect(pointsFor(q, 'att', [])).toBe(0);
    expect(pointsFor(q, 'att', ['d'])).toBe(0);
  });
});
