# 2026-02-13: Team Deactivation Guards

## Context

Code review of the team deactivation feature revealed that **zero safety guards were implemented** despite comprehensive planning docs. Deactivating a team left workers in a "limbo" state — active but invisible to all monitoring systems. Additionally, workers without a team could check in anytime without schedule enforcement.

## Approach: Option B (Auto-Unassign + Safety Net Guards)

Instead of strict blocking (Option A: admin must manually reassign each worker first), we implemented **auto-unassign on deactivation** — practical for large teams. Workers become unassigned and must be reassigned by admin before they can check in again.

## Changes

### 1. Team Deactivation — Auto-Unassign Members (NEW)

**File:** `team.controller.ts` → `updateTeam()`

When admin sets `isActive: false` on a team:
- All active members are unassigned (`team_id = null`) atomically
- All pending transfers TO this team are cancelled
- Team is deactivated
- Everything wrapped in `prisma.$transaction` — all or nothing

**Audit log** includes `unassignedMembers` count.

### 2. Check-In Guard — NO_TEAM_ASSIGNED (NEW)

**File:** `check-in.service.ts` → `submit()` + `getCheckInStatus()`

- `submit()`: Throws `NO_TEAM_ASSIGNED` if worker has no team
- `getCheckInStatus()`: Returns `canCheckIn: false` with message "You are not assigned to a team. Contact your administrator."

**Bug fixed:** Previously, workers without a team could check in anytime with zero schedule validation.

### 3. Check-In Guard — TEAM_INACTIVE (NEW)

**File:** `check-in.service.ts` → `submit()` + `getCheckInStatus()`

- `submit()`: Throws `TEAM_INACTIVE` if `person.team.is_active === false`
- `getCheckInStatus()`: Returns `canCheckIn: false` with message "Your team has been deactivated. Contact your administrator."

**Safety net** for edge cases where a worker somehow ends up on an inactive team (race condition, direct DB edit).

### 4. Person Guard — TEAM_INACTIVE_ASSIGNMENT (NEW)

**File:** `person.controller.ts` → `createPerson()` + `updatePerson()`

Blocks assigning or transferring a worker to an inactive team. Checked in both create and update paths.

### 5. Person Guard — LEADER_HAS_ACTIVE_TEAM (NEW)

**File:** `person.controller.ts` → `updatePerson()`

Blocks deactivating a person who leads an active team. Admin must reassign the team leader or deactivate the team first.

**Placement:** Guard runs BEFORE transfer logic to prevent fire-and-forget side effects on rejection.

### 6. Team Repository Helpers (NEW)

**File:** `team.repository.ts`

- `countActiveMembers(teamId)` — counts all active members (any role) assigned to a team
- `unassignMembers(teamId)` — bulk unassigns members + cancels pending transfers

## QA Bugs Found & Fixed During Implementation

| # | Bug | Fix |
|---|-----|-----|
| 1 | No transaction — unassign + team update were separate DB ops; if update failed, members already unassigned on active team | Wrapped in `prisma.$transaction` |
| 2 | `LEADER_HAS_ACTIVE_TEAM` guard placed AFTER fire-and-forget side effects (transfer events) | Moved guard before transfer logic |
| 3 | `countActiveMembers` counted WORKER role only; non-worker members stayed assigned to inactive team | Changed to count all roles |

## Files Modified

| File | Change |
|------|--------|
| `aegira-backend/src/modules/team/team.repository.ts` | Added `countActiveMembers()`, `unassignMembers()` |
| `aegira-backend/src/modules/team/team.controller.ts` | Added transactional deactivation guard + auto-unassign |
| `aegira-backend/src/modules/check-in/check-in.service.ts` | Added `NO_TEAM_ASSIGNED` + `TEAM_INACTIVE` guards |
| `aegira-backend/src/modules/person/person.controller.ts` | Added `TEAM_INACTIVE_ASSIGNMENT` + `LEADER_HAS_ACTIVE_TEAM` guards |

## No Changes Needed (Already Correct)

| Component | Why |
|-----------|-----|
| `missed-check-in-detector.ts` | Already filters `is_active: true` teams |
| `dashboard.service.ts` | Already filters active teams |
| `whs-dashboard.service.ts` | Already filters active teams |
| `transfer-processor.ts` | Already cancels transfers to inactive teams |
| Prisma schema | Uses existing `is_active` field, no migration needed |

## Error Codes

| Code | HTTP | Endpoint | Trigger |
|------|------|----------|---------|
| `NO_TEAM_ASSIGNED` | 400 | `POST /check-ins` | Worker without team tries to check in |
| `TEAM_INACTIVE` | 400 | `POST /check-ins` | Worker on inactive team tries to check in |
| `TEAM_INACTIVE_ASSIGNMENT` | 400 | `POST /persons`, `PATCH /persons/:id` | Assigning worker to inactive team |
| `LEADER_HAS_ACTIVE_TEAM` | 400 | `PATCH /persons/:id` | Deactivating person who leads active team |

## Verification

- `npm run typecheck`: 15 errors (all pre-existing, 0 new)
- 12 scenarios traced and verified (see QA review in conversation)
