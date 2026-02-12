# Phase 1: Event Model Enhancement & Late Submission Tracking

**Gaps addressed**: #1 (Event-Time vs Database-Time), #5 (Late Submissions)
**Risk**: Low -- additive fields only, backward compatible
**Depends on**: Nothing (foundation phase)

## Objective

Add proper event-time tracking (`event_time`, `ingested_at`, `event_timezone`) to the existing Event model and allow late check-in submissions (currently rejected) while flagging them.

## Database Changes

### Migration: Enhance Event model

Add fields to `Event` model in `aegira-backend/prisma/schema.prisma`:

```prisma
model Event {
  // ... existing fields ...

  // NEW: Event-time tracking
  event_time     DateTime   // When event actually occurred (in worker's timezone)
  ingested_at    DateTime   // When server received it (UTC)
  event_timezone String     // Timezone of event (e.g., "Asia/Manila")

  // NEW: Late submission tracking
  is_late        Boolean @default(false)  // Submitted after window closed
  late_by_minutes Int?                    // Minutes after window close (null if on-time)

  // NEW indexes
  @@index([company_id, event_time])
  @@index([company_id, person_id, event_time])
}
```

Add new `EventType` values:
```prisma
enum EventType {
  // ... existing ...
  MISSED_CHECK_IN_DETECTED   // Explicit missed check-in event
  MISSED_CHECK_IN_RESOLVED   // Late submission resolved a miss
}
```

### Data backfill (in migration SQL)

```sql
UPDATE events SET
  event_time = created_at,
  ingested_at = created_at,
  event_timezone = (SELECT timezone FROM companies WHERE companies.id = events.company_id)
WHERE event_time IS NULL;
```

## Backend Changes

### 1. NEW: `src/modules/event/event.service.ts`

Centralized event creation with automatic time tracking:

```typescript
interface CreateEventInput {
  companyId: string;
  personId?: string;
  eventType: EventType;
  entityType: string;
  entityId?: string;
  payload: Record<string, unknown>;
  timezone: string;
  scheduleWindow?: { start: string; end: string }; // For late detection
}

export class EventService {
  async createEvent(input: CreateEventInput): Promise<Event> {
    const now = DateTime.now().setZone(input.timezone);
    const eventTime = now.toJSDate();
    const ingestedAt = new Date(); // UTC server time

    let isLate = false;
    let lateByMinutes: number | null = null;

    // Late detection: compare current time vs window end
    if (input.scheduleWindow) {
      const currentTime = now.toFormat('HH:mm');
      if (currentTime > input.scheduleWindow.end) {
        isLate = true;
        // Calculate minutes difference
        const [endH, endM] = input.scheduleWindow.end.split(':').map(Number);
        const endMinutes = endH * 60 + endM;
        const [curH, curM] = currentTime.split(':').map(Number);
        const curMinutes = curH * 60 + curM;
        lateByMinutes = curMinutes - endMinutes;
      }
    }

    return prisma.event.create({
      data: {
        company_id: input.companyId,
        person_id: input.personId,
        event_type: input.eventType,
        entity_type: input.entityType,
        entity_id: input.entityId,
        payload: input.payload,
        event_time: eventTime,
        ingested_at: ingestedAt,
        event_timezone: input.timezone,
        is_late: isLate,
        late_by_minutes: lateByMinutes,
      },
    });
  }
}
```

### 2. MODIFY: `src/modules/check-in/check-in.service.ts`

**Critical behavior change** (line 99-107):

**Before**: Check-ins outside window are REJECTED with `OUTSIDE_CHECK_IN_WINDOW` error.
**After**: Check-ins after window are ALLOWED but flagged as late. Before window still rejected.

```typescript
// BEFORE (line 99-107):
if (!isTimeWithinWindow(currentTime, schedule.checkInStart, schedule.checkInEnd)) {
  throw new AppError('OUTSIDE_CHECK_IN_WINDOW', '...', 400);
}

// AFTER:
if (currentTime < schedule.checkInStart) {
  // Too early - still reject
  throw new AppError('OUTSIDE_CHECK_IN_WINDOW',
    `Check-in window opens at ${schedule.checkInStart}`, 400);
}
// After window end = allowed but flagged as late (handled by EventService)
```

Replace raw `tx.event.create()` with `EventService`:
```typescript
const eventService = new EventService();
const event = await eventService.createEvent({
  companyId,
  personId,
  eventType: 'CHECK_IN_SUBMITTED',
  entityType: 'check_in',
  payload: { /* existing payload */ },
  timezone: this.timezone,
  scheduleWindow: scheduledWindow, // { start: schedule.checkInStart, end: schedule.checkInEnd }
});
```

### 3. MODIFY: `src/jobs/missed-check-in-detector.ts`

Emit `MISSED_CHECK_IN_DETECTED` event alongside existing missed_check_in record creation:

```typescript
// After creating missed check-in records
const eventService = new EventService();
for (const worker of newMissing) {
  eventService.createEvent({
    companyId,
    personId: worker.id,
    eventType: 'MISSED_CHECK_IN_DETECTED',
    entityType: 'missed_check_in',
    payload: {
      missedDate: todayStr,
      scheduleWindow: worker.scheduleWindow,
      teamId: worker.team_id,
    },
    timezone,
  }).catch(err => logger.error({ err }, 'Failed to emit missed event'));
}
```

## Frontend Changes

### 1. MODIFY: `src/types/check-in.types.ts`

```typescript
export interface CheckIn {
  // ... existing fields ...
  isLate?: boolean;
  lateByMinutes?: number;
  submittedAt: string; // event_time (actual submission time)
}
```

### 2. MODIFY: Check-in history columns

Show late submission badge in `CheckInHistoryPage.tsx` and `MemberCheckInTable.tsx`:

```tsx
{
  accessorKey: 'isLate',
  header: 'Status',
  cell: ({ row }) => {
    if (row.original.isLate) {
      return <Badge variant="warning">Late ({row.original.lateByMinutes}m)</Badge>;
    }
    return <Badge variant="success">On Time</Badge>;
  },
}
```

## Key Files

| File | Action |
|------|--------|
| `aegira-backend/prisma/schema.prisma` | Modify Event model + EventType enum |
| `aegira-backend/src/modules/event/event.service.ts` | NEW |
| `aegira-backend/src/modules/check-in/check-in.service.ts` | Modify (allow late, use EventService) |
| `aegira-backend/src/jobs/missed-check-in-detector.ts` | Modify (emit events) |
| `aegira-backend/src/shared/schedule.utils.ts` | Reuse `getEffectiveSchedule` |
| `aegira-frontend/src/types/check-in.types.ts` | Modify (add late fields) |
| `aegira-frontend/src/features/check-in/pages/CheckInHistoryPage.tsx` | Modify (late badge) |

## Verification

1. Submit check-in **during window** -> `is_late = false`, event has `event_time` and `event_timezone`
2. Submit check-in **after window** -> succeeds (no longer rejected), `is_late = true`, `late_by_minutes` populated
3. Submit check-in **before window opens** -> still rejected with `OUTSIDE_CHECK_IN_WINDOW`
4. Run missed check-in detector -> verify `MISSED_CHECK_IN_DETECTED` event created alongside record
5. Query events by `event_time` (not `created_at`) -> results ordered correctly
6. Existing backfilled events have `event_time = created_at` (no nulls)
