import { describe, it, expect } from 'vitest';
import {
  getEffectiveSchedule,
  isWorkDay,
  isEndTimeAfterStart,
  TIME_REGEX,
  WORK_DAYS_REGEX,
} from '../../../src/shared/schedule.utils';
import type { PersonSchedule, TeamSchedule } from '../../../src/shared/schedule.utils';

// Default team schedule for tests
const defaultTeam: TeamSchedule = {
  work_days: '1,2,3,4,5',
  check_in_start: '06:00',
  check_in_end: '10:00',
};

const nullPerson: PersonSchedule = {
  work_days: null,
  check_in_start: null,
  check_in_end: null,
};

// ─── isEndTimeAfterStart ──────────────────────────────────────────────────────

describe('isEndTimeAfterStart', () => {
  it('returns true for normal range', () => {
    expect(isEndTimeAfterStart('06:00', '10:00')).toBe(true);
  });

  it('returns true for 1-minute range', () => {
    expect(isEndTimeAfterStart('09:59', '10:00')).toBe(true);
  });

  it('returns false for equal times', () => {
    expect(isEndTimeAfterStart('10:00', '10:00')).toBe(false);
  });

  it('returns false for inverted range', () => {
    expect(isEndTimeAfterStart('10:00', '06:00')).toBe(false);
  });

  it('works with midnight boundaries', () => {
    expect(isEndTimeAfterStart('00:00', '23:59')).toBe(true);
    expect(isEndTimeAfterStart('23:59', '00:00')).toBe(false);
  });
});

// ─── getEffectiveSchedule ─────────────────────────────────────────────────────

describe('getEffectiveSchedule', () => {
  it('uses team defaults when worker has no overrides', () => {
    const result = getEffectiveSchedule(nullPerson, defaultTeam);
    expect(result).toEqual({
      workDays: ['1', '2', '3', '4', '5'],
      checkInStart: '06:00',
      checkInEnd: '10:00',
    });
  });

  it('uses full worker override when all fields set', () => {
    const person: PersonSchedule = {
      work_days: '1,3,5',
      check_in_start: '07:00',
      check_in_end: '09:00',
    };
    const result = getEffectiveSchedule(person, defaultTeam);
    expect(result).toEqual({
      workDays: ['1', '3', '5'],
      checkInStart: '07:00',
      checkInEnd: '09:00',
    });
  });

  it('uses partial override — only work_days from worker', () => {
    const person: PersonSchedule = {
      work_days: '1,3,5',
      check_in_start: null,
      check_in_end: null,
    };
    const result = getEffectiveSchedule(person, defaultTeam);
    expect(result).toEqual({
      workDays: ['1', '3', '5'],
      checkInStart: '06:00',
      checkInEnd: '10:00',
    });
  });

  it('uses partial override — only times from worker', () => {
    const person: PersonSchedule = {
      work_days: null,
      check_in_start: '07:00',
      check_in_end: '09:00',
    };
    const result = getEffectiveSchedule(person, defaultTeam);
    expect(result).toEqual({
      workDays: ['1', '2', '3', '4', '5'],
      checkInStart: '07:00',
      checkInEnd: '09:00',
    });
  });

  it('falls back to team window when partial override creates inverted window', () => {
    // Worker overrides only check_in_start to a time after team's check_in_end
    const person: PersonSchedule = {
      work_days: null,
      check_in_start: '11:00', // After team's 10:00 end
      check_in_end: null,      // Falls back to team's 10:00
    };
    // Effective: start=11:00, end=10:00 → inverted!
    const result = getEffectiveSchedule(person, defaultTeam);
    // Should fall back to team's times
    expect(result.checkInStart).toBe('06:00');
    expect(result.checkInEnd).toBe('10:00');
    // But work days still use worker's override (which is null → team)
    expect(result.workDays).toEqual(['1', '2', '3', '4', '5']);
  });

  it('falls back to team window when worker overrides end before start', () => {
    const person: PersonSchedule = {
      work_days: '1,2,3',
      check_in_start: '10:00',
      check_in_end: '06:00', // Before start — inverted
    };
    const result = getEffectiveSchedule(person, defaultTeam);
    // Times fall back, but work days come from worker
    expect(result.workDays).toEqual(['1', '2', '3']);
    expect(result.checkInStart).toBe('06:00');
    expect(result.checkInEnd).toBe('10:00');
  });

  it('handles weekend-only schedule', () => {
    const person: PersonSchedule = {
      work_days: '0,6', // Sunday + Saturday
      check_in_start: null,
      check_in_end: null,
    };
    const result = getEffectiveSchedule(person, defaultTeam);
    expect(result.workDays).toEqual(['0', '6']);
  });

  it('handles all-days schedule', () => {
    const person: PersonSchedule = {
      work_days: '0,1,2,3,4,5,6',
      check_in_start: null,
      check_in_end: null,
    };
    const result = getEffectiveSchedule(person, defaultTeam);
    expect(result.workDays).toHaveLength(7);
  });
});

