import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Settings } from 'luxon';
import {
  getTodayInTimezone,
  getCurrentTimeInTimezone,
  getDayOfWeekInTimezone,
  parseDateInTimezone,
  formatDateInTimezone,
  formatTime12h,
  calculateAge,
  daysBetweenDateStrings,
  precomputeDateRange,
  buildDateLookup,
} from '../../../src/shared/utils';

// Helper to freeze time at a specific UTC instant
function freezeTime(isoUtc: string): void {
  const ms = new Date(isoUtc).getTime();
  Settings.now = () => ms;
}

afterEach(() => {
  Settings.now = () => Date.now();
});

// ─── getTodayInTimezone ───────────────────────────────────────────────────────

describe('getTodayInTimezone', () => {
  it('returns correct date for positive offset (UTC+8)', () => {
    // 2026-02-20 20:00 UTC = 2026-02-21 04:00 in Manila (UTC+8)
    freezeTime('2026-02-20T20:00:00.000Z');
    expect(getTodayInTimezone('Asia/Manila')).toBe('2026-02-21');
  });

  it('returns correct date for negative offset (UTC-5)', () => {
    // 2026-02-21 03:00 UTC = 2026-02-20 22:00 in New York (UTC-5)
    freezeTime('2026-02-21T03:00:00.000Z');
    expect(getTodayInTimezone('America/New_York')).toBe('2026-02-20');
  });

  it('returns correct date at UTC midnight', () => {
    freezeTime('2026-02-21T00:00:00.000Z');
    expect(getTodayInTimezone('UTC')).toBe('2026-02-21');
  });

  it('handles UTC+13 (Pacific/Tongatapu) crossing date line', () => {
    // 2026-02-20 10:00 UTC = 2026-02-20 23:00 in Tonga (UTC+13)
    freezeTime('2026-02-20T10:00:00.000Z');
    expect(getTodayInTimezone('Pacific/Tongatapu')).toBe('2026-02-20');

    // 2026-02-20 12:00 UTC = 2026-02-21 01:00 in Tonga
    freezeTime('2026-02-20T12:00:00.000Z');
    expect(getTodayInTimezone('Pacific/Tongatapu')).toBe('2026-02-21');
  });

  it('handles UTC-10 (Pacific/Honolulu)', () => {
    // 2026-02-21 08:00 UTC = 2026-02-20 22:00 in Hawaii
    freezeTime('2026-02-21T08:00:00.000Z');
    expect(getTodayInTimezone('Pacific/Honolulu')).toBe('2026-02-20');
  });
});

// ─── getCurrentTimeInTimezone ─────────────────────────────────────────────────

describe('getCurrentTimeInTimezone', () => {
  it('returns zero-padded HH:mm for Manila', () => {
    // 2026-02-21 00:30 UTC = 08:30 in Manila
    freezeTime('2026-02-21T00:30:00.000Z');
    expect(getCurrentTimeInTimezone('Asia/Manila')).toBe('08:30');
  });

  it('returns midnight as 00:00', () => {
    // 2026-02-21 16:00 UTC = 00:00 Feb 22 in Manila
    freezeTime('2026-02-21T16:00:00.000Z');
    expect(getCurrentTimeInTimezone('Asia/Manila')).toBe('00:00');
  });

  it('returns 23:59 at end of day', () => {
    // 2026-02-21 15:59 UTC = 23:59 in Manila
    freezeTime('2026-02-21T15:59:00.000Z');
    expect(getCurrentTimeInTimezone('Asia/Manila')).toBe('23:59');
  });

  it('returns correct time for UTC timezone', () => {
    freezeTime('2026-02-21T14:30:00.000Z');
    expect(getCurrentTimeInTimezone('UTC')).toBe('14:30');
  });
});

// ─── getDayOfWeekInTimezone ───────────────────────────────────────────────────

