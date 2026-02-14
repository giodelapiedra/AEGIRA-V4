# Feature: Effective Next-Day Team Transfer

**Status**: Planned
**Priority**: Medium — fixes missed check-in detection gap on team transfers
**Depends on**: Phase 1 (Event Model), Phase 2 (Missed Resolution) — both completed

---

## 1. Problem Statement

### The Bug

When a worker is transferred between teams, the `team_id` and `team_assigned_at` fields update **immediately**. This creates a window where the missed check-in detector cannot catch the worker:

```
Timeline (Team A window: 6:00-10:00 AM):

09:00 AM  - Worker on Team A, hasn't checked in yet
09:15 AM  - Admin transfers worker to Team B (team_id → Team B, team_assigned_at → now)
10:02 AM  - Detector runs for Team A → worker NOT on Team A anymore → SKIPPED
10:02 AM  - Detector runs for Team B → worker "assigned today" → SKIPPED

Result: Worker missed Team A check-in but NO MissedCheckIn record was created.
```

### Secondary Issues

| # | Issue | Impact |
|---|-------|--------|
| 1 | Worker removed from team (team_id → null) escapes detection | Same gap — worker disappears from queries |
| 2 | Worker assigned today always gets grace, even if assigned at 5 AM with full window | Over-generous grace period |
| 3 | Dashboard shows "pending" then flips to "not_required" for same-day assigned | UI inconsistency |

### Why Immediate Transfer is Wrong

In workforce management systems (Deputy, Workday, When I Work, SAP SuccessFactors), team/shift changes take effect at a **defined boundary** (next shift, next day, next pay period). This prevents:
- Gaps in accountability tracking
- Confusion about which schedule applies today
- Workers gaming the system by requesting transfers to avoid missed check-ins

---

## 2. Solution: Effective Next-Day Transfer

### Core Concept

When admin transfers a worker from Team A to Team B:
1. Worker **stays on Team A** for the rest of today
2. Transfer **takes effect tomorrow** (next calendar day in company timezone)
3. Tomorrow, worker is on Team B with "Just Assigned" status (existing grace logic)
4. Day after tomorrow, worker checks in for Team B normally

**First assignment** (worker has no team yet) remains **immediate** — there's no old team to protect.

### Visual Flow

```
TODAY (Admin initiates transfer at any time):

  Person record:
    team_id            = Team A     ← UNCHANGED
    team_assigned_at   = [original] ← UNCHANGED
    effective_team_id  = Team B     ← NEW (pending)
    effective_transfer_date = tomorrow ← NEW

  Worker experience:
    - Dashboard shows: "Transfer scheduled to Team B starting tomorrow"
    - Check-in: normal for Team A
    - Missed detection: works for Team A (team_id unchanged)

  Team Lead A sees:
    - Worker still in member list
    - Badge: "Transferring out tomorrow"

  Team Lead B sees:
    - Worker NOT in list yet

─────────────────────────────────────────────────

TOMORROW (Transfer processor runs, 12:00 AM or first cron cycle):

  Person record:
    team_id            = Team B     ← UPDATED
    team_assigned_at   = today      ← UPDATED
    effective_team_id  = null       ← CLEARED
    effective_transfer_date = null  ← CLEARED

  Worker experience:
    - Dashboard shows: "Welcome to Team B! First check-in starts next work day"
    - Status: "Just Assigned" (existing logic, no code change)

  Team Lead B sees:
    - Worker in member list with "Just Assigned" badge (existing UI)

─────────────────────────────────────────────────

DAY AFTER TOMORROW:

  Normal check-in for Team B. Detection works normally.
```

---

## 3. Database Changes

### 3.1 Prisma Schema — Person Model

Add 3 fields to `Person` in `aegira-backend/prisma/schema.prisma`:

