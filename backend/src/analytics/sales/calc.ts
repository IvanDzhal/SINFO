// Формули Sales Analytics (ANALYTICS §5.2, §8, §9). Єдине місце розрахунків.
// Усі функції чисті; відсутні/некоректні вхідні дані дають null, а не оманливий 0.

export const round1 = (n: number) => Math.round(n * 10) / 10;

// Виконання плану: Fact / Plan × 100. План 0 або невідомий — не визначено.
export function completion(fact: number | null, plan: number | null): number | null {
  if (fact === null || plan === null || plan <= 0) return null;
  return (fact / plan) * 100;
}

// Remaining = max(0, Plan − Fact)
export function remaining(fact: number | null, plan: number | null): number | null {
  if (fact === null || plan === null) return null;
  return Math.max(0, plan - fact);
}

// Ефективність: чисельник / знаменник × 100 (напр. Послуги / МТ)
export function efficiency(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den <= 0) return null;
  return (num / den) * 100;
}

// Прогноз за поточним темпом: fact / daysPassed × (daysPassed + daysLeft).
// Нуль пройдених днів або невідомий календар — прогнозу немає.
export function forecast(
  fact: number | null,
  daysPassed: number | null,
  daysLeft: number | null,
): number | null {
  if (fact === null || daysPassed === null || daysLeft === null) return null;
  if (daysPassed <= 0 || daysLeft < 0) return null;
  return (fact / daysPassed) * (daysPassed + daysLeft);
}

// Скільки треба продавати щодня, щоб закрити план
export function dailyNeed(rest: number | null, daysLeft: number | null): number | null {
  if (rest === null || daysLeft === null || daysLeft <= 0) return null;
  return rest / daysLeft;
}