// ─── isWorkDay ────────────────────────────────────────────────────────────────

describe('isWorkDay', () => {
  it('Monday is a work day with default Mon-Fri schedule', () => {
    expect(isWorkDay('1', nullPerson, defaultTeam)).toBe(true);
  });

  it('Friday is a work day with default Mon-Fri schedule', () => {
    expect(isWorkDay('5', nullPerson, defaultTeam)).toBe(true);
  });

  it('Saturday is NOT a work day with default Mon-Fri schedule', () => {
    expect(isWorkDay('6', nullPerson, defaultTeam)).toBe(false);
  });

  it('Sunday is NOT a work day with default Mon-Fri schedule', () => {
    expect(isWorkDay('0', nullPerson, defaultTeam)).toBe(false);
  });

  it('worker override includes Saturday', () => {
    const person: PersonSchedule = {
      work_days: '1,2,3,4,5,6',
      check_in_start: null,
      check_in_end: null,
    };
    expect(isWorkDay('6', person, defaultTeam)).toBe(true);
  });

  it('worker override excludes Tuesday', () => {
    const person: PersonSchedule = {
      work_days: '1,3,5',
      check_in_start: null,
      check_in_end: null,
    };
    expect(isWorkDay('2', person, defaultTeam)).toBe(false);
    expect(isWorkDay('3', person, defaultTeam)).toBe(true);
  });

  it('Sunday-only schedule', () => {
    const person: PersonSchedule = {
      work_days: '0',
      check_in_start: null,
      check_in_end: null,
    };
    expect(isWorkDay('0', person, defaultTeam)).toBe(true);
    expect(isWorkDay('1', person, defaultTeam)).toBe(false);
  });
});

// ─── Regex Validation ─────────────────────────────────────────────────────────

describe('TIME_REGEX', () => {
  it('matches valid times', () => {
    expect(TIME_REGEX.test('00:00')).toBe(true);
    expect(TIME_REGEX.test('06:30')).toBe(true);
    expect(TIME_REGEX.test('12:00')).toBe(true);
    expect(TIME_REGEX.test('23:59')).toBe(true);
  });

  it('rejects invalid times', () => {
    expect(TIME_REGEX.test('24:00')).toBe(false);
    expect(TIME_REGEX.test('6:00')).toBe(false);  // Not zero-padded
    expect(TIME_REGEX.test('12:60')).toBe(false);
    expect(TIME_REGEX.test('abc')).toBe(false);
    expect(TIME_REGEX.test('')).toBe(false);
  });
});

describe('WORK_DAYS_REGEX', () => {
  it('matches valid work day strings', () => {
    expect(WORK_DAYS_REGEX.test('1,2,3,4,5')).toBe(true);
    expect(WORK_DAYS_REGEX.test('0')).toBe(true);
    expect(WORK_DAYS_REGEX.test('0,1,2,3,4,5,6')).toBe(true);
  });

  it('rejects invalid work day strings', () => {
    expect(WORK_DAYS_REGEX.test('7')).toBe(false);
    expect(WORK_DAYS_REGEX.test('1,2,')).toBe(false);
    expect(WORK_DAYS_REGEX.test(',1,2')).toBe(false);
    expect(WORK_DAYS_REGEX.test('')).toBe(false);
  });
});
