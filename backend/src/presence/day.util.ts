const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' });

// Календарна дата за київським часом як UTC-північ (для колонок типу DATE)
export function kyivDay(date: Date = new Date()): Date {
  return new Date(`${fmt.format(date)}T00:00:00Z`);
}

export function addDays(day: Date, n: number): Date {
  return new Date(day.getTime() + n * 86_400_000);
}