```prisma
model Person {
  // ... existing fields ...

  // Effective next-day transfer (pending)
  effective_team_id         String?    // Team being transferred TO
  effective_transfer_date   DateTime?  @db.Date  // Calendar date when transfer takes effect (UTC midnight)
  transfer_initiated_by     String?    // Admin user ID who initiated

  // ... existing relations ...

  // Add new relation
  effective_team            Team?      @relation("PendingTransfer", fields: [effective_team_id], references: [id], onDelete: SetNull)
}
```

Add reverse relation to `Team` model:

```prisma
model Team {
  // ... existing relations ...
  pending_transfers         Person[]   @relation("PendingTransfer")
}
```

### 3.2 Migration

File: `aegira-backend/prisma/migrations/20260213_add_effective_team_transfer/migration.sql`

```sql
ALTER TABLE "Person" ADD COLUMN "effective_team_id" TEXT;
ALTER TABLE "Person" ADD COLUMN "effective_transfer_date" DATE;
ALTER TABLE "Person" ADD COLUMN "transfer_initiated_by" TEXT;

-- Foreign key for effective_team_id → Team.id
ALTER TABLE "Person" ADD CONSTRAINT "Person_effective_team_id_fkey"
  FOREIGN KEY ("effective_team_id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for transfer processor query (find pending transfers by date)
CREATE INDEX "Person_effective_transfer_date_idx" ON "Person"("effective_transfer_date")
  WHERE "effective_transfer_date" IS NOT NULL;
```

---

## 4. Backend Changes

### 4.1 Person Repository (`aegira-backend/src/modules/person/person.repository.ts`)

#### SAFE_PERSON_SELECT — Add new fields

```typescript
const SAFE_PERSON_SELECT = {
  // ... existing fields ...
  effective_team_id: true,           // ADD
  effective_transfer_date: true,     // ADD
  transfer_initiated_by: true,       // ADD
} as const;
```

#### UpdatePersonData — Add new fields

```typescript
export interface UpdatePersonData {
  // ... existing fields ...
  effectiveTeamId?: string | null;
  effectiveTransferDate?: Date | null;
  transferInitiatedBy?: string | null;
}
```

#### update() method — Handle new fields

Add to the data spread in the update method:

```typescript
...(data.effectiveTeamId !== undefined && { effective_team_id: data.effectiveTeamId }),
...(data.effectiveTransferDate !== undefined && { effective_transfer_date: data.effectiveTransferDate }),
...(data.transferInitiatedBy !== undefined && { transfer_initiated_by: data.transferInitiatedBy }),
```

#### New method: findPendingTransfers()

```typescript
async findPendingTransfers(effectiveDate: Date): Promise<PendingTransferPerson[]> {
  return this.prisma.person.findMany({
    where: {
      company_id: this.companyId,
      is_active: true,
      effective_team_id: { not: null },
      effective_transfer_date: { lte: effectiveDate },
    },
    select: {
      id: true,
      effective_team_id: true,
      effective_transfer_date: true,
      effective_team: { select: { id: true, name: true } },
    },
  });
}
```

#### New method: executeTransfer()

```typescript
async executeTransfer(personId: string, newTeamId: string, effectiveDate: Date): Promise<void> {
  await this.prisma.person.update({
    where: { id: personId, company_id: this.companyId },
    data: {
      team_id: newTeamId,
      team_assigned_at: effectiveDate,
      effective_team_id: null,
      effective_transfer_date: null,
      transfer_initiated_by: null,
    },
  });
}
```

#### New method: cancelTransfer()

```typescript
async cancelTransfer(personId: string): Promise<void> {
  await this.prisma.person.update({
    where: { id: personId, company_id: this.companyId },
    data: {
      effective_team_id: null,
      effective_transfer_date: null,
      transfer_initiated_by: null,
    },
  });
}
```

### 4.2 Person Controller (`aegira-backend/src/modules/person/person.controller.ts`)

#### updatePerson() — Modified transfer logic

