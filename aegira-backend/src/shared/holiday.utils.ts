// Holiday Utility Functions
// Centralized holiday checking logic used by:
//   - missed-check-in-detector (skip holidays)
//   - check-in.service (block check-in on holidays, status)
//   - dashboard.service (streak, completion rate, schedule context)

import type { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { formatDateInTimezone } from './utils';

export interface HolidayCheck {
  isHoliday: boolean;
  holidayName: string | null;
}

/**
 * Check if a given date is a company holiday.
 * Handles both exact date holidays and recurring holidays (same month/day every year).
 */
export async function checkHolidayForDate(
  prisma: PrismaClient,
  companyId: string,
  dateStr: string,
): Promise<HolidayCheck> {
  const targetDate = new Date(`${dateStr}T00:00:00Z`);
  const targetMonth = targetDate.getUTCMonth() + 1; // 1-12
  const targetDay = targetDate.getUTCDate();

  // Check exact date match (non-recurring holidays)
  const exactHoliday = await prisma.holiday.findFirst({
    where: {
      company_id: companyId,
      date: targetDate,
      is_recurring: false,
    },
    select: { name: true },
  });

  if (exactHoliday) {
    return { isHoliday: true, holidayName: exactHoliday.name };
  }

  // Check recurring holidays (same month/day, any year)
  const recurringHolidays = await prisma.holiday.findMany({
    where: {
      company_id: companyId,
      is_recurring: true,
    },
    select: { name: true, date: true },
  });

  for (const holiday of recurringHolidays) {
    const hDate = new Date(holiday.date);
    if (hDate.getUTCMonth() + 1 === targetMonth && hDate.getUTCDate() === targetDay) {
      return { isHoliday: true, holidayName: holiday.name };
    }
  }

  return { isHoliday: false, holidayName: null };
}

/**
 * Convenience wrapper that returns just the boolean.
 */
export async function isHoliday(
  prisma: PrismaClient,
  companyId: string,
  dateStr: string,
): Promise<boolean> {
  const result = await checkHolidayForDate(prisma, companyId, dateStr);
  return result.isHoliday;
}

/**
 * Build a Set of holiday date strings ("YYYY-MM-DD") for a given date range.
 * Used by dashboard calculations (streak, completion rate) that need to check
 * multiple dates at once without repeated DB queries.
 *
 * PERFORMANCE: Uses separate queries for exact-date vs recurring holidays,
 * and pre-computes month/day lookup map to avoid O(n*m) nested loops.
 */
export async function buildHolidayDateSet(
  prisma: PrismaClient,
  companyId: string,
  startDate: Date,
  endDate: Date,
  timezone: string,
): Promise<Set<string>> {
  // Fetch holidays in parallel: exact dates within range + all recurring
  const [exactHolidays, recurringHolidays] = await Promise.all([
    prisma.holiday.findMany({
      where: {
        company_id: companyId,
        is_recurring: false,
        date: { gte: startDate, lte: endDate },
      },
      select: { date: true },
    }),
    prisma.holiday.findMany({
      where: {
        company_id: companyId,
        is_recurring: true,
      },
      select: { date: true },
    }),
  ]);

  const holidaySet = new Set<string>();

  // Add exact-date holidays directly (already filtered by date range)
  for (const h of exactHolidays) {
    holidaySet.add(formatDateInTimezone(new Date(h.date), timezone));
  }

  // Pre-compute recurring holiday month/day pairs as "MM-DD" for O(1) lookup
  const recurringMonthDays = new Set<string>();
  for (const h of recurringHolidays) {
    const hDt = DateTime.fromJSDate(new Date(h.date)).setZone(timezone);
    recurringMonthDays.add(`${String(hDt.month).padStart(2, '0')}-${String(hDt.day).padStart(2, '0')}`);
  }

  // Only check recurring if there are any
  if (recurringMonthDays.size > 0) {
    for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
      const dDt = DateTime.fromJSDate(d).setZone(timezone);
      const monthDay = `${String(dDt.month).padStart(2, '0')}-${String(dDt.day).padStart(2, '0')}`;

      if (recurringMonthDays.has(monthDay)) {
        holidaySet.add(formatDateInTimezone(d, timezone));
      }
    }
  }

  return holidaySet;
}
