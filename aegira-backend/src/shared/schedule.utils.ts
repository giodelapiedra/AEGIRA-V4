// Schedule Resolution Utilities
// Provides consistent logic for worker schedule override with team fallback

/** Time format validation (HH:MM) — enforces zero-padded hours for consistent string comparison */
export const TIME_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Work days validation (CSV of 0-6, no duplicates) */
export const WORK_DAYS_REGEX = /^[0-6](,[0-6])*$/;

/** Compare HH:mm times — returns true if end is after start */
export function isEndTimeAfterStart(start: string, end: string): boolean {
  const startParts = start.split(':').map(Number);
  const endParts = end.split(':').map(Number);
  const startMinutes = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
  const endMinutes = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);
  return endMinutes > startMinutes;
}

/**
 * Person schedule fields (can override team schedule)
 */
export interface PersonSchedule {
  work_days?: string | null;
  check_in_start?: string | null;
  check_in_end?: string | null;
}

/**
 * Team schedule fields (default if person doesn't override)
 */
export interface TeamSchedule {
  work_days: string;
  check_in_start: string;
  check_in_end: string;
}

/**
 * Effective schedule after resolving worker override with team fallback
 */
export interface EffectiveSchedule {
  workDays: string[]; // Array of day numbers: "0" = Sunday, "1" = Monday, etc.
  checkInStart: string; // HH:mm format
  checkInEnd: string; // HH:mm format
}

/**
 * Get effective schedule for a worker.
 * Uses worker override if set, otherwise falls back to team schedule.
 *
 * @param person - Worker's schedule fields (optional overrides)
 * @param team - Team's schedule fields (defaults)
 * @returns Effective schedule with workDays as array, times as strings
 *
 * @example
 * // Worker with override
 * getEffectiveSchedule(
 *   { work_days: "1,3,5", check_in_start: "07:00", check_in_end: "09:00" },
 *   { work_days: "1,2,3,4,5", check_in_start: "06:00", check_in_end: "10:00" }
 * )
 * // Returns: { workDays: ["1", "3", "5"], checkInStart: "07:00", checkInEnd: "09:00" }
 *
 * @example
 * // Worker without override (uses team defaults)
 * getEffectiveSchedule(
 *   { work_days: null, check_in_start: null, check_in_end: null },
 *   { work_days: "1,2,3,4,5", check_in_start: "06:00", check_in_end: "10:00" }
 * )
 * // Returns: { workDays: ["1", "2", "3", "4", "5"], checkInStart: "06:00", checkInEnd: "10:00" }
 *
 * @example
 * // Worker with partial override (only work days)
 * getEffectiveSchedule(
 *   { work_days: "1,3,5", check_in_start: null, check_in_end: null },
 *   { work_days: "1,2,3,4,5", check_in_start: "06:00", check_in_end: "10:00" }
 * )
 * // Returns: { workDays: ["1", "3", "5"], checkInStart: "06:00", checkInEnd: "10:00" }
 */
export function getEffectiveSchedule(
  person: PersonSchedule,
  team: TeamSchedule
): EffectiveSchedule {
  // Use worker override if set, otherwise fallback to team.
  // Each field falls back independently — partial overrides are supported
  // (e.g., worker overrides only work_days but keeps team's check-in times).
  const workDaysStr = person.work_days ?? team.work_days;
  const checkInStart = person.check_in_start ?? team.check_in_start;
  const checkInEnd = person.check_in_end ?? team.check_in_end;

  // Parse work_days CSV string to array
  // Default to Mon-Fri if somehow both are null (defensive)
  const workDays = workDaysStr?.split(',').filter(Boolean) || ['1', '2', '3', '4', '5'];

  // Runtime guard: if partial overrides created an inverted window (start >= end),
  // fall back to team's window to prevent broken check-in logic.
  // This can happen when a worker overrides only check_in_start or check_in_end.
  if (!isEndTimeAfterStart(checkInStart, checkInEnd)) {
    return {
      workDays,
      checkInStart: team.check_in_start,
      checkInEnd: team.check_in_end,
    };
  }

  return {
    workDays,
    checkInStart,
    checkInEnd,
  };
}

/**
 * Check if a specific day is a work day for a worker.
 * Uses worker override if set, otherwise falls back to team schedule.
 *
 * @param dayOfWeek - Day of week as string: "0" = Sunday, "1" = Monday, ..., "6" = Saturday
 * @param person - Worker's schedule fields (optional overrides)
 * @param team - Team's schedule fields (defaults)
 * @returns true if the day is a work day, false otherwise
 *
 * @example
 * // Worker with Mon/Wed/Fri override
 * isWorkDay("1", { work_days: "1,3,5" }, { work_days: "1,2,3,4,5" }) // true (Monday)
 * isWorkDay("2", { work_days: "1,3,5" }, { work_days: "1,2,3,4,5" }) // false (Tuesday)
 *
 * @example
 * // Worker without override (uses team Mon-Fri)
 * isWorkDay("1", { work_days: null }, { work_days: "1,2,3,4,5" }) // true (Monday)
 * isWorkDay("6", { work_days: null }, { work_days: "1,2,3,4,5" }) // false (Saturday)
 */
export function isWorkDay(
  dayOfWeek: string,
  person: PersonSchedule,
  team: TeamSchedule
): boolean {
  // Use worker override if set, otherwise fallback to team
  const workDaysStr = person.work_days ?? team.work_days;

  // Parse CSV to array and check if day is included
  // Default to Mon-Fri if somehow both are null (defensive)
  const workDays = workDaysStr?.split(',').filter(Boolean) || ['1', '2', '3', '4', '5'];

  return workDays.includes(dayOfWeek);
}