**Current flow** (lines 252-274):
```
teamChanged? → update team_id immediately → send notification
```

**New flow:**

```typescript
// Inside updatePerson(), replace the team assignment block:

const teamChanged = data.teamId !== undefined && data.teamId !== existing.team_id;
const isNewAssignment = !existing.team_id;  // Worker has NO team currently

if (teamChanged && data.teamId) {
  if (isNewAssignment) {
    // FIRST ASSIGNMENT — immediate (no old team to protect)
    // Keep existing behavior: team_id updates now
    // updateData.teamId stays in payload → repository sets team_id + team_assigned_at

  } else {
    // TRANSFER — effective next day
    // Do NOT change team_id now — set effective fields instead
    delete updateData.teamId;  // Remove from immediate update

    const timezone = c.get('companyTimezone') as string;
    const todayStr = getTodayInTimezone(timezone);
    const tomorrowDate = parseDateInTimezone(todayStr, timezone);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);  // Next calendar day

    updateData.effectiveTeamId = data.teamId;
    updateData.effectiveTransferDate = tomorrowDate;
    updateData.transferInitiatedBy = userId;

    // IMMEDIATE MISSED CHECK-IN CHECK:
    // If check-in window already closed and worker didn't check in today,
    // create MissedCheckIn record now (don't wait for detector)
    await createImmediateMissedCheckIn(companyId, id, existing, timezone, todayStr);
  }
} else if (teamChanged && !data.teamId) {
  // REMOVING from team — clear any pending transfer too
  updateData.effectiveTeamId = null;
  updateData.effectiveTransferDate = null;
  updateData.transferInitiatedBy = null;
}

// Also: if worker is deactivated, clear pending transfer
if (data.isActive === false && existing.is_active) {
  updateData.effectiveTeamId = null;
  updateData.effectiveTransferDate = null;
  updateData.transferInitiatedBy = null;
}
```

#### New helper: createImmediateMissedCheckIn()

```typescript
async function createImmediateMissedCheckIn(
  companyId: string,
  personId: string,
  person: SafePersonWithTeam,
  timezone: string,
  todayStr: string
): Promise<void> {
  try {
    if (!person.team_id || !person.team) return;

    const currentTime = getCurrentTimeInTimezone(timezone);
    const todayDow = getDayOfWeekInTimezone(timezone).toString();
    const todayDate = parseDateInTimezone(todayStr, timezone);

    // Get effective schedule
    const schedule = getEffectiveSchedule(
      { work_days: person.work_days, check_in_start: person.check_in_start, check_in_end: person.check_in_end },
      { work_days: person.team.work_days, check_in_start: person.team.check_in_start, check_in_end: person.team.check_in_end }
    );

    // Only create if: today is work day AND window already closed AND no check-in today
    if (!schedule.workDays.includes(todayDow)) return;
    if (currentTime <= schedule.checkInEnd) return;  // Window still open or hasn't started

    // Check for today's holiday
    const holiday = await isHoliday(prisma, companyId, todayStr);
    if (holiday) return;

    // Check if already checked in today
    const existingCheckIn = await prisma.checkIn.findFirst({
      where: { company_id: companyId, person_id: personId, check_in_date: todayDate },
      select: { id: true },
    });
    if (existingCheckIn) return;

    // Check if MissedCheckIn already exists (detector may have already caught it)
    const missedRepo = new MissedCheckInRepository(prisma, companyId);
    const existingMissed = await missedRepo.findExistingForDate(todayDate, [personId]);
    if (existingMissed.has(personId)) return;

    // Create MissedCheckIn record
    await missedRepo.createMany([{
      personId,
      teamId: person.team_id,
      missedDate: todayDate,
      scheduleWindow: `${formatTime12h(schedule.checkInStart)} - ${formatTime12h(schedule.checkInEnd)}`,
      reminderSent: true,
      reminderFailed: false,
    }]);

    logger.info({ personId, companyId, date: todayStr }, 'Created immediate missed check-in on transfer');
  } catch (error) {
    // Non-blocking: log but don't fail the transfer
    logger.error({ error, personId }, 'Failed to create immediate missed check-in on transfer');
  }
}
```

