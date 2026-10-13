export type MyStatus = 'not_started' | 'in_progress' | 'passed' | 'failed' | 'overdue';

// Статус тесту для користувача
export function computeStatus(
  test: { deadline: Date | null; maxAttempts: number },
  attempts: { status: string; passed: boolean | null }[],
  now: Date,
): MyStatus {
  const done = attempts.filter((a) => a.status === 'completed');
  if (done.some((a) => a.passed)) return 'passed';
  if (test.maxAttempts > 0 && done.length >= test.maxAttempts) return 'failed';
  if (test.deadline && test.deadline <= now) return 'overdue';
  if (attempts.length > 0) return 'in_progress';
  return 'not_started';
}