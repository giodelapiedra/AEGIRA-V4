import { DateTime } from 'luxon';

/**
 * Format date to display string
 */
export function formatDate(date: string | Date, format = 'MMM dd, yyyy'): string {
  const dt = typeof date === 'string' ? DateTime.fromISO(date) : DateTime.fromJSDate(date);
  return dt.toFormat(format);
}

/**
 * Format date with time
 */
export function formatDateTime(date: string | Date, format = 'MMM dd, yyyy HH:mm'): string {
  const dt = typeof date === 'string' ? DateTime.fromISO(date) : DateTime.fromJSDate(date);
  return dt.toFormat(format);
}

/**
 * Format time only (e.g., "10:07 AM")
 */
export function formatTime(date: string | Date, format = 'h:mm a'): string {
  const dt = typeof date === 'string' ? DateTime.fromISO(date) : DateTime.fromJSDate(date);
  return dt.toFormat(format);
}

/**
 * Get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(date: string | Date): string {
  const dt = typeof date === 'string' ? DateTime.fromISO(date) : DateTime.fromJSDate(date);
  return dt.toRelative() || '';
}
