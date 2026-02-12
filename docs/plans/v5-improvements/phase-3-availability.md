# Phase 3: Availability Tracking (Leave/Off-Shift)

**Gap addressed**: Major Issue #2 (No Availability/Off-Shift Tracking)
**Risk**: Low -- new table, integrates with existing missed detection
**Depends on**: Phase 2 (missed resolution concept)

## Objective

Track worker availability (on leave, sick, off-shift) so the missed check-in detector can **excuse** workers who are unavailable instead of wrongly marking them as missed.

## Current Problem

```
Maria is on approved annual leave Feb 10-14.
Feb 12, 06:05 AM - Check-in window closes.
-> missed_check_in record created for Maria (WRONG!)
-> Maria's compliance rate drops unfairly
-> Team leader sees Maria as non-compliant
-> Maria gets "missed check-in" notification (annoying)
```

## After Phase 3

```
Feb 10 - Admin sets Maria's availability to ON_LEAVE (Feb 10-14)
Feb 12, 06:05 AM - Check-in window closes.
-> Missed detector checks availability table
-> Maria is ON_LEAVE -> SKIP (not marked as missed)
-> Compliance calculation: (completed) / (total - excused)
```

## Database Changes

### Migration: New Availability model

```prisma
enum AvailabilityStatus {
  AVAILABLE
  ON_LEAVE
  SICK
  OFF_SHIFT
}

model Availability {
  id             String             @id @default(uuid())
  company_id     String
  person_id      String
  status         AvailabilityStatus
  effective_from DateTime           @db.Date   // Start date (inclusive)
  effective_to   DateTime           @db.Date   // End date (inclusive)
  reason         String?
  approved_by    String?                       // Person who approved this
  created_at     DateTime           @default(now())
  updated_at     DateTime           @updatedAt

  // Relations
  company  Company @relation(fields: [company_id], references: [id], onDelete: Cascade)
  person   Person  @relation(fields: [person_id], references: [id], onDelete: Cascade)
  approver Person? @relation("AvailabilityApprovers", fields: [approved_by], references: [id], onDelete: SetNull)

  @@index([company_id, person_id, effective_from, effective_to])
  @@index([company_id, effective_from, effective_to])
  @@map("availabilities")
}
```

Add relations to Person:
```prisma
model Person {
  // ... existing ...
  availabilities          Availability[]
  approved_availabilities Availability[] @relation("AvailabilityApprovers")
}
```

## Backend Changes

### 1. NEW: `src/shared/availability.utils.ts`

```typescript
/**
 * Check if a worker is available on a specific date.
 * Returns the availability status or 'AVAILABLE' if no record found.
 */
export async function getWorkerAvailability(
  prisma: PrismaClient,
  companyId: string,
  personId: string,
  date: Date
): Promise<{ status: AvailabilityStatus; reason?: string }> {
  const availability = await prisma.availability.findFirst({
    where: {
      company_id: companyId,
      person_id: personId,
      effective_from: { lte: date },
      effective_to: { gte: date },
    },
    orderBy: { created_at: 'desc' }, // Most recent takes precedence
  });

  if (!availability) return { status: 'AVAILABLE' };
  return { status: availability.status, reason: availability.reason ?? undefined };
}
```

### 2. NEW: `src/modules/availability/` -- Full CRUD module

**Invoke**: `/backend-crud-module availability`

Generates:
- `availability.routes.ts` -- CRUD routes (Admin/Supervisor can manage)
- `availability.controller.ts` -- Standard controller pattern
- `availability.repository.ts` -- Extends BaseRepository
- `availability.validator.ts` -- Zod schemas

Additional endpoints:
- `GET /api/v1/availability` -- List all (paginated, filterable by person/status/date range)
- `GET /api/v1/availability/person/:personId` -- Get person's availability records
- `POST /api/v1/availability` -- Create availability record (Admin/Supervisor)
- `PATCH /api/v1/availability/:id` -- Update availability record
- `DELETE /api/v1/availability/:id` -- Delete availability record

### 3. MODIFY: `src/jobs/missed-check-in-detector.ts`

Before creating missed record, check availability:

```typescript
import { getWorkerAvailability } from '../shared/availability.utils';

// Inside processCompany(), before building missed records:
const availableWorkers = [];
for (const worker of eligibleWorkers) {
  const { status } = await getWorkerAvailability(prisma, companyId, worker.id, todayDate);
  if (status === 'AVAILABLE') {
    availableWorkers.push(worker);
  } else {
    logger.info({ personId: worker.id, status }, 'Worker excused from check-in');
  }
}

// Only create missed records for AVAILABLE workers
const newMissing = availableWorkers.filter(w => !checkedInIds.has(w.id));
```

### 4. MODIFY: `src/modules/check-in/check-in.service.ts`

In `getCheckInStatus()`, check availability:

```typescript
// If worker is on leave, update status message
const { status: availabilityStatus } = await getWorkerAvailability(
  prisma, companyId, personId, today
);
if (availabilityStatus !== 'AVAILABLE') {
  return {
    ...baseStatus,
    canCheckIn: false,
    message: `You are currently marked as ${availabilityStatus.toLowerCase().replace('_', ' ')}`,
  };
}
```

## Frontend Changes

### 1. NEW: Availability management pages

**Invoke**:
- `/data-table-page availability list` -- Paginated table of all availability records
- `/form-component availability create` -- Create availability form (person select, status, date range, reason)

### 2. NEW: Query/mutation hooks

**Invoke**:
- `/query-hooks availability` -- `useAvailabilities(page, limit, filters)`, `usePersonAvailability(personId)`
- `/mutation-hooks availability` -- `useCreateAvailability()`, `useUpdateAvailability()`, `useDeleteAvailability()`

### 3. MODIFY: `src/features/team/pages/MissedCheckInsPage.tsx`

Add visual indicator for excused workers or filter them out.

### 4. MODIFY: Sidebar navigation

Add "Availability" nav item for Admin and Supervisor roles.

### 5. MODIFY: Routes

Register availability pages in `routes/index.tsx` and `routes.config.ts`.

## Key Files

| File | Action |
|------|--------|
| `aegira-backend/prisma/schema.prisma` | New Availability model + enum |
| `aegira-backend/src/modules/availability/*` | NEW module (routes, controller, repository, validator) |
| `aegira-backend/src/shared/availability.utils.ts` | NEW utility |
| `aegira-backend/src/jobs/missed-check-in-detector.ts` | Modify (check availability before marking missed) |
| `aegira-backend/src/modules/check-in/check-in.service.ts` | Modify (check availability in getCheckInStatus) |
| `aegira-frontend/src/features/availability/*` | NEW feature pages |
| `aegira-frontend/src/components/layout/Sidebar.tsx` | Modify (add nav item) |
| `aegira-frontend/src/routes/index.tsx` | Modify (add routes) |

## Skills to Invoke

- `/backend-crud-module availability`
- `/data-table-page availability list`
- `/form-component availability create/edit`
- `/query-hooks availability`
- `/mutation-hooks availability`

## Verification

1. Set worker ON_LEAVE for today -> run missed detector -> worker NOT marked as missed
2. Set worker ON_LEAVE for yesterday -> submit check-in today -> allowed (availability is date-scoped)
3. Set worker SICK -> `getCheckInStatus()` returns `canCheckIn: false` with message
4. No availability record -> worker treated as AVAILABLE (default behavior unchanged)
5. Overlapping availability records -> most recent takes precedence
6. Admin can create/edit/delete availability records via API