#### notifyWorkerTeamAssignment() — Modified messages

**Transfer (not immediate):**
```typescript
type: 'TEAM_ALERT'
title: 'Team Transfer Scheduled'
message: `You will be transferred to ${newTeamName} starting ${effectiveDateFormatted}. Please complete your check-in for ${currentTeamName} as usual today.`
```

**First assignment (immediate, unchanged):**
```typescript
// Keep existing notification logic (lines 26-97)
```

### 4.3 Transfer Processor — New Cron Job (`aegira-backend/src/jobs/transfer-processor.ts`)

```typescript
// Transfer Processor Job
// Runs every 15 minutes. Processes pending team transfers
// whose effective date has arrived.

import { prisma } from '../config/database';
import { PersonRepository } from '../modules/person/person.repository';
import { NotificationRepository } from '../modules/notification/notification.repository';
import { emitEvent } from '../modules/event/event.service';
import { logger } from '../config/logger';
import { getTodayInTimezone, parseDateInTimezone } from '../shared/utils';

let isRunning = false;

export async function processTransfers(): Promise<void> {
  if (isRunning) {
    logger.info('Skipping transfer processing: previous run still in progress');
    return;
  }

  isRunning = true;

  try {
    const companies = await prisma.company.findMany({
      where: { is_active: true },
      select: { id: true, timezone: true },
    });

    let totalProcessed = 0;

    for (const company of companies) {
      try {
        const processed = await processCompanyTransfers(company.id, company.timezone);
        totalProcessed += processed;
      } catch (error) {
        logger.error({ error, companyId: company.id }, 'Failed to process transfers for company');
      }
    }

    if (totalProcessed > 0) {
      logger.info({ totalProcessed }, 'Transfer processing completed');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to run transfer processing');
    throw error;
  } finally {
    isRunning = false;
  }
}

async function processCompanyTransfers(companyId: string, timezone: string): Promise<number> {
  const todayStr = getTodayInTimezone(timezone);
  const todayDate = parseDateInTimezone(todayStr, timezone);

  const personRepo = new PersonRepository(prisma, companyId);
  const pendingTransfers = await personRepo.findPendingTransfers(todayDate);

  if (pendingTransfers.length === 0) return 0;

  const notifRepo = new NotificationRepository(prisma, companyId);

  for (const transfer of pendingTransfers) {
    try {
      await personRepo.executeTransfer(
        transfer.id,
        transfer.effective_team_id!,
        todayDate
      );

      // Send welcome notification (fire-and-forget)
      const teamName = transfer.effective_team?.name ?? 'your new team';
      notifRepo.create({
        personId: transfer.id,
        type: 'TEAM_ALERT',
        title: `Welcome to ${teamName}!`,
        message: `Your transfer is complete. Your first check-in starts on your next scheduled work day.`,
      }).catch(err => logger.error({ err, personId: transfer.id }, 'Failed to send transfer notification'));

      // Emit event (fire-and-forget)
      emitEvent(prisma, {
        companyId,
        personId: transfer.id,
        eventType: 'TEAM_TRANSFER_COMPLETED',
        entityType: 'person',
        entityId: transfer.id,
        payload: {
          newTeamId: transfer.effective_team_id,
          newTeamName: teamName,
          effectiveDate: todayStr,
        },
        timezone,
      });

      logger.info(
        { personId: transfer.id, newTeamId: transfer.effective_team_id, companyId },
        'Transfer completed'
      );
    } catch (error) {
      logger.error({ error, personId: transfer.id }, 'Failed to execute transfer');
    }
  }

  return pendingTransfers.length;
}
```

