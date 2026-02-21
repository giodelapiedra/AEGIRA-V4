# Phase 2: Explicit Missed Check-In Resolution

**Status**: COMPLETED (2026-02-21)
**Gaps addressed**: #4 (Missed = Explicit Events), #5 (Late Resolves Missed)
**Risk**: Low -- extends existing missed check-in system
**Depends on**: Phase 1 (event types `MISSED_CHECK_IN_DETECTED`, `MISSED_CHECK_IN_RESOLVED`)

## Objective

When a worker submits a late check-in, resolve the existing missed check-in record instead of leaving it as an unresolved miss. Both the missed record AND the late check-in coexist -- preserving the full audit trail.

## Before Phase 2

```
06:05 AM - Window closes, worker hasn't submitted
         -> missed_check_in record created
07:30 AM - Worker submits check-in (late)
         -> check_in record created
         -> missed_check_in record still exists as "missed" (WRONG)
         -> System shows worker as both "checked in" AND "missed" for the same day
```

## After Phase 2

```
Scenario A: Late submission AFTER cron detected the miss
  06:05 AM - Cron detects missed -> missed_check_in record created + MISSED_CHECK_IN_DETECTED event
  07:30 AM - Worker submits late  -> check_in created (is_late = true)
                                  -> existing missed_check_in RESOLVED (resolved_by_check_in_id set)
                                  -> MISSED_CHECK_IN_RESOLVED event emitted (post-commit, fire-and-forget)

Scenario B: Late submission BEFORE cron runs (pre-cron)
  10:01 AM - Worker submits late (window closed at 10:00, cron hasn't run yet)
           -> check_in created (is_late = true)
           -> missed_check_in UPSERTED as already-resolved (ensures stats count the miss)
           -> MISSED_CHECK_IN_RESOLVED event emitted (post-commit, fire-and-forget)
```

## Database Changes

### Migration: Add resolution tracking to MissedCheckIn

```prisma
model MissedCheckIn {
  // ... existing fields ...

  // Resolution tracking - set when late check-in resolves this miss
  resolved_by_check_in_id String?   @unique  // 1:1 — one check-in resolves at most one miss
  resolved_at             DateTime?

  // Relations
  resolved_check_in CheckIn? @relation("ResolvedMissedCheckIns",
    fields: [resolved_by_check_in_id], references: [id], onDelete: SetNull)

  @@index([company_id, resolved_at])
  @@index([company_id, person_id, missed_date, resolved_at])
}

model CheckIn {
  // ... existing fields ...
  resolved_missed_check_in MissedCheckIn? @relation("ResolvedMissedCheckIns")
}
```

## Backend Changes (As Implemented)

### 1. `src/modules/check-in/check-in.service.ts` — submit()

Resolution logic runs inside the `$transaction`, event emission runs **outside** (post-commit):

```typescript
const { checkIn, resolvedMiss } = await prisma.$transaction(async (tx) => {
  const eventData = buildEventData({ ..., capturedTimeHHmm: currentTime });
  const event = await tx.event.create({ data: eventData });
  const newCheckIn = await tx.checkIn.create({ ... });

  if (event.is_late) {
    // Scenario A: Cron already created the missed record — update it
    const existingMiss = await tx.missedCheckIn.findFirst({
      where: { company_id: companyId, person_id: personId, missed_date: today, resolved_at: null },
    });

    if (existingMiss) {
      await tx.missedCheckIn.update({
        where: { id: existingMiss.id },
        data: { resolved_by_check_in_id: newCheckIn.id, resolved_at: new Date() },
      });
    } else {
      // Scenario B: Pre-cron late submission — upsert a pre-resolved missed record
      await tx.missedCheckIn.upsert({
        where: { person_id_missed_date: { person_id: personId, missed_date: today } },
        create: { ...snapshotData, resolved_by_check_in_id: newCheckIn.id, resolved_at: new Date() },
        update: { resolved_by_check_in_id: newCheckIn.id, resolved_at: new Date() },
      });
    }
  }

  return { checkIn: newCheckIn, resolvedMiss: resolvedMissData };
});

// Post-commit: fire-and-forget event (never creates orphan events on rollback)
if (resolvedMiss) {
  emitEvent(prisma, {
    eventType: 'MISSED_CHECK_IN_RESOLVED',
    entityType: 'missed_check_in',
    entityId: resolvedMiss.missedCheckInId,
    payload: { missedCheckInId, checkInId, lateByMinutes, missedDate },
    timezone: this.timezone,
  });
}
```

Key design decisions:
- **`buildEventData()`** used inside transaction (atomic with check-in)
- **`emitEvent()`** used outside transaction (fire-and-forget, prevents orphan events per BUG-02 fix)
- **Upsert** in Scenario B handles race condition with cron natively (PostgreSQL atomic upsert)

