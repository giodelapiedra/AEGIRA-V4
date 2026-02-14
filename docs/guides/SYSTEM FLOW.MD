# AEGIRA V5 - Complete System Flow & Function Catalog

> Last updated: 2026-02-13
> This document maps every system function, step-by-step flow, scenario, edge case, and known issue.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Role Map & Access Matrix](#2-role-map--access-matrix)
3. [Core System Flows](#3-core-system-flows)
   - 3.1 Authentication
   - 3.2 Daily Check-In (Core Feature)
   - 3.3 Missed Check-In Detection (Automated)
   - 3.4 Team Transfer
   - 3.5 Team Management
   - 3.6 Worker (Person) Management
   - 3.7 Dashboards
   - 3.8 Incident & Case Management
   - 3.9 Notifications
   - 3.10 Admin Operations
4. [Scheduled Jobs](#4-scheduled-jobs)
5. [Cross-Cutting Patterns](#5-cross-cutting-patterns)
6. [Data Model Summary](#6-data-model-summary)
7. [API Endpoint Catalog](#7-api-endpoint-catalog)
8. [Frontend Pages & User Flows](#8-frontend-pages--user-flows)
9. [Readiness Score Algorithm](#9-readiness-score-algorithm)
10. [Identified Bugs & Edge Cases](#10-identified-bugs--edge-cases)
11. [Strengths & Limitations](#11-strengths--limitations)
12. [Improvement Suggestions](#12-improvement-suggestions)
13. [Target Industries](#13-target-industries)

---

## 1. System Overview

AEGIRA is a **multi-tenant workforce readiness and health management system** for organizations with team-based, shift-based, or safety-critical work environments.

### Core Purpose

- Track daily worker wellness via standardized check-ins (sleep, stress, physical condition, pain)
- Calculate readiness scores (0-100) to identify at-risk workers BEFORE incidents occur
- Detect and manage missed check-ins automatically with contextual state snapshots
- Report and manage workplace health incidents through a structured case management workflow
- Provide role-specific dashboards for 5 distinct user roles

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Hono (Node.js ESM) + Prisma + PostgreSQL |
| Frontend | React 18 + Vite + TanStack Query v5 |
| Auth | JWT (httpOnly cookies) + bcrypt |
| Validation | Zod (client + server) |
| Timezone | Luxon (default: Asia/Manila) |
| Storage | Cloudflare R2 (S3-compatible) |
| Scheduling | node-cron |
| Charts | Recharts |
| UI | Radix UI + Tailwind CSS + shadcn/ui |

### Architecture

```
Request → secureHeaders → CORS → Logger → authMiddleware → tenantMiddleware → roleMiddleware → zValidator → Controller → Service → Repository → Prisma → PostgreSQL
```

Each backend module: `routes.ts` → `controller.ts` → `service.ts` (optional) → `repository.ts` → `validator.ts`
Each frontend feature: `pages/` → `components/` (optional) → `hooks/`

---

## 2. Role Map & Access Matrix

### Roles

| Role | Purpose |
|------|---------|
| **ADMIN** | Full system management. Teams, workers, holidays, settings, audit logs. |
| **WHS** | Workplace Health & Safety officer. Incident review, case management, analytics. |
| **SUPERVISOR** | Multi-team oversight. Views all supervised teams' compliance and readiness. |
| **TEAM_LEAD** | Single team management. Monitors team check-ins, missed check-ins, analytics. Team leads also check in daily. |
| **WORKER** | Daily check-in submission. Views personal dashboard, reports incidents. |

### Access Matrix

| Feature | WORKER | TEAM_LEAD | SUPERVISOR | WHS | ADMIN |
|---------|:------:|:---------:|:----------:|:---:|:-----:|
| Daily check-in | X | X | - | - | - |
| Check-in history (own) | X | X | - | - | - |
| Worker dashboard | X | - | - | - | - |
| Team lead dashboard | - | X | - | - | - |
| Supervisor dashboard | - | - | X | - | - |
| Admin dashboard | - | - | - | - | X |
| WHS dashboard | - | - | - | X | - |
| Team missed check-ins | - | X | X | X | X |
| Team check-in history | - | X | X | X | X |
| Team analytics | - | X | X | - | - |
| Team members list | - | X | X | - | - |
| Report incident | X | X | X | X | X |
| My incidents | X | X | X | X | X |
| Admin incidents list | - | - | - | X | X |
| Approve/reject incident | - | - | - | X | - |
| Admin cases list | - | - | - | X | X |
| Manage case | - | - | - | X | - |
| WHS workers lookup | - | - | - | X | - |
| WHS analytics | - | - | - | X | - |
| Manage teams | - | - | - | - | X |
| Manage workers | - | - | - | - | X |
| Manage holidays | - | - | - | - | X |
| Company settings | - | - | - | - | X |
| Audit logs | - | - | - | - | X |
| Notifications | X | X | X | X | X |
| Profile settings | X | X | X | X | X |

---

## 3. Core System Flows

### 3.1 Authentication Flow

**Endpoints:** POST /auth/signup, POST /auth/login, GET /auth/me, POST /auth/logout, PATCH /auth/change-password, POST /auth/verify-password, POST /auth/refresh (NOT IMPLEMENTED)

#### Scenario 1: New Company Signup
```
1. User submits: email, password, first/last name, company name
2. Zod validates + trims email + toLowerCase
3. Hash password (bcrypt, 12 rounds)
4. Generate company slug: "{name}-{timestamp_base36}"
5. TRANSACTION:
   - Create Company (timezone: Asia/Manila default)
   - Create Person (role: ADMIN, is_active: true)
6. Generate JWT (sub=personId, companyId, role, email)
7. Set httpOnly cookie (maxAge synced from JWT_EXPIRES_IN)
8. Return user + company data → redirect to admin dashboard
```

#### Scenario 2: Worker Login
```
1. User submits: email, password
2. Zod trims + lowercases email
3. Find active person in active company by email
4. Verify password (bcrypt)
5. Generate JWT → set httpOnly cookie
6. Fire-and-forget: audit log (if role is ADMIN/WHS/SUPERVISOR/TEAM_LEAD)
7. Return user data → redirect to role-specific dashboard
```

#### Scenario 3: Password Change
```
1. User submits: currentPassword, newPassword
2. Verify current password (bcrypt)
3. Hash new password → update DB
4. ROTATE JWT → generate new token → set new cookie
5. Fire-and-forget: audit log
6. Return success
```
**Important:** JWT rotation prevents old token reuse after password change.

#### Scenario 4: Session Check (GET /me)
```
1. Extract JWT from cookie → validate
2. Find person by ID → verify active + company active
3. Return profile data
```

#### Scenario 5: Logout
```
1. Delete auth_token cookie
2. Return success → redirect to login
```

**Edge Cases:**
- Email is unique PER COMPANY (not globally) — `@@unique([company_id, email])`
- Inactive users/companies are blocked from login
- `POST /auth/refresh` returns 501 (NOT IMPLEMENTED)

---

### 3.2 Daily Check-In Flow (CORE FEATURE)

**Endpoints:** POST /check-ins, GET /check-ins/today, GET /check-ins/status, GET /check-ins/history, GET /check-ins/:id
**Roles:** WORKER, TEAM_LEAD

#### Scenario 1: Normal Check-In (Within Window)
```
1. Worker opens /check-in page
2. Frontend calls GET /check-ins/status
3. Backend checks (parallel):
   - Is today a holiday? (cached, 1h TTL)
   - Person + active team with schedule?
4. Validation guards (in order):
   a. Person must be active
   b. Must have active team assigned
   c. Today must NOT be holiday
   d. Today must be scheduled work day (worker override → team fallback)
   e. Current time must be >= checkInStart (too early = REJECTED)
   f. Late submissions ARE ALLOWED (tracked, not rejected)
5. If canCheckIn=true → frontend shows 4-step form:
   Step 1: Sleep (hours 0-15 decimal, quality 1-10 slider)
   Step 2: Energy & Stress (energy 1-10, stress 1-10 sliders)
   Step 3: Physical (pain 0-10, pain location dropdown if pain>0, notes)
   Step 4: Additional notes (optional, max 500 chars)
6. Worker submits → POST /check-ins
7. Backend calculates readiness score (see Section 9)
8. TRANSACTION:
   - Create Event (CHECK_IN_SUBMITTED) with time tracking:
     - event_time: current time in company timezone
     - ingested_at: UTC server time
     - is_late: false (within window)
   - Create CheckIn record with scores
9. Return: readiness_score, readiness_level (GREEN/YELLOW/RED), component scores
10. Frontend shows score → redirects to dashboard
```

#### Scenario 2: Late Check-In (After Window Closes)
```
1-6. Same as Scenario 1 (late is allowed, only "too early" is rejected)
7. Backend detects: current time > checkInEnd
8. TRANSACTION:
   - Create Event with is_late=true, late_by_minutes=N
   - Create CheckIn record
   - Check for unresolved MissedCheckIn for today:
     - If found → update: resolved_by_check_in_id, resolved_at=now
9. POST-TRANSACTION (if miss resolved):
   - Fire-and-forget: emit MISSED_CHECK_IN_RESOLVED event
10. Return check-in data
```
**Key:** Late check-ins automatically resolve missed check-in records.

#### Scenario 3: Too Early Check-In
```
1. Worker tries to check in before window opens (e.g., 5:30 AM, window starts 6:00 AM)
2. Backend: current time < checkInStart → throw AppError("TOO_EARLY")
3. Frontend shows: "Check-in window opens at 06:00"
```

#### Scenario 4: Holiday
```
1. GET /check-ins/status → isHoliday=true, canCheckIn=false
2. Frontend shows: "Today is {holidayName}. No check-in required."
3. Dashboard shows holiday card (no check-in button)
```

#### Scenario 5: Day Off (Not Scheduled Work Day)
```
1. GET /check-ins/status → isWorkDay=false, canCheckIn=false
2. Frontend shows: "Today is your day off."
```

#### Scenario 6: Worker Just Assigned Today
```
1. Worker assigned to team today (team_assigned_at = today)
2. GET /check-ins/status:
   - isAssignedToday=true
   - canCheckIn=true IF window is currently open
   - If window hasn't opened: shows welcome message
3. Worker CAN check in if window is open
4. Missed check-in detector will NOT penalize them (assigned today = excluded)
```

#### Scenario 7: Duplicate Check-In Attempt
```
1. Worker already checked in today
2. POST /check-ins → Prisma throws P2002 (unique constraint on person_id + check_in_date)
3. Backend catches → returns DUPLICATE_CHECK_IN error
4. Frontend: GET /check-ins/today shows existing submission
```

#### Scenario 8: Worker with Schedule Override
```
1. Worker has personal work_days="1,2,3" (Mon-Wed only) + team has "1,2,3,4,5"
2. getEffectiveSchedule() resolves: worker's days take priority
3. Thursday: isWorkDay=false → cannot check in
4. Worker can also override check_in_start/check_in_end independently
5. Guard: if override creates inverted window (start >= end), fall back to team's window
```

---

### 3.3 Missed Check-In Detection (Automated Job)

**Job:** Runs every 15 minutes via node-cron
**Lock:** In-memory lock prevents concurrent runs

#### Scenario 1: Normal Detection Flow
```
1. Job triggers → acquire in-memory lock
2. FOR EACH active company:
   a. Get today's date + current time in company timezone
   b. Check if today is holiday → if YES, skip entire company
   c. Get all active teams with leaders
   d. Get all active workers (role=WORKER) with schedule overrides
   e. FILTER eligible workers:
      - team_assigned_at < today (assigned BEFORE today)
      - Today is work day (using effective schedule per worker)
      - Check-in window has CLOSED + 2-minute buffer
   f. PARALLEL QUERIES:
      - Today's check-ins for eligible workers
      - Holiday date set (last 90 days for snapshots)
   g. EXCLUDE: already checked in today + already has MissedCheckIn record (idempotent)
   h. BATCH calculate state snapshots (MissedCheckInSnapshotService):
      - dayOfWeek, weekOfMonth
      - daysSinceLastCheckIn, daysSinceLastMiss
      - checkInStreakBefore (consecutive work days with check-ins)
      - recentReadinessAvg (7-day average)
      - missesInLast30d, missesInLast60d, missesInLast90d
      - baselineCompletionRate (checkIns / requiredDays since assignment)
      - isFirstMissIn30d (missesInLast30d === 0)
      - isIncreasingFrequency (rate30d > rate60d && missesInLast30d >= 2)
      - workerRoleAtMiss, teamLeaderIdAtMiss, teamLeaderNameAtMiss
   i. INSERT MissedCheckIn records with snapshots
   j. NOTIFICATIONS (fire-and-forget):
      - Each worker: "You missed your check-in for {date}"
      - Each team lead: "{count} workers missed check-in" (grouped)
   k. EVENTS (fire-and-forget): MISSED_CHECK_IN_DETECTED per worker
3. Log total detected across all companies
4. Release lock
```

#### Scenario 2: Worker Assigned Today → EXCLUDED
```
Worker with team_assigned_at = today is filtered out at step (e).
They are NOT penalized for missing check-in on their first day.
```

#### Scenario 3: Job Runs Multiple Times Same Day → IDEMPOTENT
```
Step (g) checks for existing MissedCheckIn records.
If record already exists for person_id + missed_date, worker is skipped.
No duplicates created.
```

#### Scenario 4: Late Check-In After Detection
```
1. 10:02 AM: Detector creates MissedCheckIn for worker (window was 06:00-10:00)
2. 11:30 AM: Worker submits late check-in
3. Check-in service finds unresolved MissedCheckIn for today
4. Updates: resolved_by_check_in_id, resolved_at
5. Emits MISSED_CHECK_IN_RESOLVED event
```

**Snapshot Performance Optimizations:**
- Batch queries for ALL workers (no N+1)
- Pre-computed 90-day date range (shared across workers)
- Date lookup maps (avoid per-record Luxon calls)
- String comparison instead of date arithmetic where possible

---

### 3.4 Team Transfer Flow

**Endpoints:** PATCH /persons/:id (team change), DELETE /persons/:id/pending-transfer
**Job:** Transfer Processor (every 15 minutes)

#### Scenario 1: First Team Assignment (No Previous Team)
```
1. Admin assigns worker to team (worker currently has team_id=null)
2. IMMEDIATE: set team_id + team_assigned_at = now
3. Fire-and-forget: notify worker with team name + schedule info
4. Worker can check in same day if window is open
```

#### Scenario 2: Team Transfer (Worker Already on a Team)
```
1. Admin changes worker's team → effective NEXT DAY
2. System calculates tomorrow using Luxon: DateTime.now().setZone(tz).plus({ days: 1 })
3. Sets: effective_team_id, effective_transfer_date=tomorrow, transfer_initiated_by=adminId
4. IF check-in window already closed today:
   - Fire-and-forget: create immediate MissedCheckIn with snapshot
5. Fire-and-forget: emit TEAM_TRANSFER_INITIATED event
6. Notify worker: "You're transferring to {team} tomorrow. Remember to check in today."
7. Worker dashboard shows pending transfer banner
---
8. Transfer Processor job (every 15 min) picks up on transfer date:
   a. Find persons with effective_transfer_date <= today
   b. For each:
      - IF target team is inactive → CANCEL transfer, notify worker
      - ELSE → execute: update team_id, team_assigned_at=today, clear transfer fields
      - Notify worker: "Welcome to {new team}!"
      - Emit TEAM_TRANSFER_COMPLETED event
```

#### Scenario 3: Cancel Pending Transfer
```
1. Admin calls DELETE /persons/:id/pending-transfer
2. Verify pending transfer exists
3. Clear: effective_team_id, effective_transfer_date, transfer_initiated_by
4. Notify worker: "Your transfer has been cancelled"
5. Audit log
```

#### Scenario 4: Target Team Deactivated Before Transfer
```
1. Transfer scheduled for tomorrow
2. Admin deactivates target team today
3. Transfer Processor finds inactive target team
4. CANCELS transfer (clears fields) instead of executing
5. Notifies worker: "Transfer cancelled — team no longer active"
```

#### Scenario 5: Transfer Race Condition (Intentional)
```
1. Worker's transfer is scheduled for today
2. Worker checks in at 7 AM (processor hasn't run yet)
3. Check-in validates against CURRENT team's schedule (correct)
4. Processor runs at 7:15 AM → moves worker to new team
5. Design decision: race window is brief (15 min max), worker's check-in is valid
```

---

### 3.5 Team Management Flow

**Endpoints:** CRUD /teams, GET /teams/:id/members, GET /teams/my-members, GET /teams/check-in-history, GET /teams/missed-check-ins, GET /teams/analytics

#### Scenario 1: Create Team
```
1. Admin submits: name, description, leaderId (required), supervisorId (optional), schedule
2. Validate: team name unique per company
3. Validate leader: exists, active, role=TEAM_LEAD, NOT already leading another team
4. Validate supervisor (if provided): exists, active, role=SUPERVISOR
5. Create team record
6. Fire-and-forget: notify team lead (assignment)
7. Fire-and-forget: audit log
```

#### Scenario 2: Deactivate Team (CRITICAL)
```
1. Admin sets isActive=false on PATCH /teams/:id
2. TRANSACTION:
   a. Unassign ALL active members (set team_id=null, team_assigned_at=null)
   b. Cancel pending transfers TO this team
   c. Cancel pending transfers FROM this team's members
   d. Update team: is_active=false + any other changes
3. Fire-and-forget: audit log with unassigned count
4. All members become "orphaned" (no team) — admin must reassign
```

#### Scenario 3: Team Context (Who Sees What)
```
- TEAM_LEAD: teamIds = [team where leader_id = userId] → sees only their team
- SUPERVISOR: teamIds = [teams where supervisor_id = userId] → sees assigned teams
- ADMIN: teamIds = null → no filter, sees ALL teams
- Used by: /teams/my-members, /teams/check-in-history, /teams/missed-check-ins, /teams/analytics
```

---

### 3.6 Worker (Person) Management Flow

**Endpoints:** CRUD /persons, GET /persons/me, PATCH /persons/me, POST /persons/me/avatar

#### Scenario 1: Create Worker
```
1. Admin submits: email, password, name, role, teamId, optional schedule override
2. Validate: email unique per company
3. Guard: role=WORKER requires teamId (workers must have a team)
4. Validate team: exists, active
5. Hash password (bcrypt)
6. Create person record
7. Fire-and-forget: notify worker with team schedule
8. Fire-and-forget: audit log
```

#### Scenario 2: Update Worker (Self-Protection Guards)
```
- Cannot change OWN role
- Cannot deactivate OWN account
- Cannot demote TEAM_LEAD who currently leads a team
- Cannot deactivate TEAM_LEAD who leads an active team
- Cannot make role=WORKER if person has no team in final state
```

#### Scenario 3: Role Change from WORKER
```
1. Admin changes worker's role to TEAM_LEAD/SUPERVISOR/etc.
2. System clears: schedule overrides (work_days, check_in_start, check_in_end)
3. System clears: pending transfer fields
4. Non-workers don't need schedule overrides or team transfers
```

#### Scenario 4: Avatar Upload
```
1. User uploads image (POST /persons/me/avatar, max 5MB)
2. Validate: JPEG/PNG/WebP
3. Delete old avatar from R2 (fire-and-forget)
4. Upload new to R2: avatars/{companyId}/{personId}.{ext}
5. Update profile_picture_url in DB
6. Audit log
```

---

### 3.7 Dashboard Flows

**Endpoints:** GET /dashboard/worker, /team-lead, /supervisor, /admin, /whs, /whs-analytics, /trends, /team/:id

#### Worker Dashboard
```
Data (parallel queries):
- Person + team + pending transfer info
- Last 30 days check-ins
- Holiday check (today + last 30 days)

Calculated:
- Streak: consecutive work days with check-ins going backward from yesterday
  - Skips holidays and non-work days (don't break streak)
  - Adds today if already checked in
- Completion rate: checkIns / requiredDays this week
  - Skips today if window hasn't opened yet
  - Excludes holidays and non-work days
- Weekly trend: 7 days, null for missing (consistent chart rendering)
- Schedule context: isWorkDay, isHoliday, windowOpen/Closed, times

UI States:
- New worker (no check-ins ever) → Welcome card
- Checked in today → Score card with breakdown + recommendations
- Holiday → Holiday name card
- Day off → Day off message
- Assigned today → Welcome message
- Window not open → "Opens at {time}"
- Window open → Check-in button (CTA)
- Window closed → "Window closed" message
- Pending transfer → Transfer banner with date + new team
```

#### Team Lead Dashboard
```
Data (parallel queries):
- Team + all members with schedule overrides
- Today's check-ins for team workers
- Holiday check (today)

Per-Worker Status Classification:
- "submitted" → checked in today
- "pending" → work day + window open + hasn't checked in
- "missed" → work day + window closed + hasn't checked in
- "not_required" → holiday OR day off OR assigned today

Metrics:
- expectedCheckIns = teamSize - notRequiredCount
- pendingCheckIns = should check in but haven't
- missedCheckIns = past window without check-in
- complianceRate = submitted / expected (%)
- teamAvgReadiness = avg score of today's submissions

Schedule-Aware: uses per-worker effective schedule (override → team fallback)
```

#### Supervisor Dashboard
```
Same schedule-aware logic as team lead, but across ALL supervised teams.
Batch queries (parallel) for all teams at once.
Per-team summary: name, leader, workerCount, submissions/expected, avg readiness, compliance.
Aggregate totals across all teams.
```

#### Admin Dashboard
```
System overview only (no check-in data):
- Total teams (active/inactive)
- Total workers, team leads, supervisors
- Unassigned workers count
Uses groupBy queries for efficiency.
```

#### WHS Dashboard
```
- Pending incidents count + top 5 table
- My open cases (assigned to current user)
- Total open cases
- Resolved this month
- Cases by status donut chart
- Recent activity timeline
```

#### WHS Analytics
```
Period: 7d / 30d / 90d
- Incident trend chart (area: total/approved/rejected over time)
- Incident type distribution (donut)
- Severity distribution (donut)
- Rejection reason breakdown (donut)
- Summary stats: total incidents, cases created, approval rate, avg response/resolution time
- Team incident table: team name, count, severity breakdown
```

---

### 3.8 Incident & Case Management Flow

**Endpoints:** POST /incidents, GET /incidents, GET /incidents/my, GET /incidents/:id, GET /incidents/:id/timeline, PATCH /incidents/:id/approve, PATCH /incidents/:id/reject, GET /cases, GET /cases/:id, PATCH /cases/:id

#### Full Incident Lifecycle
```
1. REPORT (any authenticated user)
   - Submit: type, severity, title, location, description
   - Retry loop (max 3): generate sequential incident_number per company
   - TRANSACTION: Create Incident + Create Event (INCIDENT_CREATED)
   - Fire-and-forget: audit log
   - Fire-and-forget: notify ALL WHS + ADMIN ("New incident pending review")
   - Return incident with number (e.g., #INC-042)

2. REVIEW (WHS only)
   a. APPROVE PATH:
      - TRANSACTION:
        - Update incident: status=APPROVED, reviewed_by, reviewed_at
        - Generate case_number (retry-safe)
        - Create Case: auto-assign to approving WHS officer
        - Create Event (INCIDENT_APPROVED)
        - Create Event (CASE_CREATED)
      - Fire-and-forget: audit log
      - Fire-and-forget: notify reporter ("Incident approved, case #CASE-{N} created")

   b. REJECT PATH:
      - Input: rejectionReason (enum), rejectionExplanation (text)
      - TRANSACTION:
        - Update incident: status=REJECTED, rejection fields
        - Create Event (INCIDENT_REJECTED)
      - Fire-and-forget: audit log
      - Fire-and-forget: notify reporter ("Incident rejected: {reason}")

3. CASE MANAGEMENT (WHS only)
   - Update status: Open → Investigating → Resolved → Closed
   - Assign to WHS officer (dropdown of active WHS users)
   - Add notes (max 2000 chars)
   - TRANSACTION: Update Case + Create Event (CASE_UPDATED or CASE_RESOLVED)
   - If status=RESOLVED: set resolved_at

4. TIMELINE
   - GET /incidents/:id/timeline
   - Returns all Events for entity_type=incident, entity_id=incidentId
   - Includes person names for each event
   - Shows: created → approved/rejected → case created → case updates
```

**Valid Status Transitions:**
- Incident: PENDING → APPROVED or REJECTED (one-way, no reversal)
- Case: OPEN → INVESTIGATING → RESOLVED → CLOSED
- Case shortcuts: OPEN → RESOLVED (skip investigating), OPEN → CLOSED

**Access Control:**
- Reporter can view own incident + linked case
- WHS/ADMIN can view all incidents and cases
- Only WHS can approve/reject/manage

---

### 3.9 Notification Flow

**Endpoints:** GET /notifications, GET /notifications/unread, PATCH /notifications/mark-all-read, PATCH /notifications/:id/read

**Notification Types:**
| Type | Triggered By | Recipient |
|------|-------------|-----------|
| CHECK_IN_REMINDER | (future) | Worker |
| MISSED_CHECK_IN | Missed check-in detector | Worker + Team Lead |
| TEAM_ALERT | Team/person changes, transfers | Worker, Team Lead |
| SYSTEM | System events | Varies |
| INCIDENT_SUBMITTED | New incident | All WHS + ADMIN |
| INCIDENT_APPROVED | Incident approved | Reporter |
| INCIDENT_REJECTED | Incident rejected | Reporter |

**Key Behaviors:**
- All notifications created fire-and-forget (never block main operation)
- Mark as read is idempotent (already-read returns success)
- Mark all read is batch update
- Frontend: bell icon with unread count badge → dropdown (5 recent) → /notifications page

---

### 3.10 Admin Operations

**Endpoints:** GET/PATCH /admin/company/settings, CRUD /admin/holidays, GET /admin/audit-logs, GET /admin/users/roles, PATCH /admin/users/:id/role

#### Company Settings
```
Update: name, timezone, industry, business info, address
IMPORTANT: invalidates company cache (timezone may have changed)
Audit log (fire-and-forget)
```

#### Holiday Management
```
Create/Update/Delete holidays per company
Fields: name, date, is_recurring (annual)
IMPORTANT: invalidates holiday cache after every CRUD operation
Impact: holidays prevent check-in requirements + excluded from compliance calculations
Recurring holidays match month/day across years
```

#### User Role Management
```
Guards:
- Cannot change own role
- Cannot change to WORKER if person has no team
- Cannot demote TEAM_LEAD who currently leads a team
- No-op if role unchanged (returns as-is)
```

#### Audit Logs
```
Paginated with filters: type, search, date
Includes: user email, role, action, entity, timestamp, IP
All audit log writes are fire-and-forget
```

---

## 4. Scheduled Jobs

| Job | Schedule | Function | Lock |
|-----|----------|----------|------|
| **Missed Check-In Detector** | Every 15 min | Detect workers who missed check-in after window + 2min buffer. Creates records with state snapshots. Notifies workers + team leads. | In-memory |
| **Transfer Processor** | Every 15 min | Execute pending team transfers whose effective_transfer_date has arrived. Cancels if target team inactive. | In-memory |
| **Weekly Cleanup** | Sun 2:00 AM | **STUB — NOT IMPLEMENTED.** Intended for notification archival, report generation. | N/A |

---

## 5. Cross-Cutting Patterns

### Multi-Tenancy
- Every query scoped by `company_id` via `BaseRepository.where()` / `withCompany()`
- NEVER trust client-provided company_id — always use `c.get('companyId')` from auth middleware
- Company timezone cached 5 minutes in tenant middleware

### Event Sourcing
- All state changes recorded as `Event` entities (immutable audit trail)
- `buildEventData()` inside transactions (enforces required time tracking fields)
- `emitEvent()` for fire-and-forget events (outside transactions)
- Event-time tracking: `event_time` (actual), `ingested_at` (server), `event_timezone`, `is_late`, `late_by_minutes`

### Fire-and-Forget
- Audit logs, notifications, non-critical events NEVER block main operations
- All have internal try/catch — failures are logged, never thrown
- Pattern: main operation succeeds even if side effects fail

### Schedule Resolution
- Worker override → team fallback (per field: work_days, check_in_start, check_in_end)
- Partial overrides supported (e.g., override only work_days, keep team times)
- Runtime guard: inverted windows (start >= end) from partial overrides fall back to team's window
- Cross-midnight windows NOT supported (validator enforces end > start)

### Timezone Handling
- All date/time ops use company timezone (Luxon)
- Database: UTC midnight for dates, UTC timestamps for datetimes
- Tenant middleware: loads Company.timezone → `c.set('companyTimezone')`
- Key utils: `getTodayInTimezone()`, `getCurrentTimeInTimezone()`, `getDayOfWeekInTimezone()`, `parseDateInTimezone()`

### Pagination
- All list endpoints paginated: `{ items, pagination: { page, limit, total, totalPages } }`
- Default limit: 20, max: 100
- Parallel queries: `findMany` + `count` via `Promise.all()`
- Frontend: TanStack Table (0-indexed) → API (1-indexed), conversion: `pageIndex + 1`

### Holiday-Aware Calculations
- Streak: holidays/off-days don't break streak (skipped)
- Completion rate: excludes holidays and non-work days from denominator
- Expected check-ins: excludes holidays, off-days, newly assigned
- Cache: 1h TTL, bounded to 5000 entries with eviction

---

## 6. Data Model Summary

### Entity Relationships
```
Company (tenant root)
├── Person (users: workers, leads, supervisors, WHS, admins)
│   ├── CheckIn (daily wellness submissions)
│   ├── MissedCheckIn (automated detection + state snapshots)
│   ├── Amendment (check-in corrections — DB only, no endpoints)
│   ├── Notification (in-app alerts)
│   └── AuditLog (admin action tracking)
├── Team (groups of workers)
│   ├── leader → Person (TEAM_LEAD)
│   ├── supervisor → Person (SUPERVISOR, optional)
│   └── members → Person[] (WORKER)
├── Incident (WHS reports)
│   └── Case (investigation tracking)
├── Event (event sourcing — immutable log)
└── Holiday (company-specific dates)
```

### Key Constraints
- `Person`: @@unique([company_id, email])
- `CheckIn`: @@unique([person_id, check_in_date])
- `MissedCheckIn`: @@unique([person_id, missed_date])
- `Team`: @@unique([company_id, name])
- `Incident`: @@unique([company_id, incident_number])
- `Case`: @@unique([company_id, case_number])
- `Holiday`: @@unique([company_id, date])

### Enums
| Enum | Values |
|------|--------|
| Role | ADMIN, WHS, SUPERVISOR, TEAM_LEAD, WORKER |
| Gender | MALE, FEMALE |
| ReadinessLevel | GREEN (>=70), YELLOW (50-69), RED (<50) |
| EventType | CHECK_IN_SUBMITTED, CHECK_IN_UPDATED, PERSON_CREATED/UPDATED/DEACTIVATED, TEAM_CREATED/UPDATED/DEACTIVATED, INCIDENT_CREATED/APPROVED/REJECTED, CASE_CREATED/UPDATED/RESOLVED, MISSED_CHECK_IN_DETECTED/RESOLVED, TEAM_TRANSFER_INITIATED/COMPLETED |
| NotificationType | CHECK_IN_REMINDER, MISSED_CHECK_IN, TEAM_ALERT, SYSTEM, INCIDENT_SUBMITTED/APPROVED/REJECTED |
| IncidentType | PHYSICAL_INJURY, ILLNESS_SICKNESS, MENTAL_HEALTH, MEDICAL_EMERGENCY, HEALTH_SAFETY_CONCERN, OTHER |
| IncidentSeverity | LOW, MEDIUM, HIGH, CRITICAL |
| IncidentStatus | PENDING, APPROVED, REJECTED |
| CaseStatus | OPEN, INVESTIGATING, RESOLVED, CLOSED |
| AmendmentStatus | PENDING, APPROVED, REJECTED |
| RejectionReason | DUPLICATE_REPORT, INSUFFICIENT_INFORMATION, NOT_WORKPLACE_INCIDENT, OTHER |

---

## 7. API Endpoint Catalog

### Authentication (`/api/v1/auth`)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /auth/signup | Public | Create company + admin account |
| POST | /auth/login | Public | Authenticate user |
| GET | /auth/me | Authenticated | Get current user profile |
| POST | /auth/logout | Authenticated | Clear session cookie |
| PATCH | /auth/change-password | Authenticated | Change password + rotate JWT |
| POST | /auth/verify-password | Authenticated | Re-authenticate for sensitive ops |
| POST | /auth/refresh | Authenticated | **NOT IMPLEMENTED (501)** |

### Check-Ins (`/api/v1/check-ins`)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /check-ins | WORKER, TEAM_LEAD | Submit daily check-in |
| GET | /check-ins/today | Authenticated | Get today's check-in |
| GET | /check-ins/status | Authenticated | Get check-in eligibility status |
| GET | /check-ins/history | Authenticated | Paginated personal history |
| GET | /check-ins/:id | Owner/WHS/SUPERVISOR/ADMIN/TEAM_LEAD | Get specific check-in |

### Teams (`/api/v1/teams`)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /teams | ADMIN | List teams (paginated, filterable) |
| POST | /teams | ADMIN | Create team |
| GET | /teams/:id | TEAM_LEAD/SUPERVISOR/ADMIN | Get team details |
| PATCH | /teams/:id | ADMIN | Update team (incl. deactivation) |
| GET | /teams/:id/members | TEAM_LEAD/SUPERVISOR/ADMIN | List team members |
| GET | /teams/my-members | TEAM_LEAD/SUPERVISOR/ADMIN | List members of user's team(s) |
| GET | /teams/check-in-history | TEAM_LEAD/SUPERVISOR/ADMIN/WHS | Team check-in history |
| GET | /teams/missed-check-ins | TEAM_LEAD/SUPERVISOR/ADMIN/WHS | Team missed check-ins |
| GET | /teams/analytics | TEAM_LEAD/SUPERVISOR/ADMIN | Team analytics (7d/30d/90d) |

### Persons (`/api/v1/persons`)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /persons/me | Authenticated | Get own profile |
| PATCH | /persons/me | Authenticated | Update own profile |
| POST | /persons/me/avatar | Authenticated | Upload profile picture |
| GET | /persons | ADMIN/SUPERVISOR/WHS | List persons (paginated, filterable) |
| POST | /persons | ADMIN | Create person |
| GET | /persons/:id | ADMIN/SUPERVISOR/WHS | Get person details |
| PATCH | /persons/:id | ADMIN | Update person (incl. team transfer) |
| DELETE | /persons/:id/pending-transfer | ADMIN | Cancel pending transfer |

### Dashboard (`/api/v1/dashboard`)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /dashboard/worker | Authenticated | Worker personal dashboard |
| GET | /dashboard/team-lead | TEAM_LEAD/SUPERVISOR/ADMIN | Team lead dashboard |
| GET | /dashboard/supervisor | SUPERVISOR/ADMIN | Multi-team supervisor dashboard |
| GET | /dashboard/summary | SUPERVISOR/ADMIN | Admin system overview |
| GET | /dashboard/team/:id | TEAM_LEAD/SUPERVISOR/ADMIN | Specific team summary |
| GET | /dashboard/whs | WHS/ADMIN | WHS dashboard |
| GET | /dashboard/whs-analytics | WHS | WHS analytics (7d/30d/90d) |
| GET | /dashboard/trends | SUPERVISOR/ADMIN | Company-wide readiness trends |

### Incidents (`/api/v1/incidents`)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /incidents | All authenticated | Report new incident |
| GET | /incidents | WHS/ADMIN | List all incidents (filterable) |
| GET | /incidents/my | All authenticated | List own incidents |
| GET | /incidents/:id | Owner/WHS/ADMIN | Get incident details |
| GET | /incidents/:id/timeline | Owner/WHS/ADMIN | Get incident event history |
| PATCH | /incidents/:id/approve | WHS | Approve incident + create case |
| PATCH | /incidents/:id/reject | WHS | Reject incident with reason |

### Cases (`/api/v1/cases`)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /cases | WHS/ADMIN | List all cases (filterable) |
| GET | /cases/:id | Reporter/WHS/ADMIN | Get case details |
| PATCH | /cases/:id | WHS | Update case (status, assignment, notes) |

### Notifications (`/api/v1/notifications`)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /notifications | Authenticated | List own notifications (filterable) |
| GET | /notifications/unread | Authenticated | Get unread count |
| PATCH | /notifications/mark-all-read | Authenticated | Mark all as read |
| PATCH | /notifications/:id/read | Authenticated | Mark specific as read |

### Admin (`/api/v1/admin`)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /admin/company/settings | ADMIN | Get company settings |
| PATCH | /admin/company/settings | ADMIN | Update company settings |
| GET | /admin/holidays | ADMIN | List holidays |
| POST | /admin/holidays | ADMIN | Create holiday |
| PATCH | /admin/holidays/:id | ADMIN | Update holiday |
| DELETE | /admin/holidays/:id | ADMIN | Delete holiday |
| GET | /admin/audit-logs | ADMIN | List audit logs (filterable) |
| GET | /admin/users/roles | ADMIN | List users with roles |
| PATCH | /admin/users/:id/role | ADMIN | Change user role |

---

## 8. Frontend Pages & User Flows

### Daily Worker Flow
```
Login → Worker Dashboard → see status
  → If window open: "Check-In Now" → /check-in → 4-step form → submit → see score → dashboard
  → If checked in: view summary + "View History" → /check-in/history
  → If holiday/off: see context message
```

### Team Lead Morning Routine
```
Login → Team Lead Dashboard → view team summary
  → Scan member status table (submitted/pending/missed/not_required)
  → Click "Missed Check-ins" → /team/missed-check-ins → review patterns
  → Click row → side panel with state snapshot (streak, misses, frequency)
  → Follow up with worker
```

### WHS Incident Review Flow
```
Login → WHS Dashboard → see pending incidents table
  → Click incident → view details (reporter, type, severity, description)
  → Approve → case auto-created → navigate to /admin/cases/:id
  → OR Reject → select reason + explain → submit
  → Go to case detail → assign officer → update status → add notes → resolve → close
```

### Admin Team Setup
```
Login → Admin Dashboard → Teams → Create Team
  → Fill: name, leader (required), supervisor (optional), schedule
  → Submit → Workers → Create Worker → assign to team
  → Workers can now check in
```

### Frontend Page Map
| Route | Role | Page |
|-------|------|------|
| /login | Public | Login form |
| /signup | Public | Signup form |
| /dashboard | Per-role | Role-specific dashboard |
| /check-in | WORKER | Check-in form (4 steps) |
| /check-in/history | WORKER | Personal check-in history |
| /team/missed-check-ins | TEAM_LEAD/SUPERVISOR | Missed check-ins table + detail |
| /team/analytics | TEAM_LEAD/SUPERVISOR | Team analytics charts |
| /team/check-in-history | TEAM_LEAD/SUPERVISOR | Team check-in history |
| /report-incident | All | Incident report form |
| /my-incidents | All | Personal incidents list |
| /incidents/:id | Owner/WHS/ADMIN | Incident detail + timeline |
| /admin/teams | ADMIN | Teams management list |
| /admin/teams/create | ADMIN | Create team form |
| /admin/teams/:id/edit | ADMIN | Edit team form |
| /admin/workers | ADMIN | Workers management list |
| /admin/workers/create | ADMIN | Create worker form |
| /admin/workers/:id/edit | ADMIN | Edit worker form |
| /admin/incidents | WHS/ADMIN | Incidents management list |
| /admin/cases | WHS/ADMIN | Cases management list |
| /admin/cases/:id | WHS/ADMIN | Case detail + management |
| /admin/holidays | ADMIN | Holiday management |
| /admin/settings | ADMIN | Company settings |
| /admin/audit-logs | ADMIN | Audit logs viewer |
| /whs/workers | WHS | Worker lookup |
| /whs-analytics | WHS | WHS analytics dashboard |
| /notifications | All | Notifications list |
| /settings | All | Profile + security settings |

---

## 9. Readiness Score Algorithm

### Input → Component Scores

**Sleep Score (0-100):**
```
hoursScore:
  7-9 hours (optimal) → 100
  6-7 hours            → 80
  5-6 hours            → 60
  <5 hours             → 40
  >9 hours             → 90

sleepScore = (hoursScore + sleepQuality * 10) / 2
```

**Stress Score (0-100):**
```
stressScore = (10 - stressLevel) * 10
Example: stress=3 → score=70 (low stress = high score)
```

**Physical Score (0-100):**
```
physicalScore = physicalCondition * 10
Example: condition=8 → score=80
```

**Pain Score (0-100, if applicable):**
```
painScore = (10 - painLevel) * 10
Example: pain=2 → score=80 (low pain = high score)
Only calculated if painLevel > 0
```

### Weighted Overall Score

**With pain (painLevel > 0):**
```
overall = sleep * 0.35 + stress * 0.25 + physical * 0.20 + pain * 0.20
```

**Without pain (painLevel = 0 or null):**
```
overall = sleep * 0.40 + stress * 0.30 + physical * 0.30
```

### Readiness Level
| Level | Score Range | Color | Meaning |
|-------|------------|-------|---------|
| GREEN | 70-100 | Green | Ready for work |
| YELLOW | 50-69 | Yellow | Caution / modified duty |
| RED | 0-49 | Red | Needs attention / not ready |

---

## 10. Identified Bugs & Edge Cases

### P0 — Critical

**BUG-AUTH-01: No Token Refresh Flow**
- `POST /auth/refresh` returns 501 (not implemented)
- If JWT expires mid-session, user is silently logged out
- No graceful re-authentication mechanism
- Impact: User loses unsaved work when token expires

### P1 — High

**BUG-AUTH-02: No Rate Limiting on Login**
- `/auth/login` has no rate limiting or account lockout
- Brute force attacks possible
- Impact: Security vulnerability

**BUG-ADMIN-01: admin.controller.ts Still Uses c.req.json()**
- Lines 107/144/266 bypass Zod validation
- Zod transforms (trim, toLowerCase) NOT applied on those endpoints
- Impact: Inconsistent input handling, potential data quality issues
- Note: Documented in MEMORY.md, fix when touching admin module

**BUG-TEAM-01: Team Lead Check-In Ambiguity**
- POST /check-ins allows WORKER and TEAM_LEAD roles
- Team leads can (and should) check in daily
- But: team lead dashboard expectedCheckIns only counts WORKER role members
- If a team lead is ALSO a member of a different team, unclear behavior
- Impact: Low (team leads typically lead their own team, not a member of another)

### P2 — Medium

**BUG-DASH-01: Supervisor Sees Only Directly Supervised Teams**
- If supervisor is not explicitly assigned via `supervisor_id`, they see empty dashboard
- No fallback to "all teams" like admin
- Impact: Supervisor with no team assignments sees blank page

**BUG-TEAM-02: Orphaned Workers After Team Deactivation**
- Team deactivation unassigns ALL members (team_id=null)
- No notification to ADMIN about orphaned workers
- Workers can't check in, appear on no dashboard
- Only admin manual action can reassign them
- Impact: Workers fall through the cracks until admin notices

**BUG-JOB-01: Weekly Cleanup Job is a Stub**
- Not implemented — old notifications accumulate forever
- No archival of old events, audit logs, etc.
- Impact: Database grows unbounded over time

**BUG-DB-01: Amendment Model Has No Endpoints**
- Amendment model exists in Prisma schema (PENDING/APPROVED/REJECTED workflow)
- No routes, controllers, or service for submitting/reviewing amendments
- Impact: Dead feature — DB table exists but is unused

**BUG-CASE-01: Case Status Allows Skipping INVESTIGATING**
- Valid transition: OPEN → RESOLVED (skips INVESTIGATING)
- May want to enforce OPEN → INVESTIGATING → RESOLVED for audit completeness
- Impact: Low — may be intentional for simple cases

**BUG-DASH-02: GET /dashboard/trends Not Filtered by Team**
- Returns company-wide trends regardless of role
- SUPERVISOR seeing all company data may be unintended
- Impact: Data leakage — supervisor sees beyond their supervised teams

### P3 — Low

**BUG-UI-01: Notification Bell Shows Only 5 Recent**
- If all 5 are old, user might miss newer ones below
- No "load more" in dropdown (only "View All" link)
- Impact: Minor UX issue

**BUG-AUTH-03: No Email Verification on Signup**
- No email confirmation/verification flow
- Anyone can sign up with any email address
- Impact: Low for current use case (admin creates workers)

**BUG-STORAGE-01: R2 Avatar Deletion is Fire-and-Forget**
- If R2 delete fails on avatar replacement, orphan files accumulate
- No cleanup job for orphaned files
- Impact: Storage waste over time

---

## 11. Strengths & Limitations

### Strengths
1. **Modern Architecture** — Hono + Prisma + React + TanStack Query
2. **Multi-Tenant Isolation** — company_id enforced on every query via BaseRepository
3. **Event Sourcing** — complete immutable audit trail of all state changes
4. **Schedule-Aware Dashboards** — per-worker effective schedule for accurate compliance
5. **State Snapshots** — 20+ contextual metrics captured at missed check-in detection
6. **Performance** — parallel queries, batch operations, pre-computed date ranges, caching
7. **Fire-and-Forget** — audit logs/notifications never block main operations
8. **Timezone-Correct** — Luxon-based, company timezone from middleware
9. **Holiday-Aware** — all compliance calculations exclude holidays
10. **JWT Rotation** — password change rotates token (prevents reuse)

### Limitations
1. **In-App Notifications Only** — no SMS, email, or push
2. **No Native Mobile App** — responsive web only, no offline mode
3. **No File Uploads on Incidents** — no photo/document attachments
4. **No CSV/PDF Export** — no report generation or data export
5. **Single Team Per Worker** — no multi-team or matrix structures
6. **No Cross-Midnight Windows** — check-in end must be after start (same day)
7. **In-Memory Job Locks** — won't work in multi-instance deployment
8. **English Only** — no i18n/localization
9. **Self-Reported Data** — no wearable integration for objective metrics
10. **No Refresh Token** — JWT expiry = logout

---

## 12. Improvement Suggestions

### High Priority
1. **Token Refresh** — implement refresh token flow for seamless sessions
2. **Rate Limiting** — add login rate limiting + account lockout
3. **Multi-Channel Notifications** — SMS (Twilio), email, push (Web Push API)
4. **File Uploads** — incident photos/documents via Cloudflare R2
5. **Export** — CSV/PDF export on data tables and reports

### Medium Priority
6. **Orphan Worker Alerts** — notify admin when workers become teamless
7. **Amendment Endpoints** — implement the existing Amendment model
8. **Email Verification** — confirm email on signup
9. **Shift Management** — multiple shifts per team, rotation schedules
10. **Workflow Automation** — auto-escalation, SLA tracking, conditional notifications

### Lower Priority
11. **Native Mobile Apps** — iOS/Android with offline support
12. **Advanced Analytics** — predictive risk, correlation analysis, custom dashboards
13. **Internationalization** — multi-language support
14. **Integration APIs** — webhooks, HRIS sync, workers' comp integration
15. **Gamification** — streaks, badges, team leaderboards

---

## 13. Target Industries

### Primary
| Industry | Why AEGIRA Fits |
|----------|----------------|
| Construction & Infrastructure | Physical condition monitoring prevents injuries |
| Mining & Resources | Sleep tracking and fatigue detection prevent accidents |
| Manufacturing & Warehousing | Stress monitoring reduces repetitive strain injuries |
| Transportation & Logistics | Sleep and stress monitoring ensures driver alertness |
| Healthcare & Aged Care | Mental health monitoring prevents burnout |
| Emergency Services | Comprehensive wellness tracking ensures responder readiness |

### Secondary
- Hospitality & Events (long shifts, physical roles)
- Agriculture & Farming (seasonal workers, early shifts)
- Security & Facilities Management (24/7 coverage)

### Ideal Organization Profile
- 20-5000+ employees
- Team-based structure
- Safety-critical operations
- Shift-based schedules
- Regulatory compliance requirements (OH&S, fatigue management)
- Need for incident tracking and investigation