### 4.4 Scheduler (`aegira-backend/src/jobs/scheduler.ts`)

Add the transfer processor to the scheduler:

```typescript
import { processTransfers } from './transfer-processor';

// Inside initializeScheduler():

// Transfer processor — runs every 15 min, same as detector
cron.schedule('*/15 * * * *', async () => {
  try {
    await processTransfers();
  } catch (error) {
    logger.error({ error }, 'Transfer processor failed');
  }
}, tzOptions);
```

### 4.5 Dashboard Service (`aegira-backend/src/modules/dashboard/dashboard.service.ts`)

#### Worker Dashboard — Add pending transfer info

In the Person query `select`, add:

```typescript
effective_team_id: true,
effective_transfer_date: true,
effective_team: { select: { id: true, name: true, check_in_start: true, check_in_end: true, work_days: true } },
```

Add to response:

```typescript
pendingTransfer: person?.effective_team_id ? {
  teamId: person.effective_team_id,
  teamName: person.effective_team?.name ?? null,
  effectiveDate: person.effective_transfer_date?.toISOString() ?? null,
  schedule: person.effective_team ? {
    checkInStart: person.effective_team.check_in_start,
    checkInEnd: person.effective_team.check_in_end,
    workDays: person.effective_team.work_days,
  } : null,
} : null,
```

#### Team Lead Dashboard — Add transfer flag to member statuses

In the `teamMembers` query select, add:

```typescript
effective_team_id: true,
effective_team: { select: { name: true } },
```

In `memberStatuses` map, add to the return object:

```typescript
transferringOut: !!member.effective_team_id,
transferringToTeam: member.effective_team?.name ?? null,
```

### 4.6 Missed Check-In Detector — NO CHANGES

File: `aegira-backend/src/jobs/missed-check-in-detector.ts`

**No modifications needed.** The detector already works correctly because:
- Worker stays on old team (`team_id` unchanged) → included in team query
- Worker has not been "newly assigned" (`team_assigned_at` unchanged) → not skipped
- After transfer completes → `team_assigned_at` = today → skipped as "Just Assigned" (existing logic)

---

## 5. Frontend Changes

### 5.1 Types

#### `aegira-frontend/src/types/person.types.ts`

Add to `Person` interface:

```typescript
effective_team_id?: string | null;
effective_transfer_date?: string | null;  // ISO date string
transfer_initiated_by?: string | null;
effective_team?: {
  id: string;
  name: string;
} | null;
```

#### `aegira-frontend/src/types/check-in.types.ts`

Add to `WorkerDashboardStats`:

```typescript
pendingTransfer: {
  teamId: string;
  teamName: string | null;
  effectiveDate: string | null;
  schedule: {
    checkInStart: string;
    checkInEnd: string;
    workDays: string;
  } | null;
} | null;
```

Add to `TeamMemberStatus`:

```typescript
transferringOut?: boolean;
transferringToTeam?: string | null;
```

### 5.2 Worker Dashboard (`aegira-frontend/src/features/dashboard/pages/WorkerDashboard.tsx`)

Add a transfer banner **above** the check-in area when `stats.pendingTransfer` exists:

