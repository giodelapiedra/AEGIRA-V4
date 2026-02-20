# Event Sourcing Pattern
> Centralized event creation with time tracking, late detection, and fire-and-forget emission

## When to Use
- Recording state changes as immutable Event records (check-in submitted, missed check-in detected, transfer executed)
- Inside `$transaction` blocks where events must be atomic with the data mutation
- Fire-and-forget event emission for non-critical state tracking (e.g., job-detected events)
- Any operation that needs late detection relative to a schedule window

## Canonical Implementation

### buildEventData — Data Builder (Transaction-Safe)
```typescript
import { buildEventData } from '../../modules/event/event.service';
import type { CreateEventInput } from '../../modules/event/event.service';

// Inside a $transaction — use buildEventData() to create the data object,
// then pass it to tx.event.create(). This keeps the event atomic with the mutation.
const result = await prisma.$transaction(async (tx) => {
  const eventData = buildEventData({
    companyId,
    personId,
    eventType: 'CHECK_IN_SUBMITTED',
    entityType: 'check_in',
    payload: { ...input, readiness },
    timezone,
    scheduleWindow: { start: schedule.checkInStart, end: schedule.checkInEnd },
  });

  const event = await tx.event.create({ data: eventData });

  return tx.checkIn.create({
    data: {
      company_id: companyId,
      person_id: personId,
      event_id: event.id,
      check_in_date: today,
      // ... other fields
    },
  });
});
```

### emitEvent — Fire-and-Forget (Outside Transactions)
```typescript
import { emitEvent } from '../../modules/event/event.service';

// For non-critical events that don't need atomicity.
// Logs errors internally, never throws. Safe to call without await.
emitEvent(prisma, {
  companyId,
  personId: worker.personId,
  eventType: 'MISSED_CHECK_IN_DETECTED',
  entityType: 'missed_check_in',
  entityId: missedRecord.id,
  payload: { teamId: worker.teamId, missedDate: dateStr },
  timezone,
});
```

### Post-Transaction Event Emission
```typescript
// When an event must be emitted AFTER a transaction succeeds
// but is not itself part of the transaction (to prevent orphan events):
const result = await prisma.$transaction(async (tx) => {
  // ... atomic mutations ...
  return updated;
});

// OUTSIDE the transaction — only fires if tx succeeded
emitEvent(prisma, {
  companyId,
  eventType: 'MISSED_CHECK_IN_RESOLVED',
  entityType: 'missed_check_in',
  entityId: result.id,
  payload: { resolvedBy: 'late_check_in' },
  timezone,
});
```

### CreateEventInput Interface
```typescript
interface CreateEventInput {
  companyId: string;
  personId?: string;
  eventType: EventType;       // Prisma enum: CHECK_IN_SUBMITTED, MISSED_CHECK_IN_DETECTED, etc.
  entityType: string;         // 'check_in', 'missed_check_in', 'team', 'person'
  entityId?: string;
  payload: Record<string, unknown>;
  timezone: string;           // From c.get('companyTimezone')
  scheduleWindow?: { start: string; end: string }; // HH:mm — triggers late detection
}
```

### Event Fields Created Automatically
| Field | Source | Description |
|-------|--------|-------------|
| `event_time` | `DateTime.now().setZone(timezone)` | When event occurred in company timezone |
| `ingested_at` | `new Date()` | UTC server receive time |
| `event_timezone` | Input `timezone` | Company timezone for reference |
| `is_late` | Late detection | `true` if current time > `scheduleWindow.end` |
| `late_by_minutes` | Late detection | Minutes past deadline, or `null` if on time |

### Late Detection Logic
```typescript
// Late detection compares current HH:mm against scheduleWindow.end.
// Only triggered when scheduleWindow is provided.
//
// currentTime "10:15" vs window.end "10:00" → isLate: true, lateByMinutes: 15
// currentTime "09:45" vs window.end "10:00" → isLate: false, lateByMinutes: null
// No scheduleWindow provided                → isLate: false, lateByMinutes: null
```

## Rules
- ✅ **DO** use `buildEventData()` inside `$transaction` blocks — returns `Prisma.EventUncheckedCreateInput`
- ✅ **DO** use `emitEvent()` for fire-and-forget events outside transactions
- ✅ **DO** pass `timezone` from `c.get('companyTimezone')` — never hardcode
- ✅ **DO** pass `scheduleWindow` when the event relates to a check-in window (enables late detection)
- ✅ **DO** emit post-transaction events OUTSIDE the `$transaction` block to prevent orphan events
- ✅ **DO** include meaningful `payload` with context (IDs, scores, reasons)
- ❌ **NEVER** use raw `tx.event.create({ data: { ... } })` — required fields will be missing
- ❌ **NEVER** `await` `emitEvent()` — it's fire-and-forget by design
- ❌ **NEVER** emit events inside a transaction if failure of the event should NOT roll back the transaction

## Common Mistakes

### WRONG: Raw event.create (missing required fields)
```typescript
await tx.event.create({
  data: {
    company_id: companyId,
    event_type: 'CHECK_IN_SUBMITTED',
    entity_type: 'check_in',
    payload: input,
    // WRONG — missing event_time, ingested_at, event_timezone, is_late, late_by_minutes
  },
});
```

### CORRECT: Use buildEventData
```typescript
const eventData = buildEventData({
  companyId,
  personId,
  eventType: 'CHECK_IN_SUBMITTED',
  entityType: 'check_in',
  payload: input,
  timezone,
  scheduleWindow: { start: schedule.checkInStart, end: schedule.checkInEnd },
});
await tx.event.create({ data: eventData });
```

### WRONG: Event inside transaction that should survive tx failure
```typescript
await prisma.$transaction(async (tx) => {
  await tx.missedCheckIn.update({ ... });
  // WRONG — if tx fails, this event is orphaned (created then rolled back)
  emitEvent(prisma, { eventType: 'MISSED_CHECK_IN_RESOLVED', ... });
});
```

### CORRECT: Event after transaction
```typescript
const result = await prisma.$transaction(async (tx) => {
  return tx.missedCheckIn.update({ ... });
});
// CORRECT — only fires if transaction succeeded
emitEvent(prisma, {
  eventType: 'MISSED_CHECK_IN_RESOLVED',
  entityId: result.id,
  ...
});
```
