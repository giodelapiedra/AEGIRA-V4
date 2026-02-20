# Snapshot Service Pattern
> Batch state capture at business events — immutable context snapshots for analytics and audit

## When to Use
- Capturing worker context at the moment of a business event (missed check-in, incident, case)
- Batch processing multiple workers efficiently (avoid N+1 queries)
- Building analytics that require point-in-time state (streak, completion rate, frequency)
- Any feature that needs to "freeze" the state for later analysis

## Canonical Implementation

### Snapshot Service Class Structure
```typescript
import type { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { precomputeDateRange, buildDateLookup, formatDateInTimezone } from '../../shared/utils';
import { getEffectiveSchedule } from '../../shared/schedule.utils';

interface StateSnapshot {
  // Point-in-time context
  dayOfWeek: number;
  weekOfMonth: number;
  // Historical metrics
  daysSinceLastCheckIn: number | null;
  checkInStreakBefore: number;
  recentReadinessAvg: number | null;
  // Frequency metrics
  missesInLast30d: number;
  missesInLast60d: number;
  missesInLast90d: number;
  baselineCompletionRate: number;
  // Pattern indicators
  isFirstMissIn30d: boolean;
  isIncreasingFrequency: boolean;
}

export class SnapshotService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string,
    private readonly timezone: string
  ) {}

  async calculateBatch(
    workers: WorkerContext[],
    eventDate: Date,
    holidayDates: Set<string>
  ): Promise<Map<string, StateSnapshot>> {
    if (workers.length === 0) return new Map();

    const personIds = workers.map((w) => w.personId);

    // 1. Parallel batch queries — one query per data type, not per worker
    const [checkInsMap, missedMap] = await Promise.all([
      this.getCheckInsLast90Days(personIds, eventDate),
      this.getMissedLast90Days(personIds, eventDate),
    ]);

    // 2. Pre-compute shared date range ONCE (not per worker)
    const ninetyDaysAgo = new Date(eventDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    const dateRange90d = precomputeDateRange(ninetyDaysAgo, 90, this.timezone);

    // 3. Calculate per-worker snapshots using shared data
    const results = new Map<string, StateSnapshot>();
    for (const worker of workers) {
      const checkIns = checkInsMap.get(worker.personId) || [];
      const misses = missedMap.get(worker.personId) || [];
      results.set(worker.personId, this.calculateForWorker(worker, checkIns, misses, eventDate, holidayDates, dateRange90d));
    }

    return results;
  }
}
```

### Key Design Principles

#### 1. Batch Queries (Avoid N+1)
```typescript
// WRONG — N+1 queries (one per worker)
for (const worker of workers) {
  const checkIns = await prisma.checkIn.findMany({ where: { person_id: worker.id } });
}

// CORRECT — Single batch query for all workers
const checkIns = await prisma.checkIn.findMany({
  where: {
    company_id: this.companyId,
    person_id: { in: personIds }, // All workers in one query
  },
});
// Then group by person_id using a Map
```

#### 2. Pre-computed Date Ranges
```typescript
import { precomputeDateRange, type PrecomputedDate } from '../../shared/utils';

// Pre-compute ONCE — stores dateStr + dow (day of week) for each date
const dateRange90d: PrecomputedDate[] = precomputeDateRange(startDate, 90, timezone);

// Each PrecomputedDate has:
// { dateStr: "2026-02-15", dow: "6" }  // Saturday

// Use for streak calculation, completion rate — no per-iteration Luxon calls
for (const day of dateRange90d) {
  if (workDays.includes(day.dow) && !holidayDates.has(day.dateStr)) {
    requiredDays++;
  }
}
```

#### 3. Date Lookup Maps (Efficient Timezone Conversion)
```typescript
import { buildDateLookup } from '../../shared/utils';

// Convert Date objects to timezone-aware strings in batch
const uniqueDates = [...new Set(checkIns.map(ci => ci.check_in_date.getTime()))].map(t => new Date(t));
const dateLookup: Map<number, string> = buildDateLookup(uniqueDates, timezone);

// O(1) lookup instead of per-record Luxon call
const dateStr = dateLookup.get(ci.check_in_date.getTime()) ?? formatDateInTimezone(ci.check_in_date, timezone);
```

#### 4. Immutable Snapshots
```typescript
// Snapshots are immutable — they capture state at a point in time.
// Store with the event record (e.g., missed_check_in.snapshot JSON column).
// Never update a snapshot after creation.

await tx.missedCheckIn.create({
  data: {
    // ... missed check-in fields
    snapshot: snapshot as Prisma.InputJsonValue, // Frozen state
  },
});
```

## Rules
- ✅ **DO** use batch queries with `person_id: { in: personIds }` — never query per worker
- ✅ **DO** pre-compute date ranges with `precomputeDateRange()` — shared across all workers
- ✅ **DO** use `buildDateLookup()` for efficient timezone conversion of dates
- ✅ **DO** use `getEffectiveSchedule()` for worker-specific schedule resolution
- ✅ **DO** make snapshots immutable — store as JSON, never update after creation
- ✅ **DO** include both raw metrics (counts) and derived indicators (isIncreasingFrequency)
- ❌ **NEVER** create one query per worker (N+1 problem) — always batch
- ❌ **NEVER** call `DateTime.fromJSDate()` inside a loop when processing dates — use pre-computed lookups
- ❌ **NEVER** mutate a snapshot after creation — it represents a frozen point in time

## Common Mistakes

### WRONG: Per-worker queries (N+1)
```typescript
async calculateBatch(workers: WorkerContext[]) {
  const results = new Map();
  for (const worker of workers) {
    // WRONG — fires N queries for N workers
    const checkIns = await this.prisma.checkIn.findMany({
      where: { person_id: worker.personId },
    });
    results.set(worker.personId, this.calculate(checkIns));
  }
  return results;
}
```

### CORRECT: Batch query + group
```typescript
async calculateBatch(workers: WorkerContext[]) {
  const personIds = workers.map(w => w.personId);

  // CORRECT — single query for all workers
  const allCheckIns = await this.prisma.checkIn.findMany({
    where: { person_id: { in: personIds } },
  });

  // Group by person_id
  const checkInsMap = new Map<string, CheckInRecord[]>();
  for (const ci of allCheckIns) {
    const list = checkInsMap.get(ci.person_id) ?? [];
    list.push(ci);
    checkInsMap.set(ci.person_id, list);
  }

  // Calculate per-worker using pre-grouped data
  const results = new Map();
  for (const worker of workers) {
    results.set(worker.personId, this.calculate(checkInsMap.get(worker.personId) ?? []));
  }
  return results;
}
```

### WRONG: Luxon inside loop
```typescript
for (const day = startDate; day < endDate; day.setDate(day.getDate() + 1)) {
  // WRONG — creating DateTime objects per iteration is expensive
  const dt = DateTime.fromJSDate(day).setZone(timezone);
  const dateStr = dt.toFormat('yyyy-MM-dd');
  const dow = dt.weekday === 7 ? '0' : String(dt.weekday);
}
```

### CORRECT: Pre-computed date range
```typescript
// CORRECT — all dates computed once
const dateRange = precomputeDateRange(startDate, 90, timezone);
for (const day of dateRange) {
  // day.dateStr and day.dow already computed
  if (workDays.includes(day.dow) && !holidays.has(day.dateStr)) {
    requiredDays++;
  }
}
```
