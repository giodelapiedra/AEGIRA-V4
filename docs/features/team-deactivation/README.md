# Feature: Team Deactivation Guards

**Status**: Implemented (2026-02-13) — Option B (auto-unassign)
**Priority**: High — safety risk (unmonitored workers) + data integrity gaps
**Depends on**: Team Transfer feature (completed)
**Changelog**: [2026-02-13-team-deactivation-guards.md](../../changelogs/2026-02-13-team-deactivation-guards.md)

> **Note:** Implementation deviated from original plan (Option A: strict block). Instead used **Option B: auto-unassign members on deactivation** for better UX with large teams. Also added `NO_TEAM_ASSIGNED` guard (not in original plan) to block check-ins for workers without a team.

---

## 1. Problem Statement

### The Bug

When a team is deactivated (`is_active: false`), workers remain assigned but enter a **limbo state** — invisible on dashboards, not tracked by missed check-in detector, but still able to submit check-ins nobody monitors.

```
Current behavior when admin deactivates Team A:

  Workers:
    - team_id still points to Team A          ← NOT cleared
    - is_active still true                    ← NOT cascaded
    - Can still submit check-ins              ← ACCEPTED into black hole
    - Not flagged for missed check-ins        ← INVISIBLE to detector
    - Not visible on team lead dashboard      ← UNMONITORED
    - Not visible on supervisor dashboard     ← UNMONITORED

  Team Lead:
    - Dashboard shows empty/no team           ← Lost visibility

  Result: Workers are active in the system but nobody is monitoring them.
           In a WHS (workplace health & safety) system, this is a safety risk.
```

### All Bugs Discovered

| # | Scenario | Bug | Severity |
|---|----------|-----|----------|
| B1 | Deactivate team with active workers | Workers left unmonitored — no dashboard, no missed detection | **HIGH** |
| B2 | Worker on inactive team submits check-in | Check-in accepted but nobody sees it (data black hole) | **MEDIUM** |
| B3 | Deactivate person who leads active team | Team left with inactive leader, broken invariant | **MEDIUM** |
| B4 | Create new worker assigned to inactive team | Worker immediately in limbo state | **MEDIUM** |
| B5 | Transfer worker to inactive team via person edit | Transfer initiated to dead team | **MEDIUM** |

---

## 2. Solution: Block Invalid State Pattern

### Design Philosophy

Following the enterprise standard (Workday, SAP, BambooHR) and AEGIRA's existing pattern:

> **Prevent invalid states rather than auto-cascade.**

The admin must explicitly resolve dependencies before deactivating a team. This ensures:
- **Accountability** — every worker reassignment/deactivation is an explicit decision with audit trail
- **Safety** — no accidental mass deactivation of 30+ workers from one toggle
- **Reversibility** — no complex "undo cascade" logic needed for reactivation
- **Audit compliance** — per-person records of reassignment or deactivation

### What We Are NOT Doing (and why)

| Approach | Why Not |
|----------|---------|
| Auto-deactivate all members | Dangerous in WHS context — silently removes workers from monitoring |
| Auto-reassign to another team | Which team? Admin must make that decision explicitly |
| Allow deactivation with warning only | Workers would still be in limbo — problem not solved |
| Soft-block (warn but allow) | Same result as no guard — workers end up unmonitored |

---

## 3. Business Rules (Guards)

### Guard 1: `TEAM_HAS_ACTIVE_MEMBERS` — Block team deactivation

**Trigger:** Admin sets `isActive: false` on a team that has active workers assigned.

**Rule:** A team cannot be deactivated while it has active workers (`person.is_active = true AND person.team_id = team.id`).

**Admin workflow to deactivate a team:**
1. Go to each worker on the team
2. Either reassign them to another team OR deactivate them individually
3. Once team has zero active workers, deactivation is allowed

```
Error response:
{
  "success": false,
  "error": {
    "code": "TEAM_HAS_ACTIVE_MEMBERS",
    "message": "Cannot deactivate team — 5 active worker(s) are still assigned. Reassign or deactivate them first."
  }
}
```

**Files:** `team.controller.ts` (updateTeam), `team.repository.ts` (countActiveMembers)

---

### Guard 2: `TEAM_INACTIVE` — Block check-ins for inactive teams

**Trigger:** Worker on an inactive team attempts to submit a check-in.

**Rule:** Check-ins are rejected if the worker's team has `is_active = false`.