```tsx
{stats?.pendingTransfer && (
  <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
    <CardContent className="py-4">
      <div className="flex items-start gap-3">
        <ArrowRightLeft className="h-5 w-5 text-blue-500 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-sm">Transfer Scheduled</p>
          <p className="text-sm text-muted-foreground">
            You'll be moving to <strong>{stats.pendingTransfer.teamName}</strong> starting{' '}
            {formatDate(stats.pendingTransfer.effectiveDate)}.
            Please complete your check-in as usual today.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

### 5.3 Admin Worker Edit Page (`aegira-frontend/src/features/admin/pages/AdminWorkerEditPage.tsx`)

#### A. Pending Transfer Badge

When worker has `effective_team_id`, show badge above the team selector:

```tsx
{person.effective_team && (
  <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
    <Clock className="h-4 w-4 text-amber-600" />
    <span className="text-sm">
      Transferring to <strong>{person.effective_team.name}</strong> on {formatDate(person.effective_transfer_date)}
    </span>
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCancelTransfer}
    >
      Cancel
    </Button>
  </div>
)}
```

#### B. Confirm Dialog on Team Change

When team changes AND worker already has a team, show ConfirmDialog:

```tsx
<ConfirmDialog
  open={showTransferConfirm}
  onOpenChange={setShowTransferConfirm}
  title="Transfer Worker"
  description={`${person.first_name} ${person.last_name} will be transferred from ${currentTeamName} to ${newTeamName}. Transfer takes effect tomorrow.`}
  confirmLabel="Confirm Transfer"
  onConfirm={handleConfirmTransfer}
