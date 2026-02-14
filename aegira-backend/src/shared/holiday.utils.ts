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

// In-memory cache for holiday checks (1-hour TTL).
// Holidays are set up annually and rarely change intra-day.
// Bounded to MAX_CACHE_ENTRIES to prevent unbounded memory growth in long-running
// multi-tenant deployments (each company+date = one entry).
const HOLIDAY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_ENTRIES = 5000;
const holidayCache = new Map<string, { data: HolidayCheck; expiresAt: number }>();

/**
 * Check if a given date is a company holiday.
 * Handles both exact date holidays and recurring holidays (same month/day every year).
 * Results are cached in-memory for 1 hour per company+date.
 */
export async function checkHolidayForDate(
  prisma: PrismaClient,
  companyId: string,
  dateStr: string,
): Promise<HolidayCheck> {
  // Check cache first
  const cacheKey = `${companyId}:${dateStr}`;
  const cached = holidayCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Evict expired entries when cache exceeds size limit to prevent unbounded growth
  if (holidayCache.size >= MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of holidayCache) {
      if (entry.expiresAt <= now) holidayCache.delete(key);
    }
  }

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
    const result: HolidayCheck = { isHoliday: true, holidayName: exactHoliday.name };
    holidayCache.set(cacheKey, { data: result, expiresAt: Date.now() + HOLIDAY_CACHE_TTL_MS });
    return result;
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
      const result: HolidayCheck = { isHoliday: true, holidayName: holiday.name };
      holidayCache.set(cacheKey, { data: result, expiresAt: Date.now() + HOLIDAY_CACHE_TTL_MS });
      return result;
    }
  }

  const result: HolidayCheck = { isHoliday: false, holidayName: null };
  holidayCache.set(cacheKey, { data: result, expiresAt: Date.now() + HOLIDAY_CACHE_TTL_MS });
  return result;
}

/** Invalidate all cached holiday data for a company (call after admin CRUD on holidays) */
export function invalidateHolidayCache(companyId: string): void {
  for (const key of holidayCache.keys()) {
    if (key.startsWith(`${companyId}:`)) {
      holidayCache.delete(key);
    }
  }
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