**Note:** The `team.is_active` field is already fetched in `check-in.repository.ts:getPersonWithTeam()` but never validated. This guard adds a single `if` check with zero additional DB queries.

```
Error response:
{
  "success": false,
  "error": {
    "code": "TEAM_INACTIVE",
    "message": "Your team has been deactivated. Contact your administrator."
  }
}
```

**Files:** `check-in.service.ts` (submit)

---

### Guard 3: `LEADER_HAS_ACTIVE_TEAM` — Block deactivating a team leader

**Trigger:** Admin deactivates a person (`isActive: false`) who is currently the `leader_id` of an active team.

**Rule:** A person who leads an active team cannot be deactivated. Admin must either reassign the team leader or deactivate the team first.

**Note:** This is different from the existing `LEADER_HAS_TEAM` guard (which blocks role changes). This specifically guards against person deactivation.

```
Error response:
{
  "success": false,
  "error": {
    "code": "LEADER_HAS_ACTIVE_TEAM",
    "message": "Cannot deactivate — this person leads active team \"Alpha Team\". Reassign the team leader or deactivate the team first."
  }
}
```

**Files:** `person.controller.ts` (updatePerson)

---

### Guard 4: `TEAM_INACTIVE_ASSIGNMENT` — Block assigning workers to inactive teams

**Trigger:** Admin creates a new worker assigned to an inactive team, OR transfers an existing worker to an inactive team.

**Rule:** Workers cannot be assigned to teams where `is_active = false`.

**Applies to:**
- `POST /persons` (createPerson) — new worker creation
- `PATCH /persons/:id` (updatePerson) — team change / transfer

```
Error response:
{
  "success": false,
  "error": {
    "code": "TEAM_INACTIVE_ASSIGNMENT",
    "message": "Cannot assign worker to inactive team. Reactivate the team first."
  }
}
```

**Files:** `person.controller.ts` (createPerson, updatePerson)

---

## 4. System Behavior Matrix

What works and what doesn't when a team has `is_active = false`:

| System Component | Behavior | Already Correct? |
|---|---|---|
| **Missed check-in detector** | Skips inactive teams — workers not flagged | YES (filters `is_active: true`) |
| **Team lead dashboard** | Shows empty/no team state | YES (filters `is_active: true`) |
| **Supervisor dashboard** | Team excluded from view | YES (filters `is_active: true`) |
| **Worker dashboard** | Still works (no `is_active` filter) | YES (worker sees own data) |
| **Team list (admin)** | Hidden by default, visible with `includeInactive` | YES |
| **Team list badge** | Shows "Active" / "Inactive" badge | YES |
| **Check-in submission** | Currently accepted — **WILL BE BLOCKED** | NO → Fix (Guard 2) |
| **Team deactivation** | Currently no guards — **WILL BE BLOCKED** if members exist | NO → Fix (Guard 1) |
| **Person deactivation** | Currently no leader check — **WILL BE BLOCKED** if leads active team | NO → Fix (Guard 3) |
| **Worker assignment** | Currently allows inactive teams — **WILL BE BLOCKED** | NO → Fix (Guard 4) |
| **Historical data** | Preserved (past check-ins, missed records, analytics) | YES (no data deleted) |

---

## 5. Scenarios & Test Cases

### Scenario 1: Happy Path — Deactivate Team

**Steps:**
1. Team A has 3 active workers + 1 team lead
2. Admin tries to deactivate Team A → **BLOCKED** (`TEAM_HAS_ACTIVE_MEMBERS`: 3 workers)
3. Admin reassigns Worker 1 to Team B
4. Admin reassigns Worker 2 to Team C
5. Admin deactivates Worker 3 (resigned)
6. Admin tries to deactivate Team A → **SUCCESS** (0 active workers)

**Expected state after deactivation:**
- Team A: `is_active = false`
- Worker 3: `is_active = false`, `team_id = Team A` (historical link preserved)
- Team lead still has `TEAM_LEAD` role, `leader_id` still points to them
- Team A hidden from team list (unless `includeInactive = true`)

---

### Scenario 2: Check-in Blocked for Inactive Team

**Steps:**
1. Somehow a worker ends up on an inactive team (e.g., race condition, direct DB edit)
2. Worker opens app, submits check-in
3. **BLOCKED** (`TEAM_INACTIVE`)

**Expected:** Worker sees error message, cannot check in. Must contact admin.

---