/>
```

Modify `onSubmit`:
- If `teamId` changed AND worker has existing team → show ConfirmDialog instead of submitting directly
- On confirm → proceed with actual submit

#### C. Cancel Transfer

```typescript
const handleCancelTransfer = async () => {
  try {
    await updatePerson.mutateAsync({
      personId: person.id,
      data: { teamId: person.team_id },  // Set to current team = cancels transfer
    });
    toast({ variant: 'success', title: 'Transfer cancelled' });
  } catch (error) {
    toast({ variant: 'destructive', title: 'Failed to cancel transfer' });
  }
};
```

### 5.4 Team Lead Dashboard (`aegira-frontend/src/features/dashboard/pages/TeamLeaderDashboard.tsx`)

Add badge in member status rendering:

```tsx
{member.transferringOut && (
  <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
    <ArrowRightLeft className="h-3 w-3" />
    Transferring{member.transferringToTeam ? ` to ${member.transferringToTeam}` : ''}
  </Badge>
)}
```

### 5.5 API Endpoints — No New Endpoints

All transfer operations use the existing `PATCH /persons/:id` endpoint. No new endpoints or mutations needed.

---

## 6. Potential Issues & Mitigations

### P1: Transfer processor doesn't run (server down, cron failure)

| Aspect | Detail |
|--------|--------|
| **Risk** | Worker stays on old team indefinitely |
| **Likelihood** | Low — processor runs every 15 min |
| **Mitigation** | Processor checks `effective_transfer_date <= today`, so it catches up on any missed runs. Even if server was down for hours, next run processes all pending transfers. |

### P2: Admin transfers worker, then transfers AGAIN before effective date

| Aspect | Detail |
|--------|--------|
| **Risk** | Competing transfers |
| **Likelihood** | Low — uncommon but possible |
| **Mitigation** | `effective_team_id` is a single field — second transfer overwrites the first. Latest transfer wins. Updated notification sent to worker. Old transfer effectively cancelled. |

### P3: Worker removed from team while transfer is pending

| Aspect | Detail |
|--------|--------|
| **Risk** | `team_id` → null but `effective_team_id` still set. Transfer processor would put worker on a team they were removed from. |
| **Likelihood** | Medium |
| **Mitigation** | Controller clears `effective_*` fields when `team_id` is set to null. Code: `if (teamChanged && !data.teamId) { clear effective fields }` |

### P4: Worker deactivated while transfer is pending

| Aspect | Detail |
|--------|--------|
| **Risk** | Deactivated worker gets transferred, appears in new team |
| **Likelihood** | Low |
| **Mitigation** | Two layers: (1) Controller clears `effective_*` on deactivation. (2) Transfer processor filters by `is_active: true`. |

### P5: Timezone edge case — transfer at 11:55 PM

| Aspect | Detail |
|--------|--------|
| **Risk** | "Tomorrow" = 5 minutes away. Transfer happens almost immediately. |
| **Likelihood** | Rare |
| **Mitigation** | This is acceptable. The worker was on the old team for the full work day. Check-in window is long closed. Detection already ran. A 5-minute "overlap" at midnight is harmless. |

### P6: First assignment delayed unnecessarily

| Aspect | Detail |
|--------|--------|
| **Risk** | New worker assigned to team but can't check in until day after tomorrow |
| **Likelihood** | N/A — prevented by design |
| **Mitigation** | First assignment (`isNewAssignment = !existing.team_id`) is IMMEDIATE. Code explicitly checks and bypasses effective-date logic. |

### P7: Duplicate MissedCheckIn on transfer initiation

| Aspect | Detail |
|--------|--------|
| **Risk** | Controller creates MissedCheckIn AND detector creates another |
| **Likelihood** | Possible timing overlap |
| **Mitigation** | Three layers: (1) Controller's `createImmediateMissedCheckIn()` checks `findExistingForDate()` first. (2) Repository uses `skipDuplicates: true`. (3) DB has unique constraint on `[company_id, person_id, missed_date]`. |

### P8: Transfer effective date falls on holiday or non-work day

| Aspect | Detail |
|--------|--------|
| **Risk** | Worker "assigned today" on holiday — grace day wasted |
| **Likelihood** | Possible |
| **Mitigation** | Not actually an issue. On holidays, ALL workers are "not_required" regardless of assignment. The "assigned today" grace effectively shifts to the next work day automatically via existing `isAssignedToday && !windowOpen` logic. |

### P9: Admin edits other fields while transfer pending

| Aspect | Detail |
|--------|--------|
| **Risk** | Editing name/role accidentally clears or triggers transfer |
| **Likelihood** | Common |
| **Mitigation** | Controller only processes transfer when `teamId` is in the payload. The existing `teamChanged` guard (line 253) prevents this. `effective_*` fields are only touched when `teamId` explicitly changes. |

### P10: Frontend shows stale pending transfer after cancellation

| Aspect | Detail |
|--------|--------|
| **Risk** | Worker still sees "transferring" banner after admin cancels |
| **Likelihood** | Low |
| **Mitigation** | `useUpdatePerson` mutation's `onSuccess` invalidates `['persons']`, `['person', id]`, and `['dashboard']` query keys. Dashboard refetches on next render. |

---

## 7. Files Changed — Complete List

### New Files
| File | Purpose |
|------|---------|
| `aegira-backend/src/jobs/transfer-processor.ts` | Cron job: execute pending transfers |
| `aegira-backend/prisma/migrations/20260213_add_effective_team_transfer/migration.sql` | DB migration |

### Modified Files — Backend
| File | Changes |
|------|---------|
| `aegira-backend/prisma/schema.prisma` | Add 3 fields to Person + relation + Team reverse relation |
| `aegira-backend/src/modules/person/person.repository.ts` | `SAFE_PERSON_SELECT`, `UpdatePersonData`, `update()`, new `findPendingTransfers()`, `executeTransfer()`, `cancelTransfer()` |
| `aegira-backend/src/modules/person/person.controller.ts` | `updatePerson()` — transfer vs immediate logic, `createImmediateMissedCheckIn()` helper, notification messages |
| `aegira-backend/src/modules/dashboard/dashboard.service.ts` | Worker dashboard: `pendingTransfer` in response. Team lead: `transferringOut` flag. |
| `aegira-backend/src/jobs/scheduler.ts` | Register `processTransfers` cron |

### Modified Files — Frontend
| File | Changes |
|------|---------|
| `aegira-frontend/src/types/person.types.ts` | Add `effective_team_id`, `effective_transfer_date`, `effective_team` |
| `aegira-frontend/src/types/check-in.types.ts` | Add `pendingTransfer` to `WorkerDashboardStats`, `transferringOut` to `TeamMemberStatus` |
| `aegira-frontend/src/features/dashboard/pages/WorkerDashboard.tsx` | Transfer banner |
| `aegira-frontend/src/features/admin/pages/AdminWorkerEditPage.tsx` | ConfirmDialog + pending badge + cancel |
| `aegira-frontend/src/features/dashboard/pages/TeamLeaderDashboard.tsx` | "Transferring out" badge |

### NOT Modified (intentionally)
| File | Why |
|------|-----|
| `missed-check-in-detector.ts` | Worker stays on old team — detection works unchanged |
| `check-in.service.ts` | Worker checks in for old team — no change needed |
| `team-context.ts` | Access control unchanged — worker still on old team |
| `check-in.controller.ts` | Check-in submission unchanged |
| `person.validator.ts` | No new API fields — transfer is derived from teamId change |

---

## 8. Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Prisma schema + migration | `schema.prisma`, migration SQL |
| 2 | Run migration | `npm run db:migrate` |
| 3 | Repository updates | `person.repository.ts` |
| 4 | Controller transfer logic | `person.controller.ts` |
| 5 | Transfer processor cron job | `transfer-processor.ts` (new) |
| 6 | Register in scheduler | `scheduler.ts` |
| 7 | Dashboard service updates | `dashboard.service.ts` |
| 8 | Backend typecheck | `npm run typecheck` |
| 9 | Frontend types | `person.types.ts`, `check-in.types.ts` |
| 10 | Worker dashboard banner | `WorkerDashboard.tsx` |
| 11 | Admin edit page confirm + badge | `AdminWorkerEditPage.tsx` |
| 12 | Team lead dashboard badge | `TeamLeaderDashboard.tsx` |
| 13 | Frontend build check | `npm run build` |

---

## 9. Verification Checklist

### Scenario 1: Transfer flow (happy path)
- [ ] Create worker on Team A, check in normally
- [ ] Admin transfers worker to Team B
- [ ] Verify: `team_id` still Team A, `effective_team_id` = Team B
- [ ] Verify: Worker dashboard shows transfer banner
- [ ] Verify: Team Lead A sees "transferring out" badge
- [ ] Verify: Worker can still check in for Team A
- [ ] Verify: Detector runs → worker detected for Team A if missed
- [ ] Next day: transfer processor runs → `team_id` = Team B
- [ ] Verify: Worker sees "Just Assigned" (existing behavior)
- [ ] Verify: Notification sent: "Welcome to Team B"

### Scenario 2: First assignment (no delay)
- [ ] Create worker without team
- [ ] Admin assigns to Team A
- [ ] Verify: `team_id` = Team A immediately, `effective_team_id` = null

### Scenario 3: Cancel transfer
- [ ] Admin initiates transfer A → B
- [ ] Admin edits worker, sets team back to Team A (or clicks Cancel)
- [ ] Verify: `effective_*` fields cleared

### Scenario 4: Deactivation with pending transfer
- [ ] Worker has pending transfer
- [ ] Admin deactivates worker
- [ ] Verify: `effective_*` fields cleared
- [ ] Verify: Transfer processor skips deactivated worker

### Scenario 5: Double transfer before effective date
- [ ] Admin transfers A → B
- [ ] Admin transfers A → C (before B takes effect)
- [ ] Verify: `effective_team_id` = C (latest wins)
- [ ] Next day: worker on Team C (not B)

### Scenario 6: Immediate missed check-in on transfer
- [ ] Worker on Team A, window 6-10 AM
- [ ] Worker doesn't check in
- [ ] Admin transfers to Team B at 11 AM (after window)
- [ ] Verify: MissedCheckIn created for Team A immediately
- [ ] Verify: No duplicate when detector runs

### Scenario 7: Transfer during open window
- [ ] Window 6-10 AM, admin transfers at 8 AM
- [ ] Verify: No MissedCheckIn created (window still open)
- [ ] Worker can still check in for Team A until 10 AM

### Typecheck & Build
- [ ] `npm run typecheck` passes in `aegira-backend/`
- [ ] `npm run build` passes in `aegira-frontend/`
