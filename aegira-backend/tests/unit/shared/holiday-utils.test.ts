import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkHolidayForDate,
  invalidateHolidayCache,
  isHoliday,
  buildHolidayDateSet,
} from '../../../src/shared/holiday.utils';

// Create a mock Prisma client
function createMockPrisma() {
  return {
    holiday: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as Parameters<typeof checkHolidayForDate>[0];
}

describe('checkHolidayForDate', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    // Invalidate ALL cache entries between tests
    // We invalidate for many company IDs to clear cross-test state
    invalidateHolidayCache('company-1');
    invalidateHolidayCache('company-2');
    invalidateHolidayCache('test-company');
  });

  it('returns isHoliday=true for exact date match', async () => {
    (mockPrisma.holiday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: 'Christmas Day',
    });

    const result = await checkHolidayForDate(mockPrisma, 'company-1', '2026-12-25');
    expect(result.isHoliday).toBe(true);
    expect(result.holidayName).toBe('Christmas Day');
  });

  it('returns isHoliday=true for recurring holiday match', async () => {
    // No exact match
    (mockPrisma.holiday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    // Recurring holiday on Dec 25 (stored as any year)
    (mockPrisma.holiday.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'Christmas Day', date: new Date('2020-12-25T00:00:00.000Z') },
    ]);

    const result = await checkHolidayForDate(mockPrisma, 'company-1', '2026-12-25');
    expect(result.isHoliday).toBe(true);
    expect(result.holidayName).toBe('Christmas Day');
  });

  it('returns isHoliday=false when no match', async () => {
    (mockPrisma.holiday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.holiday.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await checkHolidayForDate(mockPrisma, 'company-1', '2026-02-23');
    expect(result.isHoliday).toBe(false);
    expect(result.holidayName).toBeNull();
  });

  it('recurring holiday does NOT match different month/day', async () => {
    (mockPrisma.holiday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    // Recurring on Dec 25
    (mockPrisma.holiday.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'Christmas Day', date: new Date('2020-12-25T00:00:00.000Z') },
    ]);

    const result = await checkHolidayForDate(mockPrisma, 'company-1', '2026-06-25');
    expect(result.isHoliday).toBe(false);
  });

  it('caches results for same company+date', async () => {
    (mockPrisma.holiday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.holiday.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    // First call — hits DB
    await checkHolidayForDate(mockPrisma, 'test-company', '2026-03-01');
    expect(mockPrisma.holiday.findFirst).toHaveBeenCalledTimes(1);

    // Second call — should use cache
    await checkHolidayForDate(mockPrisma, 'test-company', '2026-03-01');
    expect(mockPrisma.holiday.findFirst).toHaveBeenCalledTimes(1); // Still 1 (cached)
  });

  it('different date bypasses cache', async () => {
    (mockPrisma.holiday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.holiday.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await checkHolidayForDate(mockPrisma, 'test-company', '2026-03-01');
    await checkHolidayForDate(mockPrisma, 'test-company', '2026-03-02');

    // Two different dates → two DB calls
    expect(mockPrisma.holiday.findFirst).toHaveBeenCalledTimes(2);
  });
});

describe('invalidateHolidayCache', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    invalidateHolidayCache('company-1');
    invalidateHolidayCache('company-2');
  });

  it('invalidates cache for specific company only', async () => {
    (mockPrisma.holiday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.holiday.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    // Prime cache for both companies
    await checkHolidayForDate(mockPrisma, 'company-1', '2026-03-01');
    await checkHolidayForDate(mockPrisma, 'company-2', '2026-03-01');

    // Invalidate only company-1
    invalidateHolidayCache('company-1');

    // company-1: should re-query (cache cleared)
    await checkHolidayForDate(mockPrisma, 'company-1', '2026-03-01');
    // company-2: should use cache (not cleared)
    await checkHolidayForDate(mockPrisma, 'company-2', '2026-03-01');

    // company-1 was queried 2 times (initial + after invalidation)
    // company-2 was queried 1 time (initial only, cache still valid)
    // Total: 3 times for findFirst
    expect(mockPrisma.holiday.findFirst).toHaveBeenCalledTimes(3);
  });
});

describe('isHoliday (convenience wrapper)', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    invalidateHolidayCache('company-1');
  });

  it('returns true for holiday', async () => {
    (mockPrisma.holiday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: 'Test Holiday',
    });

    const result = await isHoliday(mockPrisma, 'company-1', '2026-12-25');
    expect(result).toBe(true);
  });

  it('returns false for non-holiday', async () => {
    (mockPrisma.holiday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.holiday.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await isHoliday(mockPrisma, 'company-1', '2026-02-23');
    expect(result).toBe(false);
  });
});

describe('buildHolidayDateSet', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it('returns set of holiday date strings for date range', async () => {
    // Exact holiday on Feb 23
    (mockPrisma.holiday.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        { date: new Date('2026-02-23T00:00:00.000Z') }, // Exact holidays
      ])
      .mockResolvedValueOnce([]); // No recurring

    const startDate = new Date('2026-02-01T00:00:00.000Z');
    const endDate = new Date('2026-02-28T00:00:00.000Z');
    const result = await buildHolidayDateSet(mockPrisma, 'company-1', startDate, endDate, 'Asia/Manila');

    expect(result.has('2026-02-23')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('includes recurring holidays within range', async () => {
    // No exact holidays
    (mockPrisma.holiday.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([]) // Exact holidays
      .mockResolvedValueOnce([
        { date: new Date('2020-02-14T00:00:00.000Z') }, // Valentine's recurring
      ]);

    const startDate = new Date('2026-02-01T00:00:00.000Z');
    const endDate = new Date('2026-02-28T00:00:00.000Z');
    const result = await buildHolidayDateSet(mockPrisma, 'company-1', startDate, endDate, 'Asia/Manila');

    expect(result.has('2026-02-14')).toBe(true);
  });

  it('returns empty set when no holidays', async () => {
    (mockPrisma.holiday.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const startDate = new Date('2026-02-01T00:00:00.000Z');
    const endDate = new Date('2026-02-28T00:00:00.000Z');
    const result = await buildHolidayDateSet(mockPrisma, 'company-1', startDate, endDate, 'Asia/Manila');

    expect(result.size).toBe(0);
  });

  it('fetches exact and recurring holidays in parallel', async () => {
    (mockPrisma.holiday.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const startDate = new Date('2026-02-01T00:00:00.000Z');
    const endDate = new Date('2026-02-28T00:00:00.000Z');
    await buildHolidayDateSet(mockPrisma, 'company-1', startDate, endDate, 'Asia/Manila');

    // findMany should be called twice (exact + recurring)
    expect(mockPrisma.holiday.findMany).toHaveBeenCalledTimes(2);
  });
});