### Scenario 3: Cannot Deactivate Team Leader

**Steps:**
1. Juan is TEAM_LEAD, leads Team A (active)
2. Admin goes to Workers > Juan > toggle isActive off
3. **BLOCKED** (`LEADER_HAS_ACTIVE_TEAM`: "leads active team Alpha Team")
4. Admin first reassigns Team A's leader to Maria
5. Admin deactivates Juan → **SUCCESS**

---

### Scenario 4: Cannot Assign Worker to Inactive Team

**Steps:**
1. Team B is deactivated
2. Admin creates new worker, selects Team B from dropdown
3. **BLOCKED** (`TEAM_INACTIVE_ASSIGNMENT`)

**Note:** Frontend team dropdowns should ideally filter out inactive teams, but backend guard is the safety net.

---

### Scenario 5: Cannot Transfer to Inactive Team

**Steps:**
1. Team B is deactivated
2. Admin edits Worker Pedro (on Team A), changes team to Team B
3. **BLOCKED** (`TEAM_INACTIVE_ASSIGNMENT`)

---

### Scenario 6: Deactivate Team, Reactivate Later

**Steps:**
1. Team A deactivated (0 active workers)
2. Months later, admin reactivates Team A (`isActive: true`)
3. Team A appears in team list again
4. Admin assigns new workers to Team A
5. Workers can check in normally

**Expected:** No orphaned data. Clean reactivation.

---

### Scenario 7: Pending Transfer + Team Deactivation

**Steps:**
1. Worker has pending transfer to Team B (effective tomorrow)
2. Admin deactivates Team B today
3. Tomorrow, transfer processor runs
4. Transfer processor sees target team is inactive → **cancels transfer**, notifies worker

**Note:** This is already handled by the transfer processor fix (from team-transfer feature).

---

### Scenario 8: Race Condition — Simultaneous Deactivation

**Steps:**
1. Admin A opens Team A edit page (sees 1 worker)
2. Admin B reassigns the last worker away from Team A
3. Admin A toggles deactivation, saves
4. Backend checks `countActiveMembers` → 0 → **SUCCESS**

**Expected:** Safe. The guard checks at save time, not at page load time.

---

## 6. Implementation Plan

### Files to Modify

| File | Change |
|------|--------|
| `aegira-backend/src/modules/team/team.repository.ts` | Add `countActiveMembers()` method |
| `aegira-backend/src/modules/team/team.controller.ts` | Add `TEAM_HAS_ACTIVE_MEMBERS` guard in `updateTeam` |
| `aegira-backend/src/modules/check-in/check-in.service.ts` | Add `TEAM_INACTIVE` guard in `submit()` |
| `aegira-backend/src/modules/person/person.controller.ts` | Add `LEADER_HAS_ACTIVE_TEAM` guard + `TEAM_INACTIVE_ASSIGNMENT` guard |
| `aegira-frontend/src/features/admin/pages/AdminTeamEditPage.tsx` | Add `ConfirmDialog` for deactivation toggle |

### No Changes Needed

| File | Why |
|------|-----|
| `missed-check-in-detector.ts` | Already filters `is_active: true` teams |
| `dashboard.service.ts` | Already filters by active teams |
| Prisma schema | Uses existing `is_active` field, no migration needed |

### Implementation Order

1. Backend: `team.repository.ts` — add `countActiveMembers()`
2. Backend: `team.controller.ts` — add deactivation guard
3. Backend: `check-in.service.ts` — add inactive team check-in guard
4. Backend: `person.controller.ts` — add leader deactivation guard + inactive team assignment guard
5. Frontend: `AdminTeamEditPage.tsx` — add ConfirmDialog
6. Verify: `npm run typecheck` (backend) + `npm run build` (frontend)

---

## 7. Error Codes Reference

| Error Code | HTTP | Endpoint | Trigger |
|---|---|---|---|
| `TEAM_HAS_ACTIVE_MEMBERS` | 400 | `PATCH /teams/:id` | Deactivating team with active workers |
| `TEAM_INACTIVE` | 400 | `POST /check-ins` | Worker check-in on inactive team |
| `LEADER_HAS_ACTIVE_TEAM` | 400 | `PATCH /persons/:id` | Deactivating person who leads active team |
| `TEAM_INACTIVE_ASSIGNMENT` | 400 | `POST /persons`, `PATCH /persons/:id` | Assigning worker to inactive team |
