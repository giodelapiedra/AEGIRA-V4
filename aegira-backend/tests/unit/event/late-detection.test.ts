import { describe, it, expect, afterEach } from 'vitest';
import { Settings } from 'luxon';
import { buildEventData } from '../../../src/modules/event/event.service';

// Helper to freeze time
function freezeTime(isoUtc: string): void {
  const ms = new Date(isoUtc).getTime();
  Settings.now = () => ms;
}

afterEach(() => {
  Settings.now = () => Date.now();
});

// ─── detectLateSubmission (tested via buildEventData) ─────────────────────────

describe('late detection via buildEventData', () => {
  const baseInput = {
    companyId: 'company-1',
    personId: 'person-1',
    eventType: 'CHECK_IN_SUBMITTED' as const,
    entityType: 'check_in',
    payload: { test: true },
    timezone: 'Asia/Manila',
  };

  it('on-time submission: not late', () => {
    // 2026-02-21 09:30 Manila time = 01:30 UTC
    freezeTime('2026-02-21T01:30:00.000Z');
    const result = buildEventData({
      ...baseInput,
      scheduleWindow: { start: '06:00', end: '10:00' },
    });
    expect(result.is_late).toBe(false);
    expect(result.late_by_minutes).toBeNull();
  });

  it('exactly at window close: not late', () => {
    // 2026-02-21 10:00 Manila time = 02:00 UTC
    freezeTime('2026-02-21T02:00:00.000Z');
    const result = buildEventData({
      ...baseInput,
      scheduleWindow: { start: '06:00', end: '10:00' },
    });
    expect(result.is_late).toBe(false);
    expect(result.late_by_minutes).toBeNull();
  });

  it('1 minute after window close: late by 1 minute', () => {
    // 2026-02-21 10:01 Manila time = 02:01 UTC
    freezeTime('2026-02-21T02:01:00.000Z');
    const result = buildEventData({
      ...baseInput,
      scheduleWindow: { start: '06:00', end: '10:00' },
    });
    expect(result.is_late).toBe(true);
    expect(result.late_by_minutes).toBe(1);
  });

  it('hours late: correct lateByMinutes', () => {
    // 2026-02-21 14:30 Manila time = 06:30 UTC
    freezeTime('2026-02-21T06:30:00.000Z');
    const result = buildEventData({
      ...baseInput,
      scheduleWindow: { start: '06:00', end: '10:00' },
    });
    expect(result.is_late).toBe(true);
    expect(result.late_by_minutes).toBe(270); // 14:30 - 10:00 = 270 min
  });

  it('no schedule window: not late', () => {
    freezeTime('2026-02-21T06:30:00.000Z');
    const result = buildEventData({
      ...baseInput,
      // No scheduleWindow
    });
    expect(result.is_late).toBe(false);
    expect(result.late_by_minutes).toBeNull();
  });

  it('before window opens: not late', () => {
    // 2026-02-20 21:00 UTC = 05:00 Manila (Feb 21)
    freezeTime('2026-02-20T21:00:00.000Z');
    const result = buildEventData({
      ...baseInput,
      scheduleWindow: { start: '06:00', end: '10:00' },
    });
    expect(result.is_late).toBe(false);
    expect(result.late_by_minutes).toBeNull();
  });

  it('late by exactly 60 minutes', () => {
    // 2026-02-21 11:00 Manila = 03:00 UTC
    freezeTime('2026-02-21T03:00:00.000Z');
    const result = buildEventData({
      ...baseInput,
      scheduleWindow: { start: '06:00', end: '10:00' },
    });
    expect(result.is_late).toBe(true);
    expect(result.late_by_minutes).toBe(60);
  });
});

// ─── buildEventData fields ────────────────────────────────────────────────────

describe('buildEventData fields', () => {
  it('includes all required fields', () => {
    freezeTime('2026-02-21T02:00:00.000Z');
    const result = buildEventData({
      companyId: 'c1',
      personId: 'p1',
      eventType: 'CHECK_IN_SUBMITTED' as const,
      entityType: 'check_in',
      payload: { key: 'value' },
      timezone: 'Asia/Manila',
    });
    expect(result.company_id).toBe('c1');
    expect(result.person_id).toBe('p1');
    expect(result.event_type).toBe('CHECK_IN_SUBMITTED');
    expect(result.entity_type).toBe('check_in');
    expect(result.event_timezone).toBe('Asia/Manila');
    expect(result.event_time).toBeInstanceOf(Date);
    expect(result.ingested_at).toBeInstanceOf(Date);
  });

  it('handles optional person_id', () => {
    freezeTime('2026-02-21T02:00:00.000Z');
    const result = buildEventData({
      companyId: 'c1',
      eventType: 'CHECK_IN_SUBMITTED' as const,
      entityType: 'check_in',
      payload: {},
      timezone: 'Asia/Manila',
    });
    expect(result.person_id).toBeNull();
  });

  it('handles optional entity_id', () => {
    freezeTime('2026-02-21T02:00:00.000Z');
    const result = buildEventData({
      companyId: 'c1',
      eventType: 'CHECK_IN_SUBMITTED' as const,
      entityType: 'check_in',
      entityId: 'eid-1',
      payload: {},
      timezone: 'Asia/Manila',
    });
    expect(result.entity_id).toBe('eid-1');
  });

  it('event_time is in the specified timezone', () => {
    // 2026-02-21 02:00 UTC = 10:00 Manila
    freezeTime('2026-02-21T02:00:00.000Z');
    const result = buildEventData({
      companyId: 'c1',
      eventType: 'CHECK_IN_SUBMITTED' as const,
      entityType: 'check_in',
      payload: {},
      timezone: 'Asia/Manila',
    });
    // event_time is DateTime.now().setZone(tz).toJSDate() — should be the same instant
    const eventTime = result.event_time as Date;
    expect(eventTime.getTime()).toBe(new Date('2026-02-21T02:00:00.000Z').getTime());
  });
});