### 2. `src/modules/missed-check-in/missed-check-in.repository.ts` — findByFilters()

```typescript
async findByFilters(filters: MissedCheckInFilters) {
  const where: Prisma.MissedCheckInWhereInput = {
    company_id: this.companyId,
    ...(filters.teamIds?.length && { team_id: { in: filters.teamIds } }),
    ...(filters.personId && { person_id: filters.personId }),
    ...(filters.resolved === true && { resolved_at: { not: null } }),
    ...(filters.resolved === false && { resolved_at: null }),
  };
  // ... pagination logic ...
}
```

Controller parses `?resolved=true|false` query param and passes to repository.

## Frontend Changes (As Implemented)

### 1. `src/types/missed-check-in.types.ts`

```typescript
export interface MissedCheckIn {
  // ... existing fields ...
  resolvedByCheckInId: string | null;  // explicit null, not optional
  resolvedAt: string | null;
}
```

### 2. Shared status badge — `src/components/common/badge-utils.tsx`

```tsx
export function MissedCheckInStatusBadge({ resolvedAt }: { resolvedAt?: string | null }) {
  if (resolvedAt) {
    return <Badge variant={SEMANTIC_STATUS.MISSED_CHECK_IN_STATUS.RESOLVED_LATE.variant}>
      {SEMANTIC_STATUS.MISSED_CHECK_IN_STATUS.RESOLVED_LATE.label}
    </Badge>;
  }
  return <Badge variant={SEMANTIC_STATUS.MISSED_CHECK_IN_STATUS.UNRESOLVED.variant}>
    {SEMANTIC_STATUS.MISSED_CHECK_IN_STATUS.UNRESOLVED.label}
  </Badge>;
}
```

Semantic constants in `lib/constants/index.ts`:
- `RESOLVED_LATE`: amber badge, label "Resolved (Late)"
- `UNRESOLVED`: destructive badge, label "Unresolved"

### 3. Used in both table pages

- `MissedCheckInsPage.tsx` — team-level missed check-ins list
- `MemberMissedCheckInTable.tsx` — individual worker missed history

Both use the shared `MissedCheckInStatusBadge` component in their column definitions and detail sheets.

## Key Files

| File | Change |
|------|--------|
| `aegira-backend/prisma/schema.prisma` | Added `resolved_by_check_in_id` (@unique), `resolved_at`, relation, indexes |
| `aegira-backend/src/modules/check-in/check-in.service.ts` | Scenario A (update) + Scenario B (upsert) in transaction, post-commit event |
| `aegira-backend/src/modules/missed-check-in/missed-check-in.repository.ts` | `findByFilters()` with `resolved` param |
| `aegira-frontend/src/types/missed-check-in.types.ts` | `resolvedByCheckInId: string | null`, `resolvedAt: string | null` |
| `aegira-frontend/src/components/common/badge-utils.tsx` | Shared `MissedCheckInStatusBadge` component |
| `aegira-frontend/src/features/team/pages/MissedCheckInsPage.tsx` | Status column with badge |
| `aegira-frontend/src/features/team/components/MemberMissedCheckInTable.tsx` | Status column with badge |

## QA Notes

### Investigated and confirmed safe (no action needed)

1. **Transfer side-effects timing** — Side-effects (events, notifications) already fire after `repository.update()` resolves. If DB write fails, exception prevents side-effects from executing.

2. **`updatePersonSchema` null clearing** — `.refine()` already enforces `checkInStart` and `checkInEnd` must both be null or both be valid strings. Single-field null payloads are rejected.

3. **Immediate vs cron boundary mismatch** — Immediate detector triggers at `currentTime > checkInEnd`, cron waits `checkInEnd + 2 minutes`. The 2-minute gap is cosmetic — in both cases the missed record ends up resolved when the late check-in comes in. No functional impact.

4. **Notification boundary at exact window end** — Notification uses `<` while check-in status uses `<=`. A 1-second theoretical edge case with no real-world user impact.

## Verification

1. Submit late check-in when missed record exists -> missed record gets `resolved_by_check_in_id` and `resolved_at` (Scenario A)
2. Submit late check-in when NO missed record exists (pre-cron) -> missed record upserted as already-resolved (Scenario B)
3. Submit on-time check-in -> no resolution logic triggered
4. Query missed check-ins with `resolved=false` -> only shows unresolved misses
5. Query missed check-ins with `resolved=true` -> shows resolved (late submission) misses
6. `MISSED_CHECK_IN_RESOLVED` event created with correct payload, post-commit only
7. Transaction rollback -> no orphan events created