describe('getDayOfWeekInTimezone', () => {
  it('returns 0 for Sunday', () => {
    // 2026-02-22 is a Sunday
    freezeTime('2026-02-22T04:00:00.000Z'); // 12:00 Manila
    expect(getDayOfWeekInTimezone('Asia/Manila')).toBe(0);
  });

  it('returns 1 for Monday', () => {
    // 2026-02-23 is a Monday
    freezeTime('2026-02-23T04:00:00.000Z');
    expect(getDayOfWeekInTimezone('Asia/Manila')).toBe(1);
  });

  it('returns 6 for Saturday', () => {
    // 2026-02-21 is a Saturday
    freezeTime('2026-02-21T04:00:00.000Z');
    expect(getDayOfWeekInTimezone('Asia/Manila')).toBe(6);
  });

  it('handles day boundary across timezone', () => {
    // 2026-02-21 23:00 UTC = 2026-02-22 07:00 Manila (Sunday)
    freezeTime('2026-02-21T23:00:00.000Z');
    expect(getDayOfWeekInTimezone('Asia/Manila')).toBe(0); // Sunday
    expect(getDayOfWeekInTimezone('UTC')).toBe(6); // Still Saturday in UTC
  });

  it('accepts optional date string parameter', () => {
    expect(getDayOfWeekInTimezone('Asia/Manila', '2026-02-22')).toBe(0); // Sunday
    expect(getDayOfWeekInTimezone('Asia/Manila', '2026-02-23')).toBe(1); // Monday
  });
});

// ─── parseDateInTimezone ──────────────────────────────────────────────────────

