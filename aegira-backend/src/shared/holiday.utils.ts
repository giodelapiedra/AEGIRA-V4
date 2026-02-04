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
 */
export async function buildHolidayDateSet(
  prisma: PrismaClient,
  companyId: string,
  startDate: Date,
  endDate: Date,
  timezone: string,
): Promise<Set<string>> {
  const holidays = await prisma.holiday.findMany({
    where: { company_id: companyId },
    select: { date: true, is_recurring: true },
  });

  const holidaySet = new Set<string>();

  for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    const dStr = formatDateInTimezone(d, timezone);
    // Extract month/day in company timezone (not UTC) for recurring holiday comparison
    const dDt = DateTime.fromJSDate(d).setZone(timezone);
    const dMonth = dDt.month;  // 1-12
    const dDay = dDt.day;

    for (const h of holidays) {
      const hDate = new Date(h.date);
      if (h.is_recurring) {
        // Recurring holidays match by month/day regardless of year
        const hDt = DateTime.fromJSDate(hDate).setZone(timezone);
        if (hDt.month === dMonth && hDt.day === dDay) {
          holidaySet.add(dStr);
        }
      } else {
        if (formatDateInTimezone(hDate, timezone) === dStr) {
          holidaySet.add(dStr);
        }
      }
    }
  }

  return holidaySet;
}
