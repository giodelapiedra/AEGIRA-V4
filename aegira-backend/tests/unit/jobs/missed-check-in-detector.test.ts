import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Settings } from 'luxon';

// Mock all external dependencies before importing
vi.mock('../../../src/config/database', () => ({
  prisma: {
    company: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    person: { findMany: vi.fn() },
    checkIn: { findMany: vi.fn() },
    event: { createMany: vi.fn().mockReturnValue({ catch: vi.fn() }) },
  },
}));

vi.mock('../../../src/shared/holiday.utils', () => ({
  isHoliday: vi.fn(),
  buildHolidayDateSet: vi.fn().mockResolvedValue(new Set<string>()),
}));

vi.mock('../../../src/modules/missed-check-in/missed-check-in.repository', () => ({
  MissedCheckInRepository: vi.fn().mockImplementation(() => ({
    findExistingForDate: vi.fn().mockResolvedValue(new Set<string>()),
    createMany: vi.fn().mockResolvedValue(0),
  })),
}));

vi.mock('../../../src/modules/missed-check-in/missed-check-in-snapshot.service', () => ({
  MissedCheckInSnapshotService: vi.fn().mockImplementation(() => ({
    calculateBatch: vi.fn().mockResolvedValue(new Map()),
  })),
}));

vi.mock('../../../src/modules/notification/notification.service', () => ({
  sendNotifications: vi.fn(),
}));

vi.mock('../../../src/modules/event/event.service', () => ({
  buildEventData: vi.fn(() => ({
    company_id: 'company-1',
    event_type: 'MISSED_CHECK_IN_DETECTED',
    entity_type: 'missed_check_in',
    event_time: new Date(),
    ingested_at: new Date(),
    event_timezone: 'Asia/Manila',
    is_late: false,
    late_by_minutes: null,
  })),
}));

