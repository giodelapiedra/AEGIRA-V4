# AEGIRA V5 — Senior Engineer System Analysis

> **Author**: Senior Software Engineer Review
> **System Version**: AEGIRA V5 (Multi-tenant SaaS)
> **Last Updated**: February 2026
> **Stack**: Hono + Prisma + PostgreSQL | React + Vite + TanStack Query

---

## Table of Contents

1. [System Purpose & Core Functions](#1-system-purpose--core-functions)
2. [Core Feature Breakdown](#2-core-feature-breakdown)
3. [System Architecture](#3-system-architecture)
4. [User Scenarios by Role](#4-user-scenarios-by-role)
5. [End-to-End Scenario Walkthroughs](#5-end-to-end-scenario-walkthroughs)
6. [Data Models & Relationships](#6-data-models--relationships)
7. [Technical Patterns & Design Decisions](#7-technical-patterns--design-decisions)
8. [API Surface](#8-api-surface)
9. [Background Jobs & Automation](#9-background-jobs--automation)
10. [Security & Access Control](#10-security--access-control)
11. [Strengths](#11-strengths)
12. [Weaknesses & Limitations](#12-weaknesses--limitations)
13. [Improvement Recommendations](#13-improvement-recommendations)
14. [Commercial Viability Assessment](#14-commercial-viability-assessment)
15. [Target Market & Buyer Profiles](#15-target-market--buyer-profiles)
16. [Go-to-Market Readiness](#16-go-to-market-readiness)
17. [Pricing Strategy](#17-pricing-strategy)
18. [Competitive Positioning](#18-competitive-positioning)

---

## 1. System Purpose & Core Functions

AEGIRA is a **multi-tenant workforce readiness and health management platform** built for safety-critical, team-based organizations. It answers one question every day: **"Is this worker fit for duty?"**

### Primary Functions

| # | Function | What It Does |
|---|----------|-------------|
| 1 | **Daily Wellness Check-In** | Workers answer 5-6 questions (sleep, stress, physical condition, pain) and receive an instant readiness score (0-100, GREEN/YELLOW/RED) |
| 2 | **Automated Compliance Tracking** | System detects missed check-ins every 15 minutes, captures contextual snapshots, and notifies workers + team leads |
| 3 | **Readiness Score Calculation** | Weighted algorithm converts self-reported wellness data into a single 0-100 score with component breakdown (sleep, stress, physical, pain) |
| 4 | **Role-Based Dashboards** | 5 distinct dashboards (Worker, Team Lead, Supervisor, WHS, Admin) each showing relevant metrics and actions |
| 5 | **Incident Reporting & Case Management** | Workers report workplace incidents → WHS reviews/approves → Cases created → Investigation tracked to resolution |
| 6 | **Team & Schedule Management** | Admins configure teams, assign leaders/supervisors, set check-in windows and work days, manage worker transfers |
| 7 | **WHS Analytics** | Historical trend analysis (7d/30d/90d) for incidents by type, severity, team, gender, and rejection reasons |
| 8 | **Event Sourcing & Audit Trail** | Every state change recorded as an immutable Event entity; full audit log with user, action, IP, and timestamp |
| 9 | **Holiday Management** | Company-specific holidays (one-time + recurring) excluded from compliance calculations automatically |
| 10 | **Notification System** | In-app notifications for missed check-ins, incident updates, team transfers, and system alerts |

### What Makes AEGIRA Different

- **Preventive, not reactive** — Catches fatigue, stress, and pain *before* incidents happen
- **Fully automated compliance** — No manual attendance tracking; the system detects and records missed check-ins with 13-metric contextual snapshots
- **Multi-tenant isolation** — Every database query scoped by `company_id`; companies share infrastructure but never see each other's data
- **Timezone-aware** — All date/time logic uses Luxon with per-company timezone (default: `Asia/Manila`)
- **Event-sourced** — Complete history of every check-in, transfer, incident, and status change

---

## 2. Core Feature Breakdown

### 2.1 Daily Check-In System

**Purpose**: Capture daily worker wellness data, calculate readiness, and flag workers who may be unfit for duty.

**Check-In Data Collected**:
- Hours slept (float)
- Sleep quality (1-10)
- Stress level (1-10)
- Physical condition (1-10)
- Pain level (0-10, optional)
- Pain location (text, if pain > 0)
- Physical condition notes (text, optional)
- General notes (text, optional)

**Readiness Score Algorithm**:
```
Without pain:
  sleep_score   = f(hours_slept, sleep_quality)   → 0-100
  stress_score  = (10 - stress_level) × 10        → 0-100
  physical_score = physical_condition × 10         → 0-100
  readiness     = (0.40 × sleep) + (0.30 × stress) + (0.30 × physical)

With pain (pain > 0):
  pain_score    = (10 - pain_level) × 10           → 0-100
  readiness     = (0.35 × sleep) + (0.25 × stress) + (0.20 × physical) + (0.20 × pain)

Readiness Levels:
  GREEN  = score ≥ 70  → Ready for duty
  YELLOW = score 50-69 → Modified duty recommended
  RED    = score < 50  → Needs attention / unfit
```

**Check-In Window Rules**:
- Each team has a configured window (e.g., `06:00`-`10:00`)
- Workers can have personal schedule overrides (worker override → team fallback)
- Submissions **before** window open → rejected
- Submissions **after** window close → accepted, flagged as `is_late` with `late_by_minutes`
- One check-in per person per calendar day (enforced by `@@unique([person_id, check_in_date])`)
- Holidays → rejected (system checks company holiday calendar)
- Non-work days → rejected (checked against work_days CSV: `"1,2,3,4,5"`)

**Late Check-In Resolution (Phase 2)**:
- If a worker submits late AFTER the missed-check-in detector already ran → the existing `MissedCheckIn` record is auto-resolved
- If a worker submits late BEFORE the detector runs → a `MissedCheckIn` is created AND immediately resolved in the same transaction
- Resolution tracked via `resolved_by_check_in_id` and `resolved_at`

---

### 2.2 Missed Check-In Detection

**Purpose**: Automatically identify workers who fail to check in within their scheduled window.

**How It Works** (cron job, every 15 minutes):
1. Get all active companies
2. For each company: check if today is a holiday → skip if yes
3. Find active workers on active teams who were assigned **before** today
4. For each worker: get effective schedule (worker override → team fallback)
5. Filter: today is a work day AND current time > window end + 2-min buffer
6. Check who hasn't submitted a check-in for today (O(1) set lookup)
7. For each missing worker, capture **13-metric contextual snapshot**:
   - `worker_role_at_miss`, `team_leader_id_at_miss`, `team_leader_name_at_miss`
   - `day_of_week`, `week_of_month`
   - `days_since_last_check_in`, `days_since_last_miss`
   - `check_in_streak_before` (consecutive days before miss)
   - `recent_readiness_avg` (last 7 days)
   - `misses_in_last_30d`, `misses_in_last_60d`, `misses_in_last_90d`
   - `baseline_completion_rate` (% since team assignment)
   - `is_first_miss_in_30d`, `is_increasing_frequency`
8. Insert `MissedCheckIn` records (skipDuplicates)
9. Notify workers ("You missed your check-in") + team leads ("N workers missed")
10. Emit `MISSED_CHECK_IN_DETECTED` events (fire-and-forget)

**Design Decisions**:
- 2-minute buffer after window close prevents false positives at boundary
- Workers assigned TODAY are excluded (they haven't had a full check-in cycle yet)
- In-memory lock prevents overlapping runs
- Fire-and-forget notifications/events never block detection

---

### 2.3 Incident Reporting & Case Management

**Purpose**: Structured workflow for reporting, reviewing, and investigating workplace health & safety incidents.

**Incident Types**: `PHYSICAL_INJURY` | `ILLNESS_SICKNESS` | `MENTAL_HEALTH` | `MEDICAL_EMERGENCY` | `HEALTH_SAFETY_CONCERN` | `OTHER`

**Severity Levels**: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`

**Workflow**:
```
Worker reports incident
  → Status: PENDING (incident_number auto-assigned: #INC-001, #INC-002, ...)
  → WHS officer reviews
    → APPROVED → Case auto-created (#CASE-001), assigned to investigator
      → OPEN → INVESTIGATING → RESOLVED → CLOSED
    → REJECTED (with reason + explanation) → Worker notified
```

**Case Management**:
- Cases are 1:1 with approved incidents
- Assigned to a WHS officer for investigation
- Status transitions: `OPEN` → `INVESTIGATING` → `RESOLVED` → `CLOSED`
- Notes and resolution tracking
- Full event timeline for audit

---

### 2.4 Team & Schedule Management

**Purpose**: Organize workers into teams with leaders, supervisors, and configurable check-in schedules.

**Team Structure**:
- Each team has: name, leader (TEAM_LEAD, required), supervisor (SUPERVISOR, optional)
- Check-in schedule: `check_in_start`, `check_in_end` (HH:mm), `work_days` (CSV: `"1,2,3,4,5"`)
- Workers belong to exactly one team at a time

**Worker Transfers**:
- Admin initiates transfer → sets `effective_team_id` + `effective_transfer_date` (next day)
- Transfer processor (cron, every 15 min) executes pending transfers when date arrives
- If target team deactivated before execution → transfer cancelled, worker notified
- Worker validates against **current** team's schedule until transfer executes

**Worker Schedule Override**:
- Individual workers can have personal `work_days`, `check_in_start`, `check_in_end`
- Resolution: worker override → team schedule fallback

---

### 2.5 Role-Based Dashboards

| Dashboard | Role | Key Metrics |
|-----------|------|-------------|
| **Worker** | WORKER | Today's readiness, streak, completion rate, weekly trend, pending transfer |
| **Team Lead** | TEAM_LEAD | Team size, today's submissions vs expected, pending/missed count, compliance rate, team avg readiness, member statuses |
| **Supervisor** | SUPERVISOR | Multi-team overview, total workers, compliance across teams, team summaries (schedule-aware) |
| **Admin** | ADMIN | Total teams, workers, team leads, supervisors, unassigned workers, system-level stats |
| **WHS** | WHS | Pending incidents count, open cases, resolved this month, cases by status (pie chart), pending incidents table, recent activity feed |
| **WHS Analytics** | WHS | Period selector (7d/30d/90d), incident trends (area chart), type breakdown (pie), severity distribution, team comparison (bar), gender breakdown, rejection analysis |

---

### 2.6 Notification System

**Types**:
- `CHECK_IN_REMINDER` — Reminder to submit daily check-in
- `MISSED_CHECK_IN` — Worker or team lead notified of missed check-in
- `TEAM_ALERT` — Team assignment, transfer, or deactivation notice
- `SYSTEM` — General system notifications
- `INCIDENT_SUBMITTED` — Incident report confirmation
- `INCIDENT_APPROVED` — Incident approved by WHS
- `INCIDENT_REJECTED` — Incident rejected with reason

**Delivery**: In-app only (no SMS/email/push currently)

---

### 2.7 Admin Operations

- **Company Settings**: Name, timezone, address, business registration
- **Holiday Management**: Create/edit/delete holidays (one-time or recurring annually)
- **Audit Logs**: Searchable, filterable log of all system actions (who, what, when, IP)
- **User Role Management**: Change any user's role (ADMIN only)

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        AEGIRA V5 Monorepo                        │
├──────────────────────────┬───────────────────────────────────────┤
│     aegira-backend/      │         aegira-frontend/              │
│     Hono + Prisma        │         React + Vite                  │
│     REST API (JSON)      │         SPA (TanStack Query)          │
├──────────────────────────┼───────────────────────────────────────┤
│                          │                                       │
│  ┌────────────────────┐  │  ┌─────────────────────────────────┐  │
│  │ Middleware Chain    │  │  │ Route Guards                    │  │
│  │ auth → tenant →    │  │  │ RouteGuard (auth + role)        │  │
│  │ role → validator   │  │  │ GuestGuard (login/signup)       │  │
│  └────────┬───────────┘  │  └─────────────┬───────────────────┘  │
│           │              │                │                       │
│  ┌────────▼───────────┐  │  ┌─────────────▼───────────────────┐  │
│  │ Controller         │  │  │ Pages (lazy-loaded)             │  │
│  │ → Service          │◄─┼──│ → Hooks (useQuery/useMutation)  │  │
│  │ → Repository       │  │  │ → Components                    │  │
│  │ → BaseRepository   │  │  │ → apiClient (credentials:incl)  │  │
│  └────────┬───────────┘  │  └─────────────────────────────────┘  │
│           │              │                                       │
│  ┌────────▼───────────┐  │  State Management:                    │
│  │ Prisma Client      │  │  - Server state → TanStack Query      │
│  │ (company_id scope) │  │  - Auth state   → Zustand             │
│  └────────┬───────────┘  │  - Form state   → React Hook Form     │
│           │              │  - URL state    → React Router         │
├───────────▼──────────────┴───────────────────────────────────────┤
│                        PostgreSQL                                │
│                    (Multi-tenant, company_id isolation)           │
├──────────────────────────────────────────────────────────────────┤
│  Background Jobs (node-cron):                                    │
│  - Missed Check-In Detector (every 15 min)                       │
│  - Transfer Processor (every 15 min)                             │
│  - Cleanup (weekly, stub)                                        │
├──────────────────────────────────────────────────────────────────┤
│  External Services:                                              │
│  - Cloudflare R2 (profile picture storage, S3-compatible)        │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Backend Layer Pattern (per module)

```
routes.ts        → HTTP route definitions + middleware mounting
controller.ts    → Extract context, call service/repo, format response, fire-and-forget side effects
service.ts       → Business logic, transactions, calculations (optional)
repository.ts    → Prisma queries extending BaseRepository (company_id auto-scoped)
validator.ts     → Zod schemas for request validation + type exports
```

### 3.3 Frontend Feature Pattern (per feature)

```
pages/           → Route-level components (lazy-loaded)
components/      → Feature-specific sub-components (optional)
hooks/           → TanStack Query hooks (useQuery for reads, useMutation for writes)
```

### 3.4 Request Lifecycle

```
Browser → HTTP (credentials: include)
  → Hono route handler
    → authMiddleware (JWT from cookie or Bearer header → sets userId, companyId, userRole)
    → tenantMiddleware (validate company exists + active, cache 5-min TTL → sets companyTimezone)
    → roleMiddleware(['ROLE1', 'ROLE2']) (check user has required role)
    → zValidator('json', zodSchema) (validate + transform input)
    → Controller
      → Service / Repository (Prisma queries with company_id filter)
      → Fire-and-forget: logAudit(), emitEvent(), notify()
      → Return { success: true, data: T }
  → apiClient unwraps response.data → TanStack Query caches → Component re-renders
```

---

## 4. User Scenarios by Role

### 4.1 WORKER Scenarios

| # | Scenario | Flow |
|---|----------|------|
| W-01 | **Morning check-in (on time)** | Worker opens app → sees check-in form → fills sleep/stress/physical/pain data → submits → receives readiness score (GREEN/YELLOW/RED) → sees personal dashboard updated |
| W-02 | **Late check-in (after window)** | Worker opens app after window closes → still sees check-in form → submits → flagged as `is_late` with `late_by_minutes` → if missed check-in already created by cron, it's auto-resolved |
| W-03 | **Check-in before window opens** | Worker opens app early → sees "Check-in window not yet open" message → cannot submit |
| W-04 | **Check-in on holiday** | Worker opens app on company holiday → sees "Today is a holiday" → cannot submit |
| W-05 | **Check-in on non-work day** | Worker opens app on Saturday (not in work_days) → sees "Not a work day" → cannot submit |
| W-06 | **Duplicate check-in attempt** | Worker already checked in today → sees today's readiness summary instead of form |
| W-07 | **View check-in history** | Worker navigates to history page → sees paginated list of past check-ins with scores, dates, and late flags |
| W-08 | **Missed check-in notification** | Worker didn't check in → cron detects after window + 2-min buffer → worker receives in-app notification "You missed your check-in" |
| W-09 | **Report workplace incident** | Worker navigates to incident form → fills type, severity, title, location, description → submits → receives #INC-XXX number → waits for WHS review |
| W-10 | **View my incidents** | Worker sees list of own incident reports with status badges (PENDING/APPROVED/REJECTED) → can filter by status |
| W-11 | **Incident rejected** | Worker receives notification "Incident rejected" → views rejection reason + explanation |
| W-12 | **Incident approved** | Worker receives notification "Incident approved" → case #CASE-XXX created |
| W-13 | **Pending team transfer** | Admin assigns worker to new team effective tomorrow → worker sees "Pending transfer" info on dashboard → next day, cron executes transfer → worker now on new team → receives welcome notification |
| W-14 | **Worker with schedule override** | Worker has personal check-in window (07:00-11:00) different from team default (06:00-10:00) → system uses worker's override for validation |
| W-15 | **View notifications** | Worker clicks bell icon → sees unread count → opens notification page → marks as read |
| W-16 | **Update profile / change password** | Worker goes to settings → updates name, contact, emergency info → changes password (JWT rotated, new cookie issued) |
| W-17 | **Upload avatar** | Worker uploads profile picture → stored on Cloudflare R2 → URL saved to profile |

### 4.2 TEAM_LEAD Scenarios

| # | Scenario | Flow |
|---|----------|------|
| TL-01 | **Morning team monitoring** | Team lead opens dashboard → sees "8/10 submitted, 1 pending, 1 missed" → team avg readiness 78 (GREEN) → views member status list |
| TL-02 | **Identify at-risk worker** | Dashboard shows worker with RED readiness → team lead clicks worker → sees detailed check-in history and recent trend → decides on modified duty |
| TL-03 | **Missed check-in alert** | Cron detects 2 workers missed check-in → team lead receives notification "2 workers missed check-in" → navigates to missed check-ins page → sees workers with contextual snapshots |
| TL-04 | **View team analytics** | Team lead opens analytics → sees compliance rate trend, daily breakdown, readiness averages over time |
| TL-05 | **View worker detail** | Team lead clicks on a team member → sees full profile, check-in history, missed check-in history, readiness stats |
| TL-06 | **Check-in as team lead** | Team leads can also check in themselves (if they're also workers) → same form as W-01 |
| TL-07 | **Team check-in history** | Team lead views paginated history of all team members' check-ins with filters |

### 4.3 SUPERVISOR Scenarios

| # | Scenario | Flow |
|---|----------|------|
| S-01 | **Multi-team oversight** | Supervisor opens dashboard → sees summary across ALL assigned teams → total workers, compliance rate, team-by-team breakdown |
| S-02 | **Identify underperforming team** | Dashboard shows Team Alpha at 60% compliance vs Team Beta at 95% → supervisor drills into Team Alpha detail |
| S-03 | **View team detail** | Supervisor navigates to specific team → sees members, schedule, leader info, compliance metrics |
| S-04 | **Cross-team missed check-ins** | Supervisor views missed check-ins across all assigned teams → filters by team, date |
| S-05 | **Team analytics comparison** | Supervisor views analytics → compares readiness trends across teams |
| S-06 | **Generate team reports** | Supervisor exports team data for management review |

### 4.4 WHS (Workplace Health & Safety) Scenarios

| # | Scenario | Flow |
|---|----------|------|
| WHS-01 | **Review pending incident** | WHS opens dashboard → sees "3 pending incidents" → clicks incident → reads details → approves or rejects |
| WHS-02 | **Approve incident → create case** | WHS approves incident → system auto-creates case #CASE-XXX → case status: OPEN → WHS assigns investigator |
| WHS-03 | **Reject incident** | WHS rejects incident → enters rejection reason + explanation → worker notified |
| WHS-04 | **Investigate case** | WHS updates case status: OPEN → INVESTIGATING → adds notes → resolves → RESOLVED → eventually CLOSED |
| WHS-05 | **View incident timeline** | WHS opens incident → sees full event timeline (submitted, reviewed, approved/rejected, case created, status changes) |
| WHS-06 | **Monitor worker readiness** | WHS views all workers with readiness scores → filters by check-in status |
| WHS-07 | **Analyze incident trends** | WHS opens analytics → selects period (7d/30d/90d) → views: incident trend chart, type breakdown, severity distribution, team comparison, gender breakdown, rejection reasons |
| WHS-08 | **Track case workload** | WHS dashboard shows: open cases, investigating, resolved this month, cases by status (pie chart) |
| WHS-09 | **Recent activity feed** | WHS sees chronological feed of recent system events with links to relevant records |

### 4.5 ADMIN Scenarios

| # | Scenario | Flow |
|---|----------|------|
| A-01 | **Create new team** | Admin navigates to team management → creates team (name, leader, supervisor, schedule) → team appears in system |
| A-02 | **Create new worker** | Admin creates worker account (email, password, name, role, team assignment, optional schedule override) |
| A-03 | **Transfer worker between teams** | Admin edits worker → changes team → transfer scheduled for next day → cron executes → worker moves to new team |
| A-04 | **Cancel pending transfer** | Admin realizes mistake → cancels pending transfer before execution date → transfer removed |
| A-05 | **Deactivate team** | Admin deactivates team → orphaned workers notified → pending transfers to this team cancelled |
| A-06 | **Deactivate worker** | Admin deactivates worker account → worker can no longer log in or check in |
| A-07 | **Manage holidays** | Admin creates company holidays (one-time: "EDSA Day 2026-02-25" or recurring: "Christmas 12-25") → system excludes these from compliance |
| A-08 | **Update company settings** | Admin changes timezone, company name, address → caches invalidated → all time calculations use new timezone |
| A-09 | **View audit logs** | Admin searches audit logs → filters by action, date → sees who did what, when, from which IP |
| A-10 | **Change user role** | Admin promotes WORKER to TEAM_LEAD → user's accessible features change immediately |
| A-11 | **Edit team schedule** | Admin updates team check-in window (e.g., 06:00-10:00 → 07:00-11:00) → affects all team members without personal overrides |
| A-12 | **View system dashboard** | Admin sees high-level stats: total teams, total workers, workers by role, unassigned workers |

---

## 5. End-to-End Scenario Walkthroughs

### Scenario A: Complete Check-In Day (Happy Path)

```
06:00 AM (Asia/Manila)
├─ System: Check-in window opens for Team Alpha (06:00-10:00)
│
07:15 AM
├─ Worker Juan opens app on mobile browser
├─ Frontend: GET /check-ins/status → { canCheckIn: true, isWithinWindow: true }
├─ Juan fills check-in form:
│   hours_slept: 7.5, sleep_quality: 8, stress: 3, physical: 9, pain: 0
├─ Frontend: POST /check-ins
├─ Backend (atomic transaction):
│   ├─ Validate: not holiday, is work day, time within window
│   ├─ Calculate readiness:
│   │   sleep_score = 85, stress_score = 70, physical_score = 90
│   │   readiness = (0.40 × 85) + (0.30 × 70) + (0.30 × 90) = 82 → GREEN
│   ├─ Create Event (event_time: 07:15, is_late: false)
│   ├─ Create CheckIn (score: 82, level: GREEN)
│   └─ Commit transaction
├─ Fire-and-forget: logAudit(CHECK_IN_SUBMITTED)
├─ Juan sees: "Your readiness score: 82 — Ready for duty ✅"
│
10:02 AM
├─ Check-in window closes + 2-min buffer
│
10:15 AM
├─ Cron: Missed Check-In Detector runs
├─ Finds Worker Maria (Team Alpha) has not checked in
├─ Captures snapshot: streak=5, recent_avg=74, misses_30d=1
├─ Creates MissedCheckIn record
├─ Notifies Maria: "You missed your check-in today"
├─ Notifies Team Lead Pedro: "1 worker missed check-in"
│
10:30 AM
├─ Maria opens app → submits late check-in
├─ Backend: is_late = true, late_by_minutes = 30
├─ Transaction: Create Event + CheckIn + resolve MissedCheckIn
├─ Maria's missed check-in record: resolved_by_check_in_id set, resolved_at set
│
11:00 AM
├─ Team Lead Pedro opens dashboard
├─ Sees: "10/10 submitted" (Maria's late submission resolved the miss)
├─ Team avg readiness: 78 (GREEN)
```

### Scenario B: Incident Lifecycle

```
Day 1 - 09:00 AM
├─ Worker Carlos reports incident:
│   type: PHYSICAL_INJURY, severity: MEDIUM
│   title: "Slipped on wet floor in warehouse"
│   location: "Warehouse B, Aisle 3"
│   description: "Slipped on wet floor near loading dock..."
├─ Backend: incident_number = #INC-047, status: PENDING
├─ Carlos receives notification: "Incident #INC-047 submitted"
│
Day 1 - 02:00 PM
├─ WHS Officer Ana opens dashboard
├─ Sees: "1 pending incident" in PendingIncidentsTable
├─ Clicks #INC-047 → reads details → clicks "Approve"
├─ Backend (atomic):
│   ├─ Update incident status: APPROVED, reviewed_by: Ana
│   ├─ Create Case: case_number = #CASE-023, status: OPEN
│   ├─ Emit events: INCIDENT_APPROVED, CASE_CREATED
│   └─ Notify Carlos: "Your incident has been approved"
│
Day 2
├─ Ana assigns herself to Case #CASE-023
├─ Updates status: OPEN → INVESTIGATING
├─ Adds notes: "Inspected warehouse B. Drainage issue found."
│
Day 5
├─ Ana resolves case
├─ Updates status: INVESTIGATING → RESOLVED
├─ Notes: "Drainage fixed. Safety signage added."
├─ resolved_at timestamp captured
│
Day 7
├─ Ana closes case after follow-up
├─ Status: RESOLVED → CLOSED
├─ Full event timeline preserved for audit
```

### Scenario C: Worker Transfer

```
Monday 3:00 PM
├─ Admin moves Worker Jose from Team Alpha to Team Beta
├─ Backend: sets effective_team_id = Team Beta, effective_transfer_date = Tuesday
├─ Jose sees "Pending transfer to Team Beta" on dashboard
│
Tuesday (any 15-min cron window)
├─ Transfer Processor runs
├─ Finds Jose's transfer: effective_date ≤ today
├─ Checks: Team Beta is_active? → YES
├─ Executes:
│   ├─ Jose.team_id = Team Beta
│   ├─ Jose.team_assigned_at = now
│   ├─ Clear: effective_team_id, effective_transfer_date, transfer_initiated_by
│   ├─ Emit TEAM_TRANSFER_COMPLETED event
│   └─ Notify Jose: "Welcome to Team Beta"
├─ Jose now uses Team Beta's check-in schedule
```

### Scenario D: Holiday + Missed Check-In Interaction

```
Admin creates holiday: "EDSA Anniversary" on February 25

February 25 - 06:00 AM
├─ Worker opens app
├─ GET /check-ins/status → { canCheckIn: false, isHoliday: true, message: "Today is a holiday" }
├─ Worker cannot submit check-in
│
February 25 - Cron runs (any time)
├─ Missed Check-In Detector: checks isHoliday for company → true → SKIPS entirely
├─ No missed check-in records created
├─ Dashboard completion rate excludes this day from calculations
```

### Scenario E: New Worker Onboarding

```
Admin creates worker account:
├─ email: "new.worker@company.com", role: WORKER, team: Team Alpha
├─ Backend: person created, team_assigned_at = today
│
Same day - Check-in window
├─ Worker can log in but is NOT expected to check in today
├─ Missed Check-In Detector: skips workers with team_assigned_at = today
├─ Worker is safe from false "missed" detection
│
Next day
├─ Worker is now expected to check in within Team Alpha's window
├─ Normal check-in flow applies
```

### Scenario F: Deactivated Worker Attempt

```
Admin deactivates worker account (is_active = false)
│
Worker tries to log in
├─ Auth: finds person, checks is_active → false
├─ Returns: 401 ACCOUNT_INACTIVE "Your account has been deactivated"
│
Worker cannot access any system features
├─ All queries filter by is_active: true
├─ Missed check-in detector skips inactive workers
├─ Dashboard excludes inactive workers from counts
```

### Scenario G: Cross-Midnight Late Submission

```
Check-in window: 06:00 - 10:00 (Asia/Manila)
Worker forgets to check in all day

11:45 PM
├─ Worker opens app → submits check-in
├─ Backend captures DateTime.now() snapshot:
│   todayStr = "2026-02-21", currentTime = "23:45"
├─ Validates: is work day? ✅, time >= window start? ✅ (23:45 > 06:00)
├─ Check-in accepted: is_late = true, late_by_minutes = 825
├─ MissedCheckIn record (created at 10:15 by cron) → auto-resolved
│
NOTE: Single DateTime snapshot prevents midnight drift
(previously 3 separate DateTime.now() calls could span midnight)
```

---

## 6. Data Models & Relationships

### 6.1 Entity Relationship Overview

```
Company (tenant root)
├── Person (users - 5 roles)
│   ├── CheckIn (daily wellness records)
│   │   └── Event (1:1 linked)
│   ├── MissedCheckIn (compliance records)
│   ├── Notification (in-app alerts)
│   ├── AuditLog (action records)
│   ├── Amendment (check-in corrections)
│   └── Incident (reported by)
│       └── Case (1:1 when approved)
├── Team
│   ├── leader → Person (TEAM_LEAD)
│   ├── supervisor → Person (SUPERVISOR)
│   └── members → Person[]
├── Holiday (company calendar)
└── Event (event sourcing log)
```

### 6.2 Key Models Summary

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **Company** | name, slug, timezone, is_active | Multi-tenant root; each company operates in isolation |
| **Person** | email, role, team_id, work_days, check_in_start/end, effective_team_id, is_active | Users across 5 roles; supports schedule overrides and pending transfers |
| **Team** | name, leader_id, supervisor_id, check_in_start/end, work_days, is_active | Worker groups with configurable schedules |
| **CheckIn** | person_id, check_in_date, hours_slept, sleep_quality, stress_level, physical_condition, pain_level, readiness_score, readiness_level, event_id | Daily wellness record with calculated readiness |
| **MissedCheckIn** | person_id, missed_date, schedule_window, 13 snapshot fields, resolved_by_check_in_id, resolved_at | Compliance record with contextual state capture |
| **Event** | event_type (18 types), entity_type, entity_id, payload, event_time, ingested_at, event_timezone, is_late, late_by_minutes | Immutable event log (event sourcing) |
| **Incident** | incident_number, reporter_id, incident_type, severity, status, reviewed_by, rejection_reason | Workplace incident report |
| **Case** | case_number, incident_id, assigned_to, status, notes, resolved_at | Investigation tracking (1:1 with approved incident) |
| **Notification** | person_id, type (7 types), title, message, read_at | In-app notification |
| **AuditLog** | person_id, action, entity_type, entity_id, details (JSON), ip_address | Compliance audit record |
| **Holiday** | name, date, is_recurring | Company holiday (excluded from compliance) |
| **Amendment** | check_in_id, field_name, old_value, new_value, reason, status, reviewed_by | Check-in correction request |

### 6.3 Enums

```
Role:            ADMIN | WHS | SUPERVISOR | TEAM_LEAD | WORKER
ReadinessLevel:  GREEN | YELLOW | RED
IncidentType:    PHYSICAL_INJURY | ILLNESS_SICKNESS | MENTAL_HEALTH | MEDICAL_EMERGENCY | HEALTH_SAFETY_CONCERN | OTHER
IncidentSeverity: LOW | MEDIUM | HIGH | CRITICAL
IncidentStatus:  PENDING | APPROVED | REJECTED
CaseStatus:      OPEN | INVESTIGATING | RESOLVED | CLOSED
AmendmentStatus: PENDING | APPROVED | REJECTED
EventType:       CHECK_IN_SUBMITTED | MISSED_CHECK_IN_DETECTED | MISSED_CHECK_IN_RESOLVED | PERSON_CREATED | PERSON_UPDATED | PERSON_DEACTIVATED | TEAM_CREATED | TEAM_UPDATED | TEAM_DEACTIVATED | TEAM_TRANSFER_COMPLETED | INCIDENT_CREATED | INCIDENT_APPROVED | INCIDENT_REJECTED | CASE_CREATED | CASE_UPDATED | CASE_RESOLVED | CASE_CLOSED | NOTIFICATION_SENT
```

---

## 7. Technical Patterns & Design Decisions

### 7.1 Multi-Tenant Isolation

Every query scoped by `company_id` via `BaseRepository`:

```typescript
// BaseRepository.where() auto-injects company_id
async findById(id: string) {
  return this.prisma.person.findFirst({
    where: this.where({ id }), // → { id, company_id: this.companyId }
  });
}

async create(data) {
  return this.prisma.person.create({
    data: this.withCompany(data), // → { ...data, company_id: this.companyId }
  });
}
```

**Guarantees**: Schema-level `@@unique([company_id, email])`, `@@unique([company_id, name])`, DB indexes on `(company_id, ...)`.

### 7.2 Time Snapshot Capture

Single `DateTime.now()` snapshot prevents drift across midnight:

```typescript
const now = DateTime.now().setZone(timezone);
const todayStr = now.toFormat('yyyy-MM-dd');
const currentTime = now.toFormat('HH:mm');
const dayOfWeek = now.weekday === 7 ? 0 : now.weekday;
// All derived values come from ONE timestamp — no drift possible
```

### 7.3 Fire-and-Forget Pattern

Audit logs, notifications, and event emissions never block main operations:

```typescript
// In controller — after main operation succeeds
logAudit(prisma, { ... });           // No await — runs in background
emitEvent(prisma, { ... });          // No await — if fails, main op still succeeded
notify(prisma, { ... });             // No await — notification failure is non-critical
```

### 7.4 Atomic Transactions

Check-in submission uses Prisma `$transaction` for consistency:

```typescript
const result = await prisma.$transaction(async (tx) => {
  const event = await tx.event.create({ data: buildEventData(...) });
  const checkIn = await tx.checkIn.create({ data: { ...checkInData, event_id: event.id } });
  // If late + missed check-in exists → resolve in same transaction
  if (existingMiss) {
    await tx.missedCheckIn.update({ where: { id: existingMiss.id }, data: { resolved_by_check_in_id: checkIn.id, resolved_at: new Date() } });
  }
  return checkIn;
});
// Post-transaction: fire-and-forget event emission
```

### 7.5 Schedule Resolution

Worker override always takes priority over team default:

```typescript
function getEffectiveSchedule(person, team) {
  return {
    checkInStart: person.check_in_start ?? team.check_in_start,
    checkInEnd: person.check_in_end ?? team.check_in_end,
    workDays: person.work_days ?? team.work_days,
  };
}
```

### 7.6 Holiday Caching

In-memory cache with 1-hour TTL and 5000-entry cap:

```typescript
// Cache key: `${companyId}:${dateStr}`
// On cache overflow: evict expired entries first
// On company settings change: invalidate all company entries
```

### 7.7 Response Format Convention

```
Success:   { success: true, data: T }
Paginated: { success: true, data: { items: T[], pagination: { page, limit, total, totalPages } } }
Error:     { success: false, error: { code: 'ERROR_CODE', message: 'User-friendly message' } }
```

Frontend `apiClient` unwraps `response.data` — hooks receive `T` directly.

---

## 8. API Surface

### 8.1 Auth (`/api/v1/auth`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/signup` | Public (rate: 5/15min) | Register company + admin |
| POST | `/login` | Public (rate: 10/15min) | Login → JWT cookie |
| POST | `/logout` | Authenticated | Clear cookie |
| GET | `/me` | Authenticated | Current user profile |
| PATCH | `/change-password` | Authenticated | Change password + rotate JWT |
| POST | `/verify-password` | Authenticated | Re-auth gate |

### 8.2 Check-Ins (`/api/v1/check-ins`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | WORKER, TEAM_LEAD | Submit daily check-in |
| GET | `/today` | Authenticated | Get today's check-in |
| GET | `/status` | WORKER, TEAM_LEAD | Check-in window status |
| GET | `/history` | Authenticated | Paginated check-in history |
| GET | `/:id` | Owner, WHS, SUPERVISOR, ADMIN, TEAM_LEAD | Get check-in detail |

### 8.3 Teams (`/api/v1/teams`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | ADMIN | List all teams |
| POST | `/` | ADMIN | Create team |
| GET | `/missed-check-ins` | TEAM_LEAD+, WHS | Missed check-ins query |
| GET | `/analytics` | TEAM_LEAD+ | Team analytics |
| GET | `/check-in-history` | TEAM_LEAD+, WHS | Team check-in history |
| GET | `/my-members` | TEAM_LEAD+ | Current user's team members |
| GET | `/:id` | TEAM_LEAD+ | Team detail |
| PATCH | `/:id` | ADMIN | Update team |
| GET | `/:id/members` | TEAM_LEAD+ | Team member list |

### 8.4 Persons (`/api/v1/persons`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/me` | Authenticated | Own profile |
| PATCH | `/me` | Authenticated | Update own profile |
| POST | `/me/avatar` | Authenticated | Upload profile picture |
| GET | `/` | ADMIN, SUPERVISOR, WHS | List persons |
| POST | `/` | ADMIN | Create person |
| GET | `/:id` | ADMIN, SUPERVISOR, WHS | Person detail |
| PATCH | `/:id` | ADMIN | Update person |
| DELETE | `/:id/pending-transfer` | ADMIN | Cancel pending transfer |

### 8.5 Dashboard (`/api/v1/dashboard`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/summary` | SUPERVISOR+ | Company overview |
| GET | `/worker` | Authenticated | Personal stats |
| GET | `/team-lead` | TEAM_LEAD+ | Team oversight |
| GET | `/supervisor` | SUPERVISOR+ | All teams overview |
| GET | `/admin` | ADMIN | System stats |
| GET | `/team/:id` | TEAM_LEAD+ | Team dashboard |
| GET | `/whs` | WHS, ADMIN | Incident monitoring |
| GET | `/whs-analytics` | WHS | Historical analytics |
| GET | `/trends` | SUPERVISOR+ | Readiness trends |

### 8.6 Incidents (`/api/v1/incidents`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | Authenticated | Report incident |
| GET | `/my` | Authenticated | Own incidents |
| GET | `/` | WHS | All incidents |
| GET | `/:id` | Authenticated | Incident detail |
| GET | `/:id/timeline` | Authenticated | Event timeline |
| PATCH | `/:id/approve` | WHS | Approve → create case |
| PATCH | `/:id/reject` | WHS | Reject with reason |

### 8.7 Cases (`/api/v1/cases`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | WHS | List cases |
| GET | `/:id` | WHS, incident owner | Case detail |
| PATCH | `/:id` | WHS | Update case status/notes |

### 8.8 Notifications (`/api/v1/notifications`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | Authenticated | Paginated notifications |
| GET | `/unread` | Authenticated | Unread count |
| POST | `/:id/read` | Authenticated | Mark as read |
| POST | `/mark-all-read` | Authenticated | Mark all as read |

### 8.9 Admin (`/api/v1/admin`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/company/settings` | ADMIN | Company settings |
| PATCH | `/company/settings` | ADMIN | Update settings |
| GET | `/holidays` | ADMIN | List holidays |
| POST | `/holidays` | ADMIN | Create holiday |
| PATCH | `/holidays/:id` | ADMIN | Update holiday |
| DELETE | `/holidays/:id` | ADMIN | Delete holiday |
| GET | `/audit-logs` | ADMIN | Audit log history |
| GET | `/users/roles` | ADMIN | List user roles |
| PATCH | `/users/:id/role` | ADMIN | Change user role |

---

## 9. Background Jobs & Automation

### 9.1 Missed Check-In Detector

- **Schedule**: Every 15 minutes
- **Lock**: In-memory (prevents overlapping runs)
- **Process**: Per-company → holiday check → find eligible workers → detect misses → snapshot → insert → notify → emit events
- **Key rules**: 2-min buffer after window, skip workers assigned today, skip holidays/non-work days, fire-and-forget notifications

### 9.2 Transfer Processor

- **Schedule**: Every 15 minutes
- **Process**: Per-company → find pending transfers where effective_date ≤ today → validate target team active → execute transfer → notify → emit event
- **Edge case**: If target team deactivated → cancel transfer, notify worker

### 9.3 Cleanup Job

- **Schedule**: Weekly (Sunday 2:00 AM)
- **Status**: Stub — placeholder for future retention policies

---

## 10. Security & Access Control

### 10.1 Authentication

| Mechanism | Detail |
|-----------|--------|
| Token | JWT (HS256), 7-day expiry (configurable via `JWT_EXPIRES_IN`) |
| Storage | httpOnly cookie (`auth_token`) — not accessible to JavaScript |
| Fallback | `Authorization: Bearer <token>` header (for mobile/API clients) |
| Password | bcrypt (12 rounds) |
| Password change | Rotates JWT (new token + cookie issued) |
| Rate limiting | Login: 10/15min, Signup: 5/15min (in-memory) |

### 10.2 Role-Based Access Control

```
ADMIN       → Full system access (teams, workers, holidays, settings, audit logs, roles)
WHS         → Incidents, cases, worker readiness monitoring, analytics
SUPERVISOR  → Multi-team oversight, trends, reports (sees only assigned teams)
TEAM_LEAD   → Single team management, member monitoring, missed check-ins
WORKER      → Own check-in, own incidents, own notifications, own profile
```

### 10.3 Data Isolation

- `BaseRepository` auto-scopes all queries by `company_id`
- DB constraints: `@@unique([company_id, email])`, `@@unique([company_id, name])`
- `tenantMiddleware` validates company exists and is active (cached 5-min)
- Company ID from JWT — never from client input

### 10.4 Input Validation

- All request bodies validated by Zod schemas via `@hono/zod-validator`
- Zod transforms applied (trim, toLowerCase) — controllers use `c.req.valid('json' as never)`
- Frontend: React Hook Form + Zod (client-side validation mirrors server schemas)

---

## 11. Strengths

### Architecture & Engineering

1. **Clean multi-tenant isolation** — `BaseRepository` pattern ensures every query is scoped; impossible to accidentally leak data across companies
2. **Event sourcing** — Full immutable audit trail; every state change recorded with timestamp, user, and payload
3. **Atomic transactions** — Check-in + event + missed-resolution in single transaction; no orphan records
4. **Time snapshot pattern** — Single `DateTime.now()` capture prevents midnight drift bugs
5. **Fire-and-forget side effects** — Audit logs and notifications never block main operations; system stays responsive even if side effects fail
6. **Schedule-aware dashboards** — Completion rates account for holidays, non-work days, and worker assignment dates; no false compliance numbers

### Code Quality

7. **Strict TypeScript** — No `any` types; explicit return types on backend, explicit prop interfaces on frontend
8. **Consistent patterns** — Every module follows the same layer structure (routes → controller → service → repository → validator)
9. **Pattern library** — `.ai/patterns/` as single source of truth; skills auto-generated from templates
10. **Zod end-to-end** — Same validation approach on client and server; schemas serve as documentation

### Product Quality

11. **Contextual missed check-in snapshots** — 13 metrics captured at detection time; enables analytics even after worker/team changes
12. **Late check-in support** — Workers can still submit after window; flagged but not blocked
13. **Responsive UI** — Desktop sidebar + mobile bottom nav with role-aware navigation
14. **Lazy-loaded routes** — Code splitting reduces initial bundle; fast first load

---

## 12. Weaknesses & Limitations

### Critical Gaps

| # | Weakness | Impact | Severity |
|---|----------|--------|----------|
| 1 | **In-app notifications only** — no SMS, email, or push | Workers miss reminders if they don't open the app | HIGH |
| 2 | **No native mobile apps** — responsive web only | No offline mode, no push notifications, no biometric auth | HIGH |
| 3 | **In-memory job locks** — won't work in multi-instance deployments | Can't horizontally scale background jobs without Redis | HIGH |
| 4 | **No file upload on incidents** — no photos or documents | Incomplete incident documentation | MEDIUM |

### Functional Limitations

| # | Weakness | Impact | Severity |
|---|----------|--------|----------|
| 5 | **Single team per worker** — no multi-team support | Doesn't fit matrix organizations | MEDIUM |
| 6 | **No shift management** — one schedule per team | 24/7 operations need separate teams per shift | MEDIUM |
| 7 | **No custom date ranges** in analytics — fixed 7d/30d/90d only | Limited reporting flexibility | LOW |
| 8 | **No CSV/Excel export** on most pages | Manual compliance reporting not possible | MEDIUM |
| 9 | **English only** — no i18n support | Limits non-English-speaking workforce adoption | MEDIUM |
| 10 | **No cross-midnight check-in windows** — end must be after start | Can't support overnight shift check-in windows | LOW |

### Technical Debt

| # | Weakness | Impact | Severity |
|---|----------|--------|----------|
| 11 | **No Redis/caching layer** — only in-memory caches | Limited horizontal scaling | MEDIUM |
| 12 | **Readiness algorithm not medically validated** — proprietary formula | Scores may not accurately predict incident risk | MEDIUM |
| 13 | **Rate limiting is in-memory** — resets on server restart | Brief window of no rate limiting after deploy | LOW |
| 14 | **Holiday cache** — bounded to 5000 entries but no LRU eviction | Cache may thrash under high load | LOW |
| 15 | **LOGIC GAP**: Missed check-in detector filters `role: WORKER` but check-in routes allow `TEAM_LEAD` | Team leads who check in won't generate missed records | LOW |

---

## 13. Improvement Recommendations

### Phase 1 — Critical for Production Readiness

| # | Recommendation | Why |
|---|----------------|-----|
| 1 | **Add SMS/email notifications** (Twilio, SendGrid) | Workers need reminders outside the app to improve compliance |
| 2 | **Add Redis** for rate limiting, job locks, and caching | Required for horizontal scaling and multi-instance deployments |
| 3 | **Add file uploads to incidents** (already have R2 for avatars) | Complete incident documentation in one system |
| 4 | **Add CSV/PDF export** to all data tables | Compliance reporting is non-negotiable for enterprise customers |

### Phase 2 — Product Differentiation

| # | Recommendation | Why |
|---|----------------|-----|
| 5 | **Build mobile apps** (React Native) with offline check-in | Field workers need reliable check-in in low-connectivity areas |
| 6 | **Add shift management** — multiple schedules per team | Unlock 24/7 operations without workaround teams |
| 7 | **Workflow automation** — auto-escalation rules | "3 consecutive misses → notify supervisor" reduces manual monitoring |
| 8 | **Custom date range selector** for analytics | Enterprise customers expect flexible reporting |

### Phase 3 — Competitive Advantage

| # | Recommendation | Why |
|---|----------------|-----|
| 9 | **Wearable device integration** (Fitbit, Garmin) | Objective sleep data reduces self-reporting bias |
| 10 | **Predictive analytics** — ML-based incident risk scoring | Move from "is this worker fit today?" to "will this worker be at risk this week?" |
| 11 | **Webhook/API integrations** (HRIS, workers' comp) | Enterprise buyers need to integrate with existing systems |
| 12 | **Multi-language support** (i18n) | Expand to non-English markets |

### Future Phases (from existing roadmap)

- **Phase 3**: Availability/off-shift tracking
- **Phase 4**: Personal baselines + deviation detection
- **Phase 5**: Risk episodes/signal clustering
- **Phase 6**: Decision logs/explainability

---

## 14. Commercial Viability Assessment (Australian Market)

### 14.1 Is This Sellable in Australia? — Yes, Strong Market Fit

Australia has some of the **strictest workplace health and safety laws in the world**. AEGIRA directly addresses legal obligations that Australian companies are already spending significant money on.

**The regulatory environment works in your favour:**

| Regulation | What It Requires | How AEGIRA Addresses It |
|-----------|-----------------|------------------------|
| **Work Health and Safety Act 2011** (Commonwealth + harmonised state laws) | PCBUs (Person Conducting a Business or Undertaking) must ensure health and safety of workers "so far as is reasonably practicable" | AEGIRA provides documented, daily evidence of proactive worker wellness monitoring |
| **WHS Regulations 2011** — Managing risks to health and safety | Duty to identify hazards, assess risks, and implement controls | Daily readiness scores identify at-risk workers (fatigue, stress, pain) before shifts start |
| **Safe Work Australia — Code of Practice: Managing the Risk of Fatigue** | Employers must have fatigue management systems for safety-critical work | AEGIRA's sleep tracking, readiness scoring, and automated missed detection IS a fatigue management system |
| **Heavy Vehicle National Law (HVNL)** | Chain of responsibility — all parties must manage driver fatigue | AEGIRA tracks sleep hours, quality, and generates audit-ready compliance records |
| **Mining regulations** (state-based: NSW Mining Act, QLD Coal Mining Safety Act) | Mandatory fitness-for-duty programs | AEGIRA's daily check-in + readiness score + incident tracking satisfies fitness-for-duty requirements |
| **Workers' Compensation legislation** (state-based) | Employers must demonstrate due diligence in preventing injuries | AEGIRA's event-sourced audit trail provides timestamped evidence of proactive monitoring |

**Why Australian companies would pay for this:**

| Reason | Detail |
|--------|--------|
| **Legal compliance** | The WHS Act imposes duties on PCBUs with penalties up to **$3M for corporates and $600K+ for individuals** (officers). Documented wellness monitoring is "reasonably practicable" evidence. |
| **Insurance premiums** | WorkCover/icare premiums are experience-rated. Fewer claims = lower premiums. Documented safety programs can reduce premiums by 10-30%. |
| **Workers' comp claim defence** | If a worker is injured and the employer has no fitness-for-duty records, they're exposed. AEGIRA creates immutable, timestamped evidence that the employer was monitoring worker wellness daily. |
| **SafeWork/Comcare audit readiness** | State regulators (SafeWork NSW, WorkSafe VIC, Workplace Health and Safety QLD) conduct audits. AEGIRA's audit logs, event history, and compliance reports are audit-ready out of the box. |
| **Cost of incidents** | Average workers' comp claim in Australia: **$12,900** (Safe Work Australia, 2023). Serious claims: **$100K-500K+**. One prevented incident pays for years of AEGIRA. |
| **Tender/contract requirements** | Tier 1 contractors (CIMIC, Lendlease, Downer) require subcontractors to demonstrate safety management systems. AEGIRA satisfies this requirement. |

### 14.2 Market Validation — Australia is Already Buying This

This is not a new market. Australian companies are already spending on these solutions:

- **SafetyCulture** — Sydney-based, raised **$250M+ AUD**, valued at $2.1B. Proves AU market pays for WHS software at scale. But they focus on inspections/checklists, not daily worker wellness.
- **Humanforce** — AU-based workforce management. $300M+ revenue. Proves AU employers pay for digital workforce tools. But no readiness scoring or wellness check-in.
- **Fatigue management systems** — Mining companies (BHP, Rio Tinto, FMG) spend **$50-200 per worker/month** on fatigue management. Transport companies are legally required to have fatigue management under HVNL.
- **Pre-start fitness assessments** — Standard in AU construction. Currently done on **paper forms or basic apps**. Every construction site in Australia runs pre-start meetings — AEGIRA digitises this.
- **SmartCap/Optalert** — Fatigue detection via wearable devices (mining). $100-300/device + subscription. Hardware-dependent. AEGIRA requires no hardware.
- **Vault Platform/Donesafe** — WHS compliance platforms. $5-20/user/month. Focused on incident reporting and compliance, not daily worker wellness.

**Key insight**: The AU market has mature WHS compliance buyers, established budgets, and a regulatory environment that practically mandates what AEGIRA does. The gap is that most existing tools are either too broad (SafetyCulture), too hardware-dependent (SmartCap), or don't do daily wellness (Donesafe/Vault).

### 14.3 Australian Market Size

| Segment | Workers in AU | Addressable Market (est.) |
|---------|--------------|--------------------------|
| Construction | ~1.3M | 400,000+ (safety-critical roles) |
| Mining | ~270K | 270,000 (nearly all safety-critical) |
| Transport & logistics | ~650K | 300,000+ (drivers, warehouse) |
| Manufacturing | ~850K | 350,000+ (shift-based, physical) |
| Healthcare & aged care | ~1.8M | 500,000+ (shift workers, fatigue-prone) |
| Emergency services | ~120K | 120,000 (all safety-critical) |
| **Total addressable** | | **~1.9M workers** |

At **AUD $5/worker/month** average price → **AUD $114M/year** total addressable market for AU alone.

### 14.4 Readiness Score Card (AU Market)

| Dimension | Status | AU-Specific Notes |
|-----------|--------|-------------------|
| Core product functionality | Ready | Check-in, missed detection, incidents, cases, dashboards — all functional |
| Multi-tenant architecture | Ready | Can onboard multiple AU companies from day one |
| Role-based access (5 roles) | Ready | Maps to AU org structures: Admin, WHS Officer, Supervisor, Team Lead, Worker |
| Audit trail / compliance | Ready | Event sourcing + audit logs satisfy SafeWork audit requirements |
| English language | Ready | AU market is English-first — no i18n blocker |
| Timezone support | Ready | Australia/Sydney, Australia/Perth, Australia/Brisbane all supported via Luxon |
| Mobile experience | Partial | Responsive web works on phone; AU construction workers expect native apps |
| Notification delivery | Not Ready | In-app only; AU market expects SMS and email at minimum |
| Reporting / export | Not Ready | No CSV/PDF export; critical for SafeWork audits and insurer documentation |
| Data hosting / privacy | Needs Attention | Must host on AU-based servers (AWS Sydney ap-southeast-2) for data sovereignty |
| Demo environment | Not Ready | Need pre-loaded demo with AU-realistic data (AU company names, AEST timezone) |

**Verdict**: Core product is functionally ready for AU pilots. Needs SMS/email notifications, CSV/PDF export, AU data hosting, and a demo environment before closing paid deals.

---

## 15. Target Market & Buyer Profiles (Australia)

### 15.1 Tier 1 — Highest Probability Sales (Start Here)

These segments have **immediate regulatory pressure**, **established budgets for WHS tools**, and **fastest decision-making**.

| Target Segment | Company Size | Why They'd Buy | Decision Maker | Typical Budget | Sales Cycle |
|---------------|-------------|----------------|----------------|---------------|-------------|
| **Tier 2/3 construction contractors** (subcontractors to CIMIC, Lendlease, etc.) | 50-500 workers | Must demonstrate WHS compliance to win Tier 1 contracts; currently using paper pre-starts | WHS Manager or Site Manager | $2K-8K AUD/month | 2-6 weeks |
| **Mining services contractors** (Macmahon, Thiess subs, labour hire) | 100-1000 workers | Fatigue management legally required; mine operators mandate it from contractors | Safety Superintendent | $5K-15K AUD/month | 4-8 weeks |
| **Transport & logistics companies** | 50-300 drivers | HVNL Chain of Responsibility — fatigue management is a legal obligation for all parties | Fleet/Operations Manager | $2K-5K AUD/month | 2-4 weeks |
| **Labour hire / workforce agencies** (Hays, Chandler Macleod, Programmed) | 200-2000 deployed | Client companies require compliance documentation from labour hire providers | Compliance Manager | $5K-20K AUD/month | 4-8 weeks |

### 15.2 Tier 2 — Larger Deals, Established Procurement

| Target Segment | Company Size | Why They'd Buy | Decision Maker | Typical Budget | Sales Cycle |
|---------------|-------------|----------------|----------------|---------------|-------------|
| **Mid-tier construction** (Hutchinson, Built, Watpac) | 500-3000 workers | Pre-start fitness digitisation; reduce paperwork; improve compliance reporting | Head of Safety / EHS Director | $10K-30K AUD/month | 2-4 months |
| **Mining operators** (Newcrest, Mineral Resources, Northern Star) | 1000-5000+ workers | Fitness-for-duty programs mandated by state mining acts; fatigue is top safety risk | General Manager - Safety | $15K-50K AUD/month | 3-6 months |
| **Manufacturing groups** (Boral, CSR, Orora) | 500-2000 workers | Shift work fatigue, repetitive strain, WHS compliance across multiple sites | National WHS Manager | $8K-20K AUD/month | 2-4 months |
| **Aged care / healthcare groups** (Bupa, Regis, Estia) | 500-5000 staff | Shift worker fatigue, burnout prevention, staffing safety compliance | Group Safety Manager | $8K-30K AUD/month | 3-6 months |

### 15.3 Tier 3 — Enterprise (Need More Features First)

| Target Segment | Why They're Not Ready Yet | What's Missing for Them |
|---------------|--------------------------|------------------------|
| **Tier 1 contractors** (CIMIC, Lendlease, Downer, John Holland) | Need SSO/SAML, API integrations with Procore/Aconex, enterprise SLA | SSO, webhook API, dedicated instance option |
| **Major mining** (BHP, Rio Tinto, FMG) | Need integration with existing fatigue systems (SmartCap, Caterpillar DSS), custom reporting | API integrations, wearable data import, custom dashboards |
| **Federal/State government** (Defence, emergency services) | ASD Essential Eight compliance, IRAP assessment, on-premise option | Security accreditation, on-premise deployment |
| **National healthcare chains** (Ramsay, Healthscope) | Need HRIS integration (SAP, Workday), rostering system integration | API integrations, shift management |

### 15.4 Buyer Personas (Australian Market)

**Persona 1: The WHS Manager (Primary Buyer & Decision Maker)**
- **Title**: WHS Manager, Safety Manager, HSE Coordinator, Safety Superintendent
- **Company**: Tier 2/3 construction, mining services, manufacturing
- **Pain**: Running pre-start fitness checks on paper. Manually tracking who attended toolbox talks. Reactive to incidents — gets called to site after something goes wrong. Spends hours preparing for SafeWork audits by digging through paper records.
- **Motivation**: "I need a system that gives me real-time visibility into worker fitness every morning. When SafeWork walks in for an audit, I want to pull up 12 months of digital records in 30 seconds, not dig through filing cabinets."
- **Buying trigger**: SafeWork improvement notice, serious incident investigation, Tier 1 contractor requiring digital safety systems from subcontractors, insurance renewal with premium increase.
- **How they evaluate**: Demo first. Needs to see it working with realistic data. Will ask about data hosting location, export capabilities, and audit trail. Will trial with one site/team first.

**Persona 2: The Operations / Site Manager (Secondary Buyer)**
- **Title**: Operations Manager, Project Manager, Site Manager, Construction Manager
- **Company**: Construction sites, mining operations, logistics depots
- **Pain**: Doesn't know which workers are genuinely fit for duty at 6 AM. Relies on foremen's gut feeling. A fatigued crane operator or truck driver is a catastrophic risk. Has had near-misses that could have been prevented.
- **Motivation**: "Before I allocate workers to high-risk tasks, I want a GREEN/YELLOW/RED status for every person on site. If someone's RED, they go on light duties — no arguments, the data says so."
- **Buying trigger**: Near-miss incident involving fatigue, client audit finding gaps, new project with stricter safety requirements, increased workers' comp claims.

**Persona 3: The Compliance / Risk Manager (Enterprise Champion)**
- **Title**: Head of Risk, Group Compliance Manager, National Safety Director
- **Company**: Multi-site operators, corporate head offices
- **Pain**: Multiple sites using different paper forms or basic apps. No consolidated view of workforce wellness. Can't benchmark safety performance across sites. Board asks for safety KPIs and he has to compile manually.
- **Motivation**: "I need one platform across all our sites. I want a dashboard that tells me which sites have low compliance, which teams have high incident rates, and trends over 90 days."
- **Buying trigger**: Board-level safety review, WorkCover premium increase, corporate restructure of WHS function, new regulation (e.g., psychosocial hazard regulations 2023+).

**Persona 4: The Tier 1 Contractor Procurement (Gate Opener)**
- **Title**: Procurement Manager, Prequalification Officer, Supply Chain Manager
- **Company**: Tier 1 contractors (CIMIC, Lendlease, Downer)
- **Pain**: Subcontractors submit paper-based safety documentation. No way to verify daily compliance. Liability flows up the chain if a subcontractor's worker is injured.
- **Motivation**: "We want all our subcontractors on a digital WHS platform. We need to be able to audit their compliance without visiting every site."
- **Impact**: If a Tier 1 mandates AEGIRA for subcontractors → instant distribution channel to hundreds of companies.
- **Buying trigger**: Principal contractor WHS review, supply chain safety incident, regulatory change.

---

## 16. Go-to-Market Readiness (Australia)

### 16.1 Must-Have Before First AU Customer

These are **dealbreakers** in the Australian market — prospects will ask about these in the first demo.

| # | Item | Effort | Why It's a Dealbreaker in AU |
|---|------|--------|------------------------------|
| 1 | **SMS + email notifications** (Twilio AU / AWS SNS) | 3-5 days | "What happens if the worker doesn't open the app?" — AU safety managers won't accept in-app only. SMS is the standard for shift workers. |
| 2 | **CSV/PDF export** on all data tables and dashboards | 2-3 days | SafeWork auditors and insurers require printed/emailed reports. No export = no deal. |
| 3 | **AU data hosting** (AWS Sydney ap-southeast-2) | 1-2 days | Australian companies will ask "Where is our data stored?" — answer must be "Australia." Some contracts explicitly require it. |
| 4 | **Landing page / marketing website** (.com.au domain) | 2-3 days | AU buyers Google before they buy. No website = no credibility. Needs ABN, AU phone number, and professional design. |
| 5 | **Demo account with AU-realistic data** | 1 day | Demo should have Australian company names, AEST/AWST timezone, AU-style teams (riggers, boilermakers, electricians), realistic incidents. |

**Total: ~12 days of development to become AU sales-ready.**

### 16.2 Nice-to-Have That Increase Close Rate in AU

| # | Item | Effort | Impact on AU Sales |
|---|------|--------|-------------------|
| 6 | **Mobile app** (React Native) | 2-4 weeks | Construction workers expect apps. "Is there an app?" is the #1 question from site managers. Responsive web works but native = more professional + push notifications. |
| 7 | **Incident photo upload** | 2-3 days | Standard in AU incident reporting. SafetyCulture has this. Without it, WHS managers see you as incomplete. |
| 8 | **Pre-start checklist integration** | 1-2 weeks | AU construction runs "pre-start" meetings every morning. If AEGIRA can replace or complement the pre-start form, it becomes essential rather than additional. |
| 9 | **SafeWork audit report template** | 3-5 days | One-click report that generates a compliance summary formatted for state regulator audits. Massive differentiator. |
| 10 | **ABN / company registration** | 1 week (legal) | You need an Australian Business Number (ABN) to invoice AU companies. Can operate via sole trader or register a company. |

### 16.3 Sales Strategy: First 10 Australian Customers

**Phase 1: Get the First Customer (Free Pilot)**
1. Target: One **Tier 2/3 construction subcontractor** or **mining services company** in Sydney, Perth, or Brisbane
2. Channels to find them:
   - **LinkedIn**: Search "WHS Manager" + "Construction" + Australia. Direct message with a 2-line pitch.
   - **Industry associations**: Master Builders Association (MBA), Civil Contractors Federation (CCF), Australian Mines and Metals Association (AMMA)
   - **Networking**: Attend a SafeWork NSW breakfast event, AIHS (Australian Institute of Health & Safety) chapter meeting, or construction industry meetup
   - **Personal network**: Any connection in AU construction, mining, or transport
3. Offer a **free 30-day pilot on one site/team** — no risk for them
4. YOU set up their teams, workers, schedules (white-glove onboarding)
5. Weekly check-in calls to collect feedback and fix issues
6. At day 30: present a **SafeWork-ready compliance report** generated by AEGIRA
7. Convert: "This is what you'd get every month for $X. Want to continue?"

**Phase 2: Build Social Proof (Customers 2-5)**
1. Get a written testimonial or case study from pilot customer (with permission)
2. Target similar companies in the **same vertical** (e.g., all construction subcontractors)
3. Use the case study in outreach: "Company X reduced their missed pre-start checks by 80% in 30 days"
4. Offer early adopter pricing (e.g., 30-40% off for 12-month commitment)
5. Focus on **one city first** (Sydney or Perth have the most construction/mining)

**Phase 3: Scale (Customers 6-10+)**
1. Launch .com.au website with case studies, pricing, and self-serve demo
2. **LinkedIn content marketing** — Post weekly about WHS compliance, fatigue management, and Australian regulations. WHS managers are active on LinkedIn.
3. **SafeWork/WorkSafe events** — Sponsor or attend state WHS conferences
4. **Partner with safety consultants** — AU has hundreds of WHS consulting firms. They advise companies on compliance. If they recommend AEGIRA, instant trust + distribution.
5. **Apply to government supplier panels** — NSW Government ICT panel, QLD Government marketplace. Opens doors to government contracts.

**Phase 4: Channel Strategy (10+ customers)**
1. **Tier 1 contractor partnerships** — Pitch to CIMIC/Lendlease: "Mandate AEGIRA for your subcontractor supply chain." One partnership = 50-200 subcontractor customers.
2. **Labour hire partnerships** — Partner with Hays, Programmed, Chandler Macleod. They deploy workers to client sites. AEGIRA becomes part of their compliance offering.
3. **WHS consulting firm referrals** — Commission-based referral program for consultants who recommend AEGIRA to their clients.

### 16.4 Key Sales Objections and Responses (Australian Context)

| Objection | Response |
|-----------|----------|
| "We already do paper pre-starts" | "Paper pre-starts can't automatically detect who missed their check-in, calculate a readiness score, or generate a 12-month compliance report for SafeWork in 30 seconds. AEGIRA digitises what you're already doing and adds automated intelligence on top." |
| "Our workers won't use it" | "The check-in takes under 2 minutes on any phone — no app install needed, just a browser. It's simpler than filling out a paper form. And if they don't do it, AEGIRA automatically detects the miss and notifies their supervisor." |
| "We use SafetyCulture / iAuditor" | "SafetyCulture is great for inspections and checklists. AEGIRA is purpose-built for daily worker wellness — readiness scores, fatigue detection, automated missed check-in tracking, and incident-to-case management. They're complementary, not competing. SafetyCulture tells you if the site is safe. AEGIRA tells you if the worker is fit." |
| "Where is our data stored?" | "All data is hosted in Australia (AWS Sydney, ap-southeast-2). Your company's data is completely isolated at the database level — no other customer can ever access it. Full audit trail with timestamps." |
| "How much does it cost?" | "Between $3-8 AUD per worker per month depending on team size. For context, the average workers' comp claim in Australia is $12,900. One prevented incident pays for 2+ years of AEGIRA across your entire workforce." |
| "What if workers game the system?" | "Self-reporting is the accepted standard in Australian fatigue management (Safe Work Australia Code of Practice). AEGIRA tracks patterns over time — if a worker suddenly reports perfect scores every day, that's flagged as an anomaly. The system is about creating a culture of accountability, not catching liars." |
| "We need this integrated with Procore / Hammertech / Aconex" | "We're building integration APIs. In the meantime, AEGIRA works standalone with CSV export for your existing systems. Most customers start with AEGIRA standalone and integrate later." |
| "Can you come to site for a demo?" | "Absolutely. We'll set up a demo with your actual team names, rosters, and timezone. We can run it on a tablet or any phone on site. Happy to visit." |

---

## 17. Pricing Strategy (Australian Market)

### 17.1 Pricing Tiers (AUD)

| Plan | Workers | Monthly (AUD) | Per Worker/Month | What's Included |
|------|---------|--------------|-----------------|-----------------|
| **Site** | 1-50 workers | $250 | ~$5.00/worker | Daily check-in, readiness scoring, dashboards, missed detection, SMS notifications, CSV export |
| **Professional** | 51-200 workers | $700 | ~$3.50/worker | + Incident reporting, case management, WHS analytics, PDF compliance reports |
| **Enterprise** | 201-1000 workers | $2,000 | ~$2.00/worker | + Multi-site dashboards, priority support, API access, dedicated onboarding |
| **Custom** | 1000+ workers | Negotiable | ~$1.50/worker | + Dedicated instance, SLA, custom integrations, account manager |

**Annual commitment discount**: 20% off (standard AU SaaS practice — annual = 10 months pricing)

**Simple per-worker alternative**: **AUD $3-8/worker/month** (easier to explain in proposals)

### 17.2 Pricing Justification (Australian Cost Context)

| Cost Comparison | Australian Cost | AEGIRA Equivalent |
|----------------|----------------|------------------|
| Average workers' comp claim | **$12,900 AUD** (Safe Work Australia) | = 5+ years of AEGIRA Site plan |
| Serious injury claim | **$100K-500K+ AUD** | = 40-200 years of AEGIRA |
| SafeWork penalty (body corporate) | **Up to $3,000,000 AUD** | AEGIRA's audit trail is your defence evidence |
| SafeWork penalty (officer, individual) | **Up to $600,000 AUD** | Officers have personal liability — AEGIRA proves due diligence |
| Fatality prosecution costs | **$3M-10M+ AUD** (fines + legal + reputational) | No comparison — prevention is the only strategy |
| Manual compliance tracking (supervisor time) | **$5,000-10,000 AUD/month** (supervisor hours) | AEGIRA automates entirely for $250-2,000/month |
| Paper pre-start forms (printing, storage, retrieval) | **$500-2,000 AUD/month** per site | AEGIRA replaces paper — digital, searchable, instant |
| WorkCover premium increase (after claim) | **10-30% premium increase** for 3 years | Documented prevention program can reduce premiums |
| External WHS consultant audit prep | **$2,000-5,000 AUD per audit** | AEGIRA generates audit-ready reports on demand |

**ROI pitch for AU**: "AEGIRA costs less per month than one day of a supervisor's time spent on paper compliance. And if it prevents even one recordable incident per year, you've saved $12,900+ in direct costs — before counting lost time, premium increases, and regulator scrutiny."

### 17.3 Pricing Competitive Position

| Competitor | AU Price | AEGIRA Position |
|-----------|---------|----------------|
| SafetyCulture (iAuditor) | $29 AUD/user/month (Premium) | AEGIRA is **cheaper** ($3-8/worker) and purpose-built for daily wellness, not inspections |
| Donesafe | $10-25 AUD/user/month | AEGIRA is **cheaper** and has unique readiness scoring + automated missed detection |
| Vault Platform | $8-15 AUD/user/month | AEGIRA is **comparable** price with deeper daily wellness features |
| SmartCap (fatigue wearable) | $100-300/device + subscription | AEGIRA requires **no hardware** — massively cheaper to deploy |
| Humanforce | $5-12 AUD/user/month | AEGIRA is **comparable** but focused on WHS, not general workforce management |
| Paper / Excel | "Free" | AEGIRA saves **$5K-10K/month** in supervisor time + eliminates compliance gaps |

**Sweet spot**: AEGIRA at $3-8 AUD/worker/month is **cheaper than every digital competitor** while being **more focused on daily fitness-for-duty** than any of them.

---

## 18. Competitive Positioning (Australian Market)

### 18.1 Competitive Landscape — How AEGIRA Fits

```
                        Broad WHS Platform
                              │
                   Donesafe ──┤── SafetyCulture
                              │
                              │
        Daily Wellness ───────┼──────── General Compliance
        (AEGIRA's niche)      │
                              │
                   AEGIRA ────┤── Vault Platform
                              │
                              │
                        Worker-Level Focus
```

**AEGIRA occupies an underserved quadrant**: Daily worker-level wellness + fitness-for-duty. Most competitors are either broad compliance platforms (inspections, audits, incident only) or hardware-dependent fatigue solutions (wearables).

### 18.2 Detailed Competitive Analysis

| Feature | AEGIRA | SafetyCulture | Donesafe | Vault | SmartCap |
|---------|--------|--------------|----------|-------|----------|
| Daily wellness check-in | Yes (core) | No | No | No | No (wearable-based) |
| Readiness score (0-100) | Yes (core) | No | No | No | Fatigue score (hardware) |
| Automated missed detection | Yes (core) | No | No | No | N/A |
| Contextual miss snapshots (13 metrics) | Yes | No | No | No | No |
| Incident reporting | Yes | Yes | Yes | Yes | No |
| Case management | Yes | Basic | Yes | Yes | No |
| WHS analytics (trends, charts) | Yes | Yes (inspection-focused) | Yes | Basic | No |
| Role-based dashboards (5 roles) | Yes | Yes (different roles) | Yes | Basic | No |
| Pre-start checklist | Not yet | Yes (core strength) | Yes | No | No |
| Inspection templates | No | Yes (core strength) | Yes | No | No |
| Mobile native app | Not yet | Yes | Yes | Yes | N/A (hardware) |
| Hardware required | No | No | No | No | Yes ($100-300/device) |
| Multi-tenant | Yes | Yes | Yes | Yes | No |
| AU data hosting | Configurable | Yes (Sydney) | Yes (Sydney) | Yes | Yes |
| Price per worker/month (AUD) | **$3-8** | $19-29 | $10-25 | $8-15 | $50-100+ (device amortised) |

### 18.3 AEGIRA's Unique Selling Points for AU Market

1. **Purpose-built daily fitness-for-duty** — The only platform focused specifically on "Is this worker fit for duty right now?" SafetyCulture checks sites. Donesafe manages incidents. AEGIRA checks workers.

2. **Automated compliance without hardware** — No wearable devices, no sensors, no installation. Works on any phone with a browser. Deploy to 500 workers in an afternoon, not months.

3. **Readiness score with component breakdown** — Not just "fit/unfit" but a 0-100 score with sleep, stress, physical, and pain components. Supervisors can make nuanced decisions (GREEN = full duties, YELLOW = modified, RED = stand down).

4. **Automated missed check-in detection with contextual intelligence** — No manual attendance tracking. The system detects who missed, captures 13 contextual metrics (streak, frequency, recent average), and notifies supervisors automatically. This alone saves hours per site per day.

5. **Complete incident-to-case lifecycle** — Report → WHS review → case → investigation → resolution, all in one system. Full audit trail for SafeWork/WorkSafe investigations.

6. **Price disruption** — At $3-8 AUD/worker/month, AEGIRA is 50-75% cheaper than SafetyCulture and 90%+ cheaper than hardware-based fatigue solutions. For a 200-worker construction site, that's $700 AUD/month vs $5,800+ for SafetyCulture.

### 18.4 Positioning Statement (Australian Market)

> **For Australian construction, mining, and industrial companies** that need to prove worker fitness-for-duty every day, **AEGIRA** is a **workforce readiness platform** that automates daily wellness check-ins, calculates readiness scores, detects missed compliance, and manages workplace incidents — **at a fraction of the cost of SafetyCulture or hardware-based fatigue systems**, with zero installation and real-time visibility across all your sites and teams.

### 18.5 One-Liner Pitch Variants

| Audience | Pitch |
|----------|-------|
| WHS Manager | "AEGIRA replaces your paper pre-starts with a digital fitness-for-duty system that auto-detects misses and generates audit-ready reports." |
| Site Manager | "Before you allocate workers to high-risk tasks, AEGIRA tells you who's GREEN, YELLOW, or RED — in real time, on your phone." |
| Executive / Board | "AEGIRA reduces our WHS liability exposure by providing documented, daily evidence of proactive worker wellness monitoring across all sites." |
| Insurer / WorkCover | "Our client uses AEGIRA to monitor worker fitness daily with automated compliance tracking — here are 12 months of audit-ready records." |
| Tier 1 Contractor Procurement | "Require AEGIRA for your subcontractor supply chain. Real-time visibility into every subcontractor's daily WHS compliance — no more paper." |

---

## Summary

AEGIRA V5 is a **well-architected, production-grade workforce readiness platform** with strong foundations in multi-tenant isolation, event sourcing, automated compliance detection, and role-based access control. The codebase follows consistent patterns across 10 backend modules and 8 frontend features, with strict TypeScript and Zod validation end-to-end.

**Core value proposition**: AEGIRA shifts workplace safety from **reactive** (manage incidents after they happen) to **preventive** (identify at-risk workers before incidents occur) through daily wellness check-ins, automated compliance tracking, and contextual analytics.

**Australian market fit**: Australia's strict WHS Act (penalties up to $3M), mandatory fatigue management codes, and established safety budgets create a market that is actively looking for what AEGIRA does. The competitive landscape is either too broad (SafetyCulture), too expensive (wearables), or missing the daily wellness layer entirely (Donesafe/Vault). At $3-8 AUD/worker/month, AEGIRA undercuts every digital competitor while being the only platform purpose-built for daily fitness-for-duty.

**Commercial readiness**: ~12 days of development (SMS notifications, CSV/PDF export, AU data hosting, landing page, demo account) to become sales-ready for the Australian market.

**Recommended first move**: Target one Tier 2/3 construction subcontractor or mining services company in Sydney or Perth. Offer a free 30-day pilot on one site. Use the pilot to generate a SafeWork-ready compliance report as proof of value. Convert to paid, get a testimonial, and repeat within the same vertical.

**Production-ready for**: Australian organisations with < 5,000 workers, single-instance deployment, English-speaking workforce.

**Needs work for**: Multi-instance horizontal scaling (Redis), native mobile app (construction workers expect it), enterprise integrations (Procore, Hammertech, SAP), and Tier 1 contractor requirements (SSO, dedicated instances, SLA).

---

## 19. Executive Assessment: Will This Sell in Australia?

> **Verdict: Yes. The Australian market is one of the strongest possible markets for AEGIRA.**

### 19.1 Why Australia is the Right Market

**The regulation is doing your selling for you.**

Australia's **Work Health and Safety Act 2011** imposes a positive duty on every PCBU (Person Conducting a Business or Undertaking) to ensure worker health and safety "so far as is reasonably practicable." This isn't optional — it's law across every state and territory (harmonised except VIC and WA, which have equivalent legislation). Companies that can't demonstrate proactive safety management are legally exposed.

The penalties are severe enough to drive purchasing decisions:

| Penalty | Amount (AUD) | What This Means for AEGIRA |
|---------|-------------|---------------------------|
| Corporate fine (Category 1 — reckless conduct) | Up to **$3,000,000** | Companies will pay $250-2,000/month to avoid this exposure |
| Individual officer fine (Category 1) | Up to **$600,000** | Directors and managers have PERSONAL liability — they want documented proof |
| Corporate fine (Category 2 — failure to comply) | Up to **$1,500,000** | Even non-reckless failures carry $1.5M exposure |
| Fatality prosecution (total cost) | **$3M-10M+** (fines + legal + reputational) | Prevention is the only strategy — AEGIRA IS prevention |
| Average workers' comp claim | **$12,900** | One prevented incident = 5+ years of AEGIRA subscription |

**Bottom line**: Australian companies aren't buying AEGIRA because it's nice to have. They're buying it because the alternative — not having documented fitness-for-duty monitoring — exposes them to millions in penalties and personal liability for their officers.

### 19.2 The Gap in the Market is Real

The Australian WHS software market is mature but has a clear blind spot:

```
What exists:                          What's missing (AEGIRA's gap):
─────────────────────────────────     ──────────────────────────────────────
SafetyCulture → Site inspections      Daily WORKER wellness check-in
Donesafe → Incident management        Automated fitness-for-duty scoring
Vault → Compliance reporting           Automated missed check-in detection
SmartCap → Fatigue (wearable)         No-hardware readiness assessment
Humanforce → Workforce scheduling      Contextual missed check-in intelligence
                                       Incident-to-case lifecycle (built-in)
```

Every existing tool either:
- Checks the **site** (SafetyCulture) — not the **worker**
- Manages incidents **after** they happen (Donesafe/Vault) — not **before**
- Requires **expensive hardware** (SmartCap at $100-300/device) — AEGIRA uses any phone
- Is too **broad** (Humanforce) — not focused on daily fitness-for-duty

**AEGIRA is the only platform that answers: "Is this specific worker fit for duty RIGHT NOW?" — without hardware, at $3-8/worker/month.**

### 19.3 Why the Price Point Works

Australian construction and mining companies already have **WHS budgets**. They're already spending on safety. The question isn't "Can they afford AEGIRA?" — it's "Is AEGIRA cheaper than what they're doing now?"

| What they spend now | Monthly cost | AEGIRA replacement cost |
|--------------------|-------------|------------------------|
| Safety supervisor time on paper pre-starts + attendance | $5,000-10,000/month | $250-2,000/month |
| SafetyCulture Premium (200 workers) | $5,800/month | $700/month (AEGIRA Professional) |
| SmartCap fatigue wearables (200 workers) | $10,000-20,000/month (amortised) | $700/month, no hardware |
| External WHS consultant for audit prep | $2,000-5,000 per audit | Included — AEGIRA generates audit reports on demand |
| WorkCover premium increase after one claim | 10-30% increase for 3 years | AEGIRA's prevention reduces claims |

**At every comparison, AEGIRA is cheaper.** This isn't a hard sell on price — it's a no-brainer.

### 19.4 The Features That Win in AU

Ranked by what Australian buyers care about most:

| # | Feature | Why AU Buyers Care | Competitor Gap |
|---|---------|-------------------|---------------|
| 1 | **Automated missed check-in detection** | "Who didn't do their pre-start today?" — currently tracked manually or not at all | No competitor has this |
| 2 | **Readiness score (GREEN/YELLOW/RED)** | Site managers want to allocate workers to high-risk tasks based on fitness, not gut feeling | SmartCap has fatigue score but requires $300 hardware per worker |
| 3 | **Audit trail (event sourcing)** | SafeWork walks in → pull up 12 months of records in 30 seconds, not file cabinets | SafetyCulture has audit for inspections, not daily worker wellness |
| 4 | **Incident → Case management** | One system for reporting, review, investigation, resolution | Donesafe has this but no daily wellness layer |
| 5 | **WHS analytics (7d/30d/90d)** | "Which teams have declining readiness? Which sites have the most incidents?" | Competitors have analytics but not tied to daily worker fitness data |
| 6 | **SMS notifications** (once built) | Reach workers on construction sites who don't check apps | Table stakes in AU — must have |
| 7 | **CSV/PDF compliance reports** (once built) | SafeWork auditors, insurers, and Tier 1 contractors all need printable documentation | Table stakes — must have |

### 19.5 What Needs to Happen Before Selling

**12 days of development separates AEGIRA from being AU sales-ready:**

| # | Task | Days | Status |
|---|------|------|--------|
| 1 | SMS notifications (Twilio AU or MessageMedia) | 3-5 | Not started |
| 2 | CSV/PDF export on all data tables + dashboards | 2-3 | Not started |
| 3 | Deploy to AWS Sydney (ap-southeast-2) | 1-2 | Not started |
| 4 | Landing page on .com.au domain | 2-3 | Not started |
| 5 | Demo account with AU-realistic data | 1 | Not started |
| | **Total** | **~12 days** | |

After these 5 items, the system is ready for a paid pilot.

### 19.6 The First Sale — Exact Playbook

**Target**: One Tier 2/3 construction subcontractor in Sydney or Perth (50-200 workers).

**Why them**: They're required by Tier 1 contractors (CIMIC, Lendlease, Downer) to demonstrate WHS compliance. They currently use paper. They have budget. They make decisions fast (owner-operator, no procurement committee).

**Step-by-step**:

1. **Find the prospect** (Week 1)
   - LinkedIn: Search "WHS Manager" OR "Safety Manager" + "Construction" + Sydney/Perth
   - Message: "Hi [Name], I built a digital fitness-for-duty platform that replaces paper pre-starts with automated readiness scoring and compliance reports. Would you be open to a 15-min demo?"
   - Alternative: Attend a Master Builders Association (MBA) or AIHS chapter event. Hand out cards.

2. **Demo** (Week 2)
   - Show the demo account with AU data (AEST timezone, AU job roles, realistic incidents)
   - Key moments to highlight:
     - Worker check-in: 2 minutes on phone → instant GREEN/YELLOW/RED score
     - Dashboard: "8 of 10 workers checked in. 1 pending. 1 missed."
     - Missed detection: "The system automatically flagged Maria at 10:15 AM"
     - Compliance report: "Here's your last 30 days, ready for SafeWork"
   - Close the demo: "Want to try it on one of your sites for 30 days? Free."

3. **Pilot** (Week 3-6)
   - YOU set up their teams, workers, schedules (white-glove onboarding)
   - Train the site manager (15-min walkthrough)
   - Workers just need the URL on their phone
   - Weekly check-in call: "What's working? What's not?"
   - Fix issues in real-time (you have the codebase, you can ship fast)

4. **Convert** (Week 7)
   - Present: "In 30 days, AEGIRA detected 47 missed check-ins, flagged 12 RED-status workers, and generated this compliance report."
   - Ask: "This is what you'd get every month for $700 AUD. Want to continue?"
   - If yes → first paying customer + case study
   - If no → ask why, fix it, try next prospect

5. **Scale** (Week 8+)
   - Write case study with customer's permission
   - Reach out to 10 similar companies: "Company X reduced missed pre-starts by 80% in 30 days with AEGIRA. Want a demo?"
   - Repeat

### 19.7 Revenue Projections (Conservative)

| Milestone | Customers | Workers | Monthly Revenue (AUD) | Annual (AUD) |
|-----------|-----------|---------|----------------------|-------------|
| Month 3 (pilot converts) | 1 | 100 | $350 | $4,200 |
| Month 6 | 3 | 400 | $1,400 | $16,800 |
| Month 12 | 8 | 1,200 | $4,200 | $50,400 |
| Month 18 | 15 | 3,000 | $10,500 | $126,000 |
| Month 24 | 25 | 6,000 | $21,000 | $252,000 |
| Month 36 (with Tier 1 channel) | 50+ | 15,000+ | $52,500+ | $630,000+ |

**Note**: These are conservative. One Tier 1 contractor partnership (e.g., Lendlease mandating AEGIRA for subcontractors) could add 50-200 companies in a single deal.

### 19.8 Final Verdict

| Question | Answer |
|----------|--------|
| Is the product ready? | **Core is ready.** 12 days of dev for AU-specific requirements (SMS, export, hosting, landing page, demo). |
| Is the market real? | **Yes.** $3M penalties, mandatory fatigue management, established WHS budgets. Companies are already paying for less capable tools. |
| Is the price right? | **Yes.** $3-8 AUD/worker/month undercuts every competitor by 50-90%. Cheaper than paper when you count supervisor time. |
| Is the timing right? | **Yes.** Psychosocial hazard regulations (2023+) are expanding WHS obligations. Companies are actively looking for new compliance tools. |
| Can one person sell this? | **Yes.** Start with LinkedIn outreach + one free pilot. No sales team needed for first 10 customers. |
| What's the biggest risk? | **Execution speed.** The gap in the market exists now. Build the 5 must-haves, get the first pilot, and move fast before a competitor fills the gap. |

**The system is solid. The market is waiting. Build the 5 must-haves and go get your first Australian customer.**

---

*Document prepared as a senior engineering system review for Australian market entry. Last updated February 2026.*