describe('parseDateInTimezone', () => {
  it('returns UTC midnight for Manila timezone', () => {
    const result = parseDateInTimezone('2026-02-21', 'Asia/Manila');
    expect(result.toISOString()).toBe('2026-02-21T00:00:00.000Z');
  });

  it('returns UTC midnight regardless of timezone offset', () => {
    const manila = parseDateInTimezone('2026-02-21', 'Asia/Manila');
    const ny = parseDateInTimezone('2026-02-21', 'America/New_York');
    const utc = parseDateInTimezone('2026-02-21', 'UTC');

    // All should produce the same UTC midnight for the same calendar date
    expect(manila.toISOString()).toBe('2026-02-21T00:00:00.000Z');
    expect(ny.toISOString()).toBe('2026-02-21T00:00:00.000Z');
    expect(utc.toISOString()).toBe('2026-02-21T00:00:00.000Z');
  });

  it('preserves calendar date for year boundary', () => {
    const result = parseDateInTimezone('2026-01-01', 'Asia/Manila');
    expect(result.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('preserves calendar date for leap year Feb 29', () => {
    const result = parseDateInTimezone('2024-02-29', 'Asia/Manila');
    expect(result.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });
});

// ─── formatDateInTimezone ─────────────────────────────────────────────────────

describe('formatDateInTimezone', () => {
  it('converts UTC to next day for positive offset at late UTC hours', () => {
    // 2026-02-21 20:00 UTC = 2026-02-22 04:00 Manila
    const date = new Date('2026-02-21T20:00:00.000Z');
    expect(formatDateInTimezone(date, 'Asia/Manila')).toBe('2026-02-22');
  });

  it('converts UTC to same day for UTC midnight dates', () => {
    const date = new Date('2026-02-21T00:00:00.000Z');
    expect(formatDateInTimezone(date, 'Asia/Manila')).toBe('2026-02-21');
  });

  it('converts UTC to previous day for negative offset at early UTC hours', () => {
    // 2026-02-21 03:00 UTC = 2026-02-20 22:00 New York
    const date = new Date('2026-02-21T03:00:00.000Z');
    expect(formatDateInTimezone(date, 'America/New_York')).toBe('2026-02-20');
  });
});

// ─── formatTime12h ────────────────────────────────────────────────────────────

describe('formatTime12h', () => {
  it('converts morning times', () => {
    expect(formatTime12h('06:00')).toBe('6:00 AM');
    expect(formatTime12h('09:30')).toBe('9:30 AM');
  });

  it('converts afternoon/evening times', () => {
    expect(formatTime12h('13:00')).toBe('1:00 PM');
    expect(formatTime12h('18:00')).toBe('6:00 PM');
    expect(formatTime12h('23:59')).toBe('11:59 PM');
  });

  it('handles noon correctly', () => {
    expect(formatTime12h('12:00')).toBe('12:00 PM');
    expect(formatTime12h('12:30')).toBe('12:30 PM');
  });

  it('handles midnight correctly', () => {
    expect(formatTime12h('00:00')).toBe('12:00 AM');
    expect(formatTime12h('00:30')).toBe('12:30 AM');
  });

  it('handles 1 AM correctly', () => {
    expect(formatTime12h('01:00')).toBe('1:00 AM');
  });
});

// ─── calculateAge ─────────────────────────────────────────────────────────────

describe('calculateAge', () => {
  it('returns null for null date of birth', () => {
    expect(calculateAge(null, 'Asia/Manila')).toBeNull();
  });

  it('calculates age correctly when birthday has passed this year', () => {
    // DOB: 2000-01-15, Current date in tz: 2026-02-21
    freezeTime('2026-02-21T04:00:00.000Z'); // Feb 21 in Manila
    const dob = new Date('2000-01-15T00:00:00.000Z');
    expect(calculateAge(dob, 'Asia/Manila')).toBe(26);
  });

  it('calculates age correctly when birthday has NOT passed this year', () => {
    // DOB: 2000-06-15, Current date in tz: 2026-02-21
    freezeTime('2026-02-21T04:00:00.000Z');
    const dob = new Date('2000-06-15T00:00:00.000Z');
    expect(calculateAge(dob, 'Asia/Manila')).toBe(25);
  });

  it('handles birthday today (in timezone)', () => {
    // DOB: 2000-02-21, Current date in tz: 2026-02-21
    freezeTime('2026-02-21T04:00:00.000Z');
    const dob = new Date('2000-02-21T00:00:00.000Z');
    expect(calculateAge(dob, 'Asia/Manila')).toBe(26);
  });

  it('timezone-aware: still yesterday in one tz, today in another', () => {
    // DOB: 2000-02-22
    // UTC: 2026-02-21T20:00 → Manila: 2026-02-22 04:00 (birthday) vs NY: 2026-02-21 15:00 (not yet)
    freezeTime('2026-02-21T20:00:00.000Z');
    const dob = new Date('2000-02-22T00:00:00.000Z');
    expect(calculateAge(dob, 'Asia/Manila')).toBe(26); // Birthday has arrived
    expect(calculateAge(dob, 'America/New_York')).toBe(25); // Not yet
  });
});

// ─── daysBetweenDateStrings ───────────────────────────────────────────────────

describe('daysBetweenDateStrings', () => {
  it('returns 0 for same date', () => {
    expect(daysBetweenDateStrings('2026-02-21', '2026-02-21')).toBe(0);
  });

  it('returns 1 for adjacent dates', () => {
    expect(daysBetweenDateStrings('2026-02-20', '2026-02-21')).toBe(1);
  });

  it('returns correct count for multi-day span', () => {
    expect(daysBetweenDateStrings('2026-02-01', '2026-02-21')).toBe(20);
  });

  it('order does not matter (absolute difference)', () => {
    expect(daysBetweenDateStrings('2026-02-21', '2026-02-01')).toBe(20);
  });

  it('handles month boundary', () => {
    expect(daysBetweenDateStrings('2026-01-31', '2026-02-01')).toBe(1);
  });

  it('handles year boundary', () => {
    expect(daysBetweenDateStrings('2025-12-31', '2026-01-01')).toBe(1);
  });
});

// ─── precomputeDateRange ──────────────────────────────────────────────────────

describe('precomputeDateRange', () => {
  it('generates correct number of dates', () => {
    const start = new Date('2026-02-01T00:00:00.000Z');
    const result = precomputeDateRange(start, 7, 'Asia/Manila');
    expect(result).toHaveLength(7);
  });

  it('generates sequential dates', () => {
    const start = new Date('2026-02-01T00:00:00.000Z');
    const result = precomputeDateRange(start, 3, 'Asia/Manila');
    expect(result[0].dateStr).toBe('2026-02-01');
    expect(result[1].dateStr).toBe('2026-02-02');
    expect(result[2].dateStr).toBe('2026-02-03');
  });

  it('computes correct day-of-week strings', () => {
    // 2026-02-22 is Sunday → "0"
    const start = new Date('2026-02-22T00:00:00.000Z');
    const result = precomputeDateRange(start, 1, 'Asia/Manila');
    expect(result[0].dow).toBe('0');
  });

  it('returns UTC midnight Date objects', () => {
    const start = new Date('2026-02-01T00:00:00.000Z');
    const result = precomputeDateRange(start, 1, 'Asia/Manila');
    expect(result[0].date.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});

// ─── buildDateLookup ──────────────────────────────────────────────────────────

describe('buildDateLookup', () => {
  it('maps Date.getTime() to YYYY-MM-DD strings', () => {
    const dates = [
      new Date('2026-02-21T00:00:00.000Z'),
      new Date('2026-02-22T00:00:00.000Z'),
    ];
    const lookup = buildDateLookup(dates, 'Asia/Manila');
    expect(lookup.get(dates[0].getTime())).toBe('2026-02-21');
    expect(lookup.get(dates[1].getTime())).toBe('2026-02-22');
  });

  it('deduplicates same timestamps', () => {
    const d = new Date('2026-02-21T00:00:00.000Z');
    const lookup = buildDateLookup([d, d, d], 'Asia/Manila');
    expect(lookup.size).toBe(1);
  });
});