vi.mock('../../../src/config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { detectMissedCheckIns } from '../../../src/jobs/missed-check-in-detector';
import { prisma } from '../../../src/config/database';
import { isHoliday } from '../../../src/shared/holiday.utils';
import { MissedCheckInRepository } from '../../../src/modules/missed-check-in/missed-check-in.repository';
import { sendNotifications } from '../../../src/modules/notification/notification.service';

const COMPANY_ID = 'company-1';
const TIMEZONE = 'Asia/Manila';

// Freeze to Monday 2026-02-23 at 10:30 Manila (00:30 UTC) — after default window close + buffer
function freezeTime(isoUtc = '2026-02-23T02:32:00.000Z'): void {
  // 02:32 UTC = 10:32 Manila (after 10:00 + 2 min buffer)
  Settings.now = () => new Date(isoUtc).getTime();
}

// Standard team
const defaultTeam = {
  id: 'team-1',
  name: 'Alpha',
  check_in_start: '06:00',
  check_in_end: '10:00',
  work_days: '1,2,3,4,5',
  leader: { id: 'leader-1', first_name: 'Jane', last_name: 'Lead' },
};

// Standard worker (assigned before today, active, Mon-Fri)
const defaultWorker = {
  id: 'worker-1',
  team_id: 'team-1',
  team_assigned_at: new Date('2026-02-01T00:00:00.000Z'),
  role: 'WORKER',
  work_days: null,
  check_in_start: null,
  check_in_end: null,
  team: {
    work_days: '1,2,3,4,5',
    check_in_start: '06:00',
    check_in_end: '10:00',
  },
};

describe('detectMissedCheckIns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    freezeTime();

    // Default: one active company
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: COMPANY_ID, timezone: TIMEZONE } as never,
    ]);

    // Default: not a holiday
    vi.mocked(isHoliday).mockResolvedValue(false);

    // Default: one active team
    vi.mocked(prisma.team.findMany).mockResolvedValue([defaultTeam] as never);

    // Default: one eligible worker
    vi.mocked(prisma.person.findMany).mockResolvedValue([defaultWorker] as never);

    // Default: no check-ins for today
    vi.mocked(prisma.checkIn.findMany).mockResolvedValue([]);

    // Default: no existing missed records
    vi.mocked(MissedCheckInRepository).mockImplementation(() => ({
      findExistingForDate: vi.fn().mockResolvedValue(new Set<string>()),
      createMany: vi.fn().mockResolvedValue(1),
    }) as never);
  });

  afterEach(() => {
    Settings.now = () => Date.now();
  });

  // ─── Happy Path ───────────────────────────────────────────────────────────

  it('detects a missed check-in for eligible worker', async () => {
    await detectMissedCheckIns();

    // Should have queried companies, teams, workers, check-ins
    expect(prisma.company.findMany).toHaveBeenCalled();
    expect(prisma.team.findMany).toHaveBeenCalled();
    expect(prisma.person.findMany).toHaveBeenCalled();
    expect(prisma.checkIn.findMany).toHaveBeenCalled();
  });

  // ─── Holiday Skipping ─────────────────────────────────────────────────────

  it('skips company when today is a holiday', async () => {
    vi.mocked(isHoliday).mockResolvedValue(true);

    await detectMissedCheckIns();

    // Workers should NOT be queried when it's a holiday
    expect(prisma.person.findMany).not.toHaveBeenCalled();
  });

  // ─── No Active Teams ─────────────────────────────────────────────────────

  it('returns 0 when no active teams', async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValue([]);

    await detectMissedCheckIns();

    // No workers should be fetched
    expect(prisma.person.findMany).not.toHaveBeenCalled();
  });

  // ─── Worker Already Checked In ────────────────────────────────────────────

  it('excludes workers who already checked in today', async () => {
    vi.mocked(prisma.checkIn.findMany).mockResolvedValue([
      { person_id: 'worker-1' } as never,
    ]);

    const mockCreateMany = vi.fn().mockResolvedValue(0);
    vi.mocked(MissedCheckInRepository).mockImplementation(() => ({
      findExistingForDate: vi.fn().mockResolvedValue(new Set<string>()),
      createMany: mockCreateMany,
    }) as never);

    await detectMissedCheckIns();

    // createMany should NOT be called since all workers checked in
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  // ─── Same-Day Assignment Exclusion ────────────────────────────────────────

  it('excludes workers assigned today (same-day)', async () => {
    const todayAssignedWorker = {
      ...defaultWorker,
      // Assigned today at 08:00 Manila = 00:00 UTC
      team_assigned_at: new Date('2026-02-23T00:00:00.000Z'),
    };
    vi.mocked(prisma.person.findMany).mockResolvedValue([todayAssignedWorker] as never);

    const mockCreateMany = vi.fn().mockResolvedValue(0);
    vi.mocked(MissedCheckInRepository).mockImplementation(() => ({
      findExistingForDate: vi.fn().mockResolvedValue(new Set<string>()),
      createMany: mockCreateMany,
    }) as never);

    await detectMissedCheckIns();

    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  // ─── Non-Work Day Exclusion ───────────────────────────────────────────────

  it('excludes workers whose schedule does not include today', async () => {
    // Worker only works Mon/Wed/Fri but today is Monday → included
    // Change to Tue/Thu only
    const tueThuWorker = {
      ...defaultWorker,
      work_days: '2,4', // Tuesday + Thursday
    };
    vi.mocked(prisma.person.findMany).mockResolvedValue([tueThuWorker] as never);

    const mockCreateMany = vi.fn().mockResolvedValue(0);
    vi.mocked(MissedCheckInRepository).mockImplementation(() => ({
      findExistingForDate: vi.fn().mockResolvedValue(new Set<string>()),
      createMany: mockCreateMany,
    }) as never);

    await detectMissedCheckIns();

    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  // ─── Window Buffer ────────────────────────────────────────────────────────

  it('does not detect when within buffer period', async () => {
    // 10:01 Manila = 02:01 UTC (only 1 min past window, buffer is 2 min)
    freezeTime('2026-02-23T02:01:00.000Z');

    const mockCreateMany = vi.fn().mockResolvedValue(0);
    vi.mocked(MissedCheckInRepository).mockImplementation(() => ({
      findExistingForDate: vi.fn().mockResolvedValue(new Set<string>()),
      createMany: mockCreateMany,
    }) as never);

    await detectMissedCheckIns();

    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('detects when buffer period has passed', async () => {
    // 10:02 Manila = 02:02 UTC (exactly at buffer end)
    freezeTime('2026-02-23T02:02:00.000Z');

    const mockCreateMany = vi.fn().mockResolvedValue(1);
    vi.mocked(MissedCheckInRepository).mockImplementation(() => ({
      findExistingForDate: vi.fn().mockResolvedValue(new Set<string>()),
      createMany: mockCreateMany,
    }) as never);

    await detectMissedCheckIns();

    expect(mockCreateMany).toHaveBeenCalled();
  });

  // ─── Duplicate Avoidance (Re-Run Idempotency) ────────────────────────────

  it('skips workers who already have a missed check-in record for today', async () => {
    // Simulate worker-1 already has a record
    const mockCreateMany = vi.fn().mockResolvedValue(0);
    vi.mocked(MissedCheckInRepository).mockImplementation(() => ({
      findExistingForDate: vi.fn().mockResolvedValue(new Set(['worker-1'])),
      createMany: mockCreateMany,
    }) as never);

    await detectMissedCheckIns();

    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  // ─── Worker Schedule Override ─────────────────────────────────────────────

  it('uses worker schedule override for window check', async () => {
    // Worker has a later window: 12:00-14:00
    const lateWindowWorker = {
      ...defaultWorker,
      check_in_start: '12:00',
      check_in_end: '14:00',
    };
    vi.mocked(prisma.person.findMany).mockResolvedValue([lateWindowWorker] as never);

    // Current time: 10:32 Manila — before worker's override window + buffer (14:02)
    const mockCreateMany = vi.fn().mockResolvedValue(0);
    vi.mocked(MissedCheckInRepository).mockImplementation(() => ({
      findExistingForDate: vi.fn().mockResolvedValue(new Set<string>()),
      createMany: mockCreateMany,
    }) as never);

    await detectMissedCheckIns();

    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  // ─── Notifications ────────────────────────────────────────────────────────

  it('sends notifications to workers and team leads for new misses', async () => {
    const mockCreateMany = vi.fn().mockResolvedValue(1);
    vi.mocked(MissedCheckInRepository).mockImplementation(() => ({
      findExistingForDate: vi.fn().mockResolvedValue(new Set<string>()),
      createMany: mockCreateMany,
    }) as never);

    await detectMissedCheckIns();

    expect(sendNotifications).toHaveBeenCalled();
    const callArgs = vi.mocked(sendNotifications).mock.calls[0];
    const notifications = callArgs[2] as Array<{ personId: string; type: string }>;

    // Should have worker notification + team lead notification
    const workerNotif = notifications.find((n) => n.personId === 'worker-1');
    const leaderNotif = notifications.find((n) => n.personId === 'leader-1');
    expect(workerNotif).toBeDefined();
    expect(workerNotif?.type).toBe('MISSED_CHECK_IN');
    expect(leaderNotif).toBeDefined();
    expect(leaderNotif?.type).toBe('MISSED_CHECK_IN');
  });

  // ─── Multi-Company Isolation ──────────────────────────────────────────────

  it('processes each company independently', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: 'company-1', timezone: 'Asia/Manila' } as never,
      { id: 'company-2', timezone: 'America/New_York' } as never,
    ]);

    await detectMissedCheckIns();

    // Teams should be fetched for each company
    expect(prisma.team.findMany).toHaveBeenCalledTimes(2);
  });

  // ─── Error Isolation Between Companies ────────────────────────────────────

  it('continues processing other companies when one fails', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: 'company-1', timezone: 'Asia/Manila' } as never,
      { id: 'company-2', timezone: 'Asia/Manila' } as never,
    ]);

    // First company's team query fails
    let callCount = 0;
    vi.mocked(prisma.team.findMany).mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error('DB error');
      return Promise.resolve([defaultTeam]) as never;
    });

    // Should not throw — error is caught per-company
    await detectMissedCheckIns();

    // Second company should still be processed
    expect(prisma.team.findMany).toHaveBeenCalledTimes(2);
  });

  // ─── Overlapping Run Prevention ───────────────────────────────────────────

  it('prevents overlapping runs via isRunning lock', async () => {
    // Make the first run slow
    vi.mocked(prisma.company.findMany).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([{ id: COMPANY_ID, timezone: TIMEZONE }] as never), 100)),
    );

    // Start two runs concurrently
    const run1 = detectMissedCheckIns();
    const run2 = detectMissedCheckIns();

    await Promise.all([run1, run2]);

    // Company query should only be called once (second run skipped)
    expect(prisma.company.findMany).toHaveBeenCalledTimes(1);
  });

  // ─── Multiple Workers ────────────────────────────────────────────────────

  it('groups team lead notifications when multiple workers miss on same team', async () => {
    const workers = [
      { ...defaultWorker, id: 'worker-1' },
      { ...defaultWorker, id: 'worker-2' },
      { ...defaultWorker, id: 'worker-3' },
    ];
    vi.mocked(prisma.person.findMany).mockResolvedValue(workers as never);

    const mockCreateMany = vi.fn().mockResolvedValue(3);
    vi.mocked(MissedCheckInRepository).mockImplementation(() => ({
      findExistingForDate: vi.fn().mockResolvedValue(new Set<string>()),
      createMany: mockCreateMany,
    }) as never);

    await detectMissedCheckIns();

    expect(sendNotifications).toHaveBeenCalled();
    const callArgs = vi.mocked(sendNotifications).mock.calls[0];
    const notifications = callArgs[2] as Array<{ personId: string; message: string }>;

    // Leader should get ONE grouped notification
    const leaderNotifs = notifications.filter((n) => n.personId === 'leader-1');
    expect(leaderNotifs).toHaveLength(1);
    expect(leaderNotifs[0].message).toContain('3 workers');
  });
});
