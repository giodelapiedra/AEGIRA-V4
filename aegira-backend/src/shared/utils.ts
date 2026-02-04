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
 * Gets current DateTime in company timezone
 */
export function nowInTimezone(timezone: string): DateTime {
  return DateTime.now().setZone(timezone);
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
 * Check if a time (HH:mm) is within a window.
 * Supports cross-midnight windows (e.g., "22:00" to "06:00").
 */
export function isTimeWithinWindow(
  currentTime: string,
  windowStart: string,
  windowEnd: string
): boolean {
  if (windowStart <= windowEnd) {
    // Normal window (e.g., 06:00 to 10:00)
    return currentTime >= windowStart && currentTime <= windowEnd;
  }
  // Cross-midnight window (e.g., 22:00 to 06:00)
  return currentTime >= windowStart || currentTime <= windowEnd;
}

/**
 * Gets start of day in company timezone (as UTC)
 */
export function startOfDayUtc(date: Date, timezone: string): Date {
  return DateTime.fromJSDate(date, { zone: 'UTC' })
    .setZone(timezone)
    .startOf('day')
    .toUTC()
    .toJSDate();
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
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
