import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Settings } from 'luxon';
import { Prisma } from '@prisma/client';

// Mock modules before importing the service
vi.mock('../../../src/config/database', () => ({
  prisma: {
    $transaction: vi.fn(),
    event: { create: vi.fn() },
    checkIn: { create: vi.fn() },
    missedCheckIn: { findFirst: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock('../../../src/shared/holiday.utils', () => ({
  checkHolidayForDate: vi.fn(),
}));

vi.mock('../../../src/modules/event/event.service', () => ({
  buildEventData: vi.fn(() => ({
    company_id: 'company-1',
    person_id: 'person-1',
    event_type: 'CHECK_IN_SUBMITTED',
    entity_type: 'check_in',
    event_time: new Date(),
    ingested_at: new Date(),
    event_timezone: 'Asia/Manila',
    is_late: false,
    late_by_minutes: null,
  })),
  emitEvent: vi.fn(),
}));

vi.mock('../../../src/config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { CheckInService } from '../../../src/modules/check-in/check-in.service';
import { CheckInRepository } from '../../../src/modules/check-in/check-in.repository';
import { prisma } from '../../../src/config/database';
import { checkHolidayForDate } from '../../../src/shared/holiday.utils';
import { buildEventData, emitEvent } from '../../../src/modules/event/event.service';
import { AppError } from '../../../src/shared/errors';

// Freeze time to a Monday morning in Manila
// 2026-02-23 is a Monday. 08:00 Manila = 00:00 UTC
const FROZEN_UTC = '2026-02-23T00:00:00.000Z';

function freezeTime(isoUtc: string = FROZEN_UTC): void {
  Settings.now = () => new Date(isoUtc).getTime();
}

// Standard check-in input
const validInput = {
  hoursSlept: 8,
  sleepQuality: 8,
  stressLevel: 3,
  physicalCondition: 8,
};

const COMPANY_ID = 'company-1';
const PERSON_ID = 'person-1';
const TIMEZONE = 'Asia/Manila';

// Mock person with team
const mockPersonWithTeam = {
  id: PERSON_ID,
  company_id: COMPANY_ID,
  is_active: true,
  work_days: null,
  check_in_start: null,
  check_in_end: null,
  team: {
    id: 'team-1',
    name: 'Alpha Team',
    check_in_start: '06:00',
    check_in_end: '10:00',
    work_days: '1,2,3,4,5',
    is_active: true,
  },
};

describe('CheckInService.submit', () => {
  let service: CheckInService;
  let mockGetPersonWithTeam: ReturnType<typeof vi.fn>;
  let mockGetCompanyId: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    freezeTime();

    // Create a mock repository
    mockGetPersonWithTeam = vi.fn().mockResolvedValue(mockPersonWithTeam);
    mockGetCompanyId = vi.fn().mockReturnValue(COMPANY_ID);

    const mockRepo = {
      getPersonWithTeam: mockGetPersonWithTeam,
      getCompanyId: mockGetCompanyId,
    } as unknown as CheckInRepository;

    service = new CheckInService(mockRepo, TIMEZONE);

    // Default mock: not a holiday
    vi.mocked(checkHolidayForDate).mockResolvedValue({
      isHoliday: false,
      holidayName: null,
    });

    // Mock transaction to execute the callback
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const txMock = {
        event: {
          create: vi.fn().mockResolvedValue({
            id: 'event-1',
            is_late: false,
            late_by_minutes: null,
          }),
        },
        checkIn: {
          create: vi.fn().mockResolvedValue({
            id: 'checkin-1',
            company_id: COMPANY_ID,
            person_id: PERSON_ID,
            check_in_date: new Date('2026-02-23T00:00:00.000Z'),
            readiness_score: 81,
            readiness_level: 'GREEN',
            person: {
              id: PERSON_ID,
              first_name: 'John',
              last_name: 'Doe',
              email: 'john@example.com',
            },
          }),
        },
        missedCheckIn: {
          findFirst: vi.fn(),
          update: vi.fn(),
          upsert: vi.fn(),
        },
      };
      return (fn as (tx: typeof txMock) => Promise<unknown>)(txMock);
    });
  });

  afterEach(() => {
    Settings.now = () => Date.now();
  });

  // ─── Happy Path ───────────────────────────────────────────────────────────

  it('successfully submits a check-in on a work day within window', async () => {
    const result = await service.submit(validInput, PERSON_ID, COMPANY_ID);
    expect(result).toBeDefined();
    expect(result.id).toBe('checkin-1');
    expect(result.readiness_level).toBe('GREEN');
  });

  it('calls checkHolidayForDate with correct params', async () => {
    await service.submit(validInput, PERSON_ID, COMPANY_ID);
    expect(checkHolidayForDate).toHaveBeenCalledWith(
      prisma,
      COMPANY_ID,
      '2026-02-23', // Monday in Manila
    );
  });

  it('calls getPersonWithTeam with correct personId', async () => {
    await service.submit(validInput, PERSON_ID, COMPANY_ID);
    expect(mockGetPersonWithTeam).toHaveBeenCalledWith(PERSON_ID);
  });

  it('calls buildEventData with schedule window', async () => {
    await service.submit(validInput, PERSON_ID, COMPANY_ID);
    expect(buildEventData).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        personId: PERSON_ID,
        eventType: 'CHECK_IN_SUBMITTED',
        timezone: TIMEZONE,
        scheduleWindow: { start: '06:00', end: '10:00' },
      }),
    );
  });

  // ─── Holiday Blocking ─────────────────────────────────────────────────────

  it('rejects check-in on a holiday', async () => {
    vi.mocked(checkHolidayForDate).mockResolvedValue({
      isHoliday: true,
      holidayName: 'Christmas Day',
    });

    await expect(
      service.submit(validInput, PERSON_ID, COMPANY_ID),
    ).rejects.toThrow(AppError);

    try {
      await service.submit(validInput, PERSON_ID, COMPANY_ID);
    } catch (err) {
      expect((err as AppError).code).toBe('HOLIDAY');
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  // ─── Deactivated Worker ───────────────────────────────────────────────────

  it('rejects check-in for inactive worker (null from getPersonWithTeam)', async () => {
    mockGetPersonWithTeam.mockResolvedValue(null);

    await expect(
      service.submit(validInput, PERSON_ID, COMPANY_ID),
    ).rejects.toThrow(AppError);

    try {
      await service.submit(validInput, PERSON_ID, COMPANY_ID);
    } catch (err) {
      expect((err as AppError).code).toBe('ACCOUNT_INACTIVE');
      expect((err as AppError).statusCode).toBe(403);
    }
  });

  // ─── No Team ──────────────────────────────────────────────────────────────

  it('rejects check-in when worker has no team', async () => {
    mockGetPersonWithTeam.mockResolvedValue({
      ...mockPersonWithTeam,
      team: null,
    });

    await expect(
      service.submit(validInput, PERSON_ID, COMPANY_ID),
    ).rejects.toThrow(AppError);

    try {
      await service.submit(validInput, PERSON_ID, COMPANY_ID);
    } catch (err) {
      expect((err as AppError).code).toBe('NO_TEAM_ASSIGNED');
    }
  });

  // ─── Inactive Team ────────────────────────────────────────────────────────

  it('rejects check-in when team is inactive', async () => {
    mockGetPersonWithTeam.mockResolvedValue({
      ...mockPersonWithTeam,
      team: { ...mockPersonWithTeam.team, is_active: false },
    });

    await expect(
      service.submit(validInput, PERSON_ID, COMPANY_ID),
    ).rejects.toThrow(AppError);

    try {
      await service.submit(validInput, PERSON_ID, COMPANY_ID);
    } catch (err) {
      expect((err as AppError).code).toBe('TEAM_INACTIVE');
    }
  });

  // ─── Non-Work Day ─────────────────────────────────────────────────────────

  it('rejects check-in on a non-work day (Saturday)', async () => {
    // Freeze to Saturday: 2026-02-21 is Saturday. 08:00 Manila = 00:00 UTC
    freezeTime('2026-02-21T00:00:00.000Z');

    await expect(
      service.submit(validInput, PERSON_ID, COMPANY_ID),
    ).rejects.toThrow(AppError);

    try {
      await service.submit(validInput, PERSON_ID, COMPANY_ID);
    } catch (err) {
      expect((err as AppError).code).toBe('NOT_WORK_DAY');
    }
  });

  it('rejects check-in on a non-work day (Sunday)', async () => {
    // 2026-02-22 is Sunday. 08:00 Manila = 00:00 UTC
    freezeTime('2026-02-22T00:00:00.000Z');

    await expect(
      service.submit(validInput, PERSON_ID, COMPANY_ID),
    ).rejects.toThrow(AppError);
  });

  // ─── Before Window ────────────────────────────────────────────────────────

  it('rejects check-in before window opens', async () => {
    // 2026-02-23 05:00 Manila = 2026-02-22T21:00Z
    freezeTime('2026-02-22T21:00:00.000Z');

    await expect(
      service.submit(validInput, PERSON_ID, COMPANY_ID),
    ).rejects.toThrow(AppError);

    try {
      await service.submit(validInput, PERSON_ID, COMPANY_ID);
    } catch (err) {
      expect((err as AppError).code).toBe('OUTSIDE_CHECK_IN_WINDOW');
    }
  });

  it('allows check-in at exactly window start', async () => {
    // 2026-02-23 06:00 Manila = 2026-02-22T22:00Z
    freezeTime('2026-02-22T22:00:00.000Z');
    const result = await service.submit(validInput, PERSON_ID, COMPANY_ID);
    expect(result).toBeDefined();
  });

  // ─── Late Submission ──────────────────────────────────────────────────────

  it('allows late submission after window closes', async () => {
    // 2026-02-23 14:00 Manila = 2026-02-23T06:00Z
    freezeTime('2026-02-23T06:00:00.000Z');
    const result = await service.submit(validInput, PERSON_ID, COMPANY_ID);
    expect(result).toBeDefined();
  });

  it('resolves existing missed check-in on late submission', async () => {
    // Setup: late submission with existing missed check-in
    freezeTime('2026-02-23T06:00:00.000Z');

    vi.mocked(buildEventData).mockReturnValue({
      company_id: COMPANY_ID,
      person_id: PERSON_ID,
      event_type: 'CHECK_IN_SUBMITTED',
      entity_type: 'check_in',
      event_time: new Date(),
      ingested_at: new Date(),
      event_timezone: TIMEZONE,
      is_late: true,
      late_by_minutes: 240,
    } as never);

    // Mock transaction with late handling
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const txMock = {
        event: {
          create: vi.fn().mockResolvedValue({
            id: 'event-1',
            is_late: true,
            late_by_minutes: 240,
          }),
        },
        checkIn: {
          create: vi.fn().mockResolvedValue({
            id: 'checkin-1',
            person_id: PERSON_ID,
            readiness_level: 'GREEN',
            person: { id: PERSON_ID, first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
          }),
        },
        missedCheckIn: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'missed-1',
            person_id: PERSON_ID,
            resolved_at: null,
          }),
          update: vi.fn().mockResolvedValue({
            id: 'missed-1',
            resolved_by_check_in_id: 'checkin-1',
            resolved_at: new Date(),
          }),
          upsert: vi.fn(),
        },
      };
      return (fn as (tx: typeof txMock) => Promise<unknown>)(txMock);
    });

    const result = await service.submit(validInput, PERSON_ID, COMPANY_ID);
    expect(result).toBeDefined();
    // emitEvent should be called for MISSED_CHECK_IN_RESOLVED
    expect(emitEvent).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: 'MISSED_CHECK_IN_RESOLVED',
      }),
    );
  });

  it('creates and resolves missed check-in via upsert when cron has not run', async () => {
    freezeTime('2026-02-23T06:00:00.000Z');

    vi.mocked(buildEventData).mockReturnValue({
      company_id: COMPANY_ID,
      person_id: PERSON_ID,
      event_type: 'CHECK_IN_SUBMITTED',
      entity_type: 'check_in',
      event_time: new Date(),
      ingested_at: new Date(),
      event_timezone: TIMEZONE,
      is_late: true,
      late_by_minutes: 240,
    } as never);

    // Mock transaction: no existing missed check-in (cron hasn't run)
    let upsertCalled = false;
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const txMock = {
        event: {
          create: vi.fn().mockResolvedValue({
            id: 'event-1',
            is_late: true,
            late_by_minutes: 240,
          }),
        },
        checkIn: {
          create: vi.fn().mockResolvedValue({
            id: 'checkin-1',
            person_id: PERSON_ID,
            readiness_level: 'GREEN',
            person: { id: PERSON_ID, first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
          }),
        },
        missedCheckIn: {
          findFirst: vi.fn().mockResolvedValue(null), // No existing record
          update: vi.fn(),
          upsert: vi.fn().mockImplementation(() => {
            upsertCalled = true;
            return Promise.resolve({
              id: 'missed-created-1',
              person_id: PERSON_ID,
              resolved_by_check_in_id: 'checkin-1',
              resolved_at: new Date(),
            });
          }),
        },
      };
      return (fn as (tx: typeof txMock) => Promise<unknown>)(txMock);
    });

    const result = await service.submit(validInput, PERSON_ID, COMPANY_ID);
    expect(result).toBeDefined();
    expect(upsertCalled).toBe(true);
    expect(emitEvent).toHaveBeenCalled();
  });

  // ─── Duplicate Check-In (P2002) ──────────────────────────────────────────

  it('throws DUPLICATE_CHECK_IN on Prisma P2002 unique constraint error', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '5.22.0' },
    );
    vi.mocked(prisma.$transaction).mockRejectedValue(prismaError);

    await expect(
      service.submit(validInput, PERSON_ID, COMPANY_ID),
    ).rejects.toThrow(AppError);

    try {
      await service.submit(validInput, PERSON_ID, COMPANY_ID);
    } catch (err) {
      expect((err as AppError).code).toBe('DUPLICATE_CHECK_IN');
      expect((err as AppError).statusCode).toBe(409);
    }
  });

  it('re-throws non-P2002 Prisma errors', async () => {
    const genericError = new Error('Connection failed');
    vi.mocked(prisma.$transaction).mockRejectedValue(genericError);

    await expect(
      service.submit(validInput, PERSON_ID, COMPANY_ID),
    ).rejects.toThrow('Connection failed');
  });

  // ─── Worker Schedule Override ─────────────────────────────────────────────

  it('uses worker schedule override when set', async () => {
    mockGetPersonWithTeam.mockResolvedValue({
      ...mockPersonWithTeam,
      work_days: '1,2,3,4,5,6', // Includes Saturday
      check_in_start: '07:00',
      check_in_end: '11:00',
    });

    // Saturday at 08:00 Manila = 00:00 UTC
    freezeTime('2026-02-21T00:00:00.000Z');

    const result = await service.submit(validInput, PERSON_ID, COMPANY_ID);
    expect(result).toBeDefined();

    expect(buildEventData).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleWindow: { start: '07:00', end: '11:00' },
      }),
    );
  });

  it('rejects when worker schedule override excludes today', async () => {
    mockGetPersonWithTeam.mockResolvedValue({
      ...mockPersonWithTeam,
      work_days: '2,3,4,5', // No Monday (1)
    });

    // Monday at 08:00 Manila
    freezeTime('2026-02-23T00:00:00.000Z');

    await expect(
      service.submit(validInput, PERSON_ID, COMPANY_ID),
    ).rejects.toThrow(AppError);
  });

  // ─── Parallel Query Execution ─────────────────────────────────────────────

  it('runs holiday check and person fetch in parallel', async () => {
    await service.submit(validInput, PERSON_ID, COMPANY_ID);

    // Both should have been called (they run in Promise.all)
    expect(checkHolidayForDate).toHaveBeenCalledTimes(1);
    expect(mockGetPersonWithTeam).toHaveBeenCalledTimes(1);
  });
});

