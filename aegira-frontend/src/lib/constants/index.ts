/**
 * Centralized application constants
 * Single source of truth for hardcoded values used across the app
 */

/**
 * Pagination configuration
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 30, 50, 100],
  MIN_PAGE: 1,
} as const;

/**
 * Day names (0 = Sunday, 6 = Saturday)
 */
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Short day names
 */
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Work day mapping (1 = Monday, 7 = Sunday)
 * Used in team schedules and check-in configuration
 */
export const WORK_DAY_MAP: Record<string, string> = {
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday',
  '7': 'Sunday',
};

/**
 * Month names (full)
 */
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Short month names (for charts)
 */
export const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Date formatting patterns
 */
export const DATE_FORMATS = {
  DISPLAY: 'MMM d, yyyy',          // Jan 1, 2026
  DISPLAY_SHORT: 'MM/dd/yyyy',     // 01/01/2026
  DISPLAY_LONG: 'MMMM d, yyyy',    // January 1, 2026
  TIME_12H: 'h:mm a',              // 1:30 PM
  TIME_24H: 'HH:mm',               // 13:30
  DATETIME: 'MMM d, yyyy h:mm a',  // Jan 1, 2026 1:30 PM
  ISO: 'yyyy-MM-dd',               // 2026-01-01
} as const;

/**
 * Query stale times (from query.config.ts - for reference)
 */
export const STALE_TIMES = {
  REALTIME: 30 * 1000,      // 30 seconds
  STANDARD: 2 * 60 * 1000,  // 2 minutes
  STATIC: 10 * 60 * 1000,   // 10 minutes
  IMMUTABLE: 30 * 60 * 1000, // 30 minutes
} as const;

/**
 * Common time durations in milliseconds
 */
export const DURATION = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Default time values for check-in schedules
 */
export const DEFAULT_CHECK_IN_TIMES = {
  START: '06:00',
  END: '10:00',
} as const;

/**
 * Analytics period options
 */
export const ANALYTICS_PERIODS = {
  WEEK: '7d',
  MONTH: '30d',
  QUARTER: '90d',
} as const;

/**
 * File upload constraints
 */
export const FILE_UPLOAD = {
  MAX_SIZE_MB: 5,
  MAX_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword'],
} as const;

/**
 * Validation constraints
 */
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 1000,
} as const;

/**
 * Common regex patterns
 */
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  TIME_24H: /^([01]\d|2[0-3]):([0-5]\d)$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
} as const;
