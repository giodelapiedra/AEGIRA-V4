// Shared Utility Functions
import { DateTime } from 'luxon';
import type { PaginationParams, PaginatedResponse } from '../types/api.types';

/**
 * Converts a UTC date to company timezone
 */
export function toCompanyTimezone(date: Date, timezone: string): DateTime {
  return DateTime.fromJSDate(date, { zone: 'UTC' }).setZone(timezone);
}

/**
 * Gets today's date string (YYYY-MM-DD) in company timezone
 */
export function getTodayInTimezone(timezone: string): string {
  return DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd');
}

/**
 * Gets current time string (HH:mm) in company timezone
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  return DateTime.now().setZone(timezone).toFormat('HH:mm');
}

/**
 * Gets day of week (0=Sunday, 6=Saturday) in company timezone
 */
export function getDayOfWeekInTimezone(timezone: string, date?: string): number {
  const dt = date
    ? DateTime.fromISO(date, { zone: timezone })
    : DateTime.now().setZone(timezone);
  // Luxon weekday: 1=Monday, 7=Sunday, we need 0=Sunday, 6=Saturday
  return dt.weekday === 7 ? 0 : dt.weekday;
}

/**
 * Parse a date string (YYYY-MM-DD) and return as UTC midnight Date.
 * Parses in the specified timezone to ensure correct year/month/day extraction,
 * then stores as UTC midnight so the calendar date is preserved in the database.
 * Example: '2026-01-28' in 'Asia/Manila' → 2026-01-28T00:00:00.000Z
 */
export function parseDateInTimezone(dateStr: string, timezone: string): Date {
  const dt = DateTime.fromISO(dateStr, { zone: timezone });
  return new Date(Date.UTC(dt.year, dt.month - 1, dt.day));
}

/**
 * Get date string (YYYY-MM-DD) from a JS Date, converted to the company timezone.
 * This ensures real timestamps (e.g., team_assigned_at) resolve to the correct
 * calendar date in the company timezone. For UTC midnight dates (e.g., check_in_date),
 * the result is the same as extracting UTC components for positive-offset timezones.
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  return dt.toFormat('yyyy-MM-dd');
}

/**
 * Parses and clamps pagination query params.
 * Ensures page >= 1 and limit is between 1 and 100.
 */
export function parsePagination(
  pageParam?: string | null,
  limitParam?: string | null,
  defaultLimit = 20
): PaginationParams {
  return {
    page: clamp(Number(pageParam) || 1, 1, 10000),
    limit: clamp(Number(limitParam) || defaultLimit, 1, 100),
  };
}

/**
 * Calculates pagination skip value
 */
export function calculateSkip(params: PaginationParams): number {
  return (params.page - 1) * params.limit;
}

/**
 * Creates a paginated response
 */
export function paginate<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}

/**
 * Converts 24-hour time string (HH:mm) to 12-hour format with AM/PM.
 * "06:00" → "6:00 AM", "18:00" → "6:00 PM", "23:10" → "11:10 PM"
 */
export function formatTime12h(time24: string): string {
  const parts = time24.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const hours12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hours12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Calculate a person's age from their date of birth, timezone-aware.
 * Uses Luxon to get the current date in the company timezone so that
 * age doesn't flip a day early/late near midnight across timezones.
 */
export function calculateAge(dateOfBirth: Date | null, timezone: string): number | null {
  if (!dateOfBirth) return null;
  const now = DateTime.now().setZone(timezone);
  let age = now.year - dateOfBirth.getUTCFullYear();
  const monthDiff = now.month - (dateOfBirth.getUTCMonth() + 1);
  if (monthDiff < 0 || (monthDiff === 0 && now.day < dateOfBirth.getUTCDate())) {
    age--;
  }
  return age;
}

/**
 * Clamps a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Pre-compute date strings and day-of-week for a contiguous date range.
 * Creates Luxon DateTime objects once per day instead of per-iteration in loops.
 * Returns an array ordered from startDate forward (index 0 = startDate).
 *
 * @param startDate - Start of the range (inclusive)
 * @param days - Number of days to generate
 * @param timezone - Company timezone
 */
export interface PrecomputedDate {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dow: string;     // Day of week as string ("0"=Sun, "6"=Sat)
}

export function precomputeDateRange(
  startDate: Date,
  days: number,
  timezone: string
): PrecomputedDate[] {
  const result: PrecomputedDate[] = [];
  // Start a Luxon DateTime and increment by 1 day — avoids creating from scratch each iteration
  let dt = DateTime.fromJSDate(startDate).setZone(timezone).startOf('day');

  for (let i = 0; i < days; i++) {
    const dow = dt.weekday === 7 ? 0 : dt.weekday;
    result.push({
      date: new Date(Date.UTC(dt.year, dt.month - 1, dt.day)),
      dateStr: dt.toFormat('yyyy-MM-dd'),
      dow: dow.toString(),
    });
    dt = dt.plus({ days: 1 });
  }

  return result;
}

/**
 * Build a lookup map from JS Date (getTime()) to pre-computed date string.
 * Useful for mapping Prisma query results (which return Date objects) to
 * YYYY-MM-DD strings without per-record Luxon calls.
 */
export function buildDateLookup(
  dates: Date[],
  timezone: string
): Map<number, string> {
  const lookup = new Map<number, string>();
  for (const d of dates) {
    if (!lookup.has(d.getTime())) {
      const dt = DateTime.fromJSDate(d).setZone(timezone);
      lookup.set(d.getTime(), dt.toFormat('yyyy-MM-dd'));
    }
  }
  return lookup;
}

/**
 * Calculate days between two YYYY-MM-DD date strings using simple arithmetic.
 * Avoids creating Luxon DateTime objects — uses UTC Date parsing instead.
 */
export function daysBetweenDateStrings(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1 + 'T00:00:00Z');
  const d2 = new Date(dateStr2 + 'T00:00:00Z');
  return Math.abs(Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000)));
}