// ─── getCheckInStatus ─────────────────────────────────────────────────────────

describe('CheckInService.getCheckInStatus', () => {
  let service: CheckInService;
  let mockGetPersonWithTeam: ReturnType<typeof vi.fn>;
  let mockExistsForDate: ReturnType<typeof vi.fn>;
  let mockGetCompanyId: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    freezeTime();

    mockGetPersonWithTeam = vi.fn().mockResolvedValue(mockPersonWithTeam);
    mockExistsForDate = vi.fn().mockResolvedValue(false);
    mockGetCompanyId = vi.fn().mockReturnValue(COMPANY_ID);

    const mockRepo = {
      getPersonWithTeam: mockGetPersonWithTeam,
      existsForDate: mockExistsForDate,
      getCompanyId: mockGetCompanyId,
    } as unknown as CheckInRepository;

    service = new CheckInService(mockRepo, TIMEZONE);

    vi.mocked(checkHolidayForDate).mockResolvedValue({
      isHoliday: false,
      holidayName: null,
    });
  });

  afterEach(() => {
    Settings.now = () => Date.now();
  });

  it('returns canCheckIn=true when within window on work day', async () => {
    const status = await service.getCheckInStatus(PERSON_ID);
    expect(status.canCheckIn).toBe(true);
    expect(status.isWorkDay).toBe(true);
    expect(status.message).toBe('You can check in now');
  });

  it('returns canCheckIn=false for inactive worker', async () => {
    mockGetPersonWithTeam.mockResolvedValue(null);
    const status = await service.getCheckInStatus(PERSON_ID);
    expect(status.canCheckIn).toBe(false);
    expect(status.message).toContain('inactive');
  });

  it('returns canCheckIn=false when already checked in', async () => {
    mockExistsForDate.mockResolvedValue(true);
    const status = await service.getCheckInStatus(PERSON_ID);
    expect(status.canCheckIn).toBe(false);
    expect(status.hasCheckedInToday).toBe(true);
    expect(status.message).toBe('You have already checked in today');
  });

  it('returns canCheckIn=true after window (late submission allowed)', async () => {
    // 14:00 Manila = 06:00 UTC
    freezeTime('2026-02-23T06:00:00.000Z');
    const status = await service.getCheckInStatus(PERSON_ID);
    expect(status.canCheckIn).toBe(true);
    expect(status.isWithinWindow).toBe(false);
    expect(status.message).toContain('late check-in');
  });

  it('returns canCheckIn=false before window', async () => {
    // 05:00 Manila = 21:00 UTC previous day
    freezeTime('2026-02-22T21:00:00.000Z');
    const status = await service.getCheckInStatus(PERSON_ID);
    expect(status.canCheckIn).toBe(false);
    expect(status.message).toContain('opens at');
  });

  it('returns holiday message on holidays', async () => {
    vi.mocked(checkHolidayForDate).mockResolvedValue({
      isHoliday: true,
      holidayName: 'New Year',
    });
    const status = await service.getCheckInStatus(PERSON_ID);
    expect(status.canCheckIn).toBe(false);
    expect(status.isHoliday).toBe(true);
    expect(status.message).toContain('New Year');
  });

  it('includes schedule info in response', async () => {
    const status = await service.getCheckInStatus(PERSON_ID);
    expect(status.schedule).toEqual({
      checkInStart: '06:00',
      checkInEnd: '10:00',
      workDays: ['1', '2', '3', '4', '5'],
    });
    expect(status.team).toEqual({
      id: 'team-1',
      name: 'Alpha Team',
    });
  });
});
