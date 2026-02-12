# Phase 2: Explicit Missed Check-In Resolution

**Gaps addressed**: #4 (Missed = Explicit Events), #5 (Late Resolves Missed)
**Risk**: Low -- extends existing missed check-in system
**Depends on**: Phase 1 (event types `MISSED_CHECK_IN_DETECTED`, `MISSED_CHECK_IN_RESOLVED`)

## Objective

When a worker submits a late check-in, resolve the existing missed check-in record instead of leaving it as an unresolved miss. Both the missed record AND the late check-in coexist -- preserving the full audit trail.

## Current Problem

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
06:05 AM - Window closes, worker hasn't submitted
         -> missed_check_in record created (with MISSED_CHECK_IN_DETECTED event from Phase 1)
07:30 AM - Worker submits check-in (late, flagged by Phase 1)
         -> check_in record created (is_late = true)
         -> missed_check_in record RESOLVED (resolved_by_check_in_id set)
         -> MISSED_CHECK_IN_RESOLVED event emitted
         -> Both records stay -- audit trail complete
```

## Database Changes

### Migration: Add resolution tracking to MissedCheckIn

```prisma
model MissedCheckIn {
  // ... existing fields ...

  // NEW: Track if/when this miss was resolved by a late submission
  resolved_by_check_in_id String?    // The late check-in that resolved this miss
  resolved_at             DateTime?  // When it was resolved

  // Relations
  resolved_check_in CheckIn? @relation("ResolvedMissedCheckIns",
    fields: [resolved_by_check_in_id], references: [id], onDelete: SetNull)

  @@index([company_id, resolved_at])
  @@index([company_id, person_id, missed_date, resolved_at]) // Unresolved misses query
}

model CheckIn {
  // ... existing fields ...
  resolved_missed_check_in MissedCheckIn? @relation("ResolvedMissedCheckIns")
}
```

## Backend Changes

### 1. MODIFY: `src/modules/check-in/check-in.service.ts`

Add missed resolution logic inside the transaction, after creating the check-in:

```typescript
async submit(input, personId, companyId): Promise<CheckIn> {
  // ... existing validation + readiness calculation ...

  const checkIn = await prisma.$transaction(async (tx) => {
    const event = await eventService.createEvent({ ... });
    const newCheckIn = await tx.checkIn.create({ ... });

    // NEW: If late submission, resolve existing missed check-in
    if (event.is_late) {
      const existingMiss = await tx.missedCheckIn.findFirst({
        where: {
          company_id: companyId,
          person_id: personId,
          missed_date: today,
          resolved_at: null, // Not yet resolved
        },
      });

      if (existingMiss) {
        await tx.missedCheckIn.update({
          where: { id: existingMiss.id },
          data: {
            resolved_by_check_in_id: newCheckIn.id,
            resolved_at: new Date(),
          },
        });

        // Fire-and-forget: emit resolution event
        eventService.createEvent({
          companyId,
          personId,
          eventType: 'MISSED_CHECK_IN_RESOLVED',
          entityType: 'missed_check_in',
          entityId: existingMiss.id,
          payload: {
            missedCheckInId: existingMiss.id,
            checkInId: newCheckIn.id,
            lateByMinutes: event.late_by_minutes,
          },
          timezone: this.timezone,
        }).catch(err => logger.error({ err }, 'Failed to emit resolution event'));
      }
    }

    return newCheckIn;
  });

  return checkIn;
}
```

### 2. MODIFY: `src/modules/missed-check-in/missed-check-in.repository.ts`

Update queries to support filtering by resolution status:

```typescript
async findAll(params: PaginationParams & { resolved?: boolean }) {
  const where = this.where({
    ...(params.resolved === true && { resolved_at: { not: null } }),
    ...(params.resolved === false && { resolved_at: null }),
  });

  // ... existing pagination logic ...
}
```

## Frontend Changes

### 1. MODIFY: `src/types/missed-check-in.types.ts`

```typescript
export interface MissedCheckIn {
  // ... existing fields ...
  resolvedByCheckInId?: string;
  resolvedAt?: string;
}
```

### 2. MODIFY: `src/features/team/pages/MissedCheckInsPage.tsx`

Add resolution status column:

```tsx
{
  accessorKey: 'resolvedAt',
  header: 'Status',
  cell: ({ row }) => {
    if (row.original.resolvedAt) {
      return <Badge variant="outline" className="text-amber-600 border-amber-300">
        Resolved (Late)
      </Badge>;
    }
    return <Badge variant="destructive">Unresolved</Badge>;
  },
}
```

### 3. MODIFY: `src/features/team/components/MemberMissedCheckInTable.tsx`

Same badge logic for individual worker missed check-in views.

## Key Files

| File | Action |
|------|--------|
| `aegira-backend/prisma/schema.prisma` | Modify MissedCheckIn + CheckIn models |
| `aegira-backend/src/modules/check-in/check-in.service.ts` | Modify (resolve missed on late submit) |
| `aegira-backend/src/modules/missed-check-in/missed-check-in.repository.ts` | Modify (filter by resolved) |
| `aegira-frontend/src/types/missed-check-in.types.ts` | Modify (add resolution fields) |
| `aegira-frontend/src/features/team/pages/MissedCheckInsPage.tsx` | Modify (status column) |
| `aegira-frontend/src/features/team/components/MemberMissedCheckInTable.tsx` | Modify (status badge) |

## Verification

1. Submit late check-in when missed record exists -> missed record gets `resolved_by_check_in_id` and `resolved_at`
2. Submit on-time check-in -> no resolution logic triggered
3. Submit late check-in when NO missed record exists -> no error (graceful handling)
4. Query missed check-ins with `resolved=false` -> only shows unresolved misses
5. Query missed check-ins with `resolved=true` -> shows resolved (late submission) misses
6. `MISSED_CHECK_IN_RESOLVED` event created with correct payload
