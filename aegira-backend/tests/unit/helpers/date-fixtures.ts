export const FIXED_NOW_UTC = new Date('2026-02-21T10:00:00.000Z');

export function isoDateSequence(startIsoDate: string, days: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startIsoDate}T00:00:00.000Z`);

  for (let i = 0; i < days; i += 1) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

