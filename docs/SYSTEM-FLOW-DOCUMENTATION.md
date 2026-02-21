# AEGIRA V5 — System Flow Documentation

> **Purpose**: Step-by-step system flow from Worker to all roles, complete feature review, and what makes the system valuable.

---

## Table of Contents

1. [System Overview — Ano ang AEGIRA?](#1-system-overview)
2. [Role Hierarchy & Access](#2-role-hierarchy--access)
3. [System Flow: Worker Perspective](#3-system-flow-worker-perspective)
4. [System Flow: Team Lead Perspective](#4-system-flow-team-lead-perspective)
5. [System Flow: Supervisor Perspective](#5-system-flow-supervisor-perspective)
6. [System Flow: WHS (Health & Safety) Perspective](#6-system-flow-whs-perspective)
7. [System Flow: Admin Perspective](#7-system-flow-admin-perspective)
8. [Cross-Role Features](#8-cross-role-features)
9. [Automated System Processes](#9-automated-system-processes)
10. [Complete Feature Matrix](#10-complete-feature-matrix)
11. [Data Flow Diagram](#11-data-flow-diagram)
12. [What Makes AEGIRA Valuable](#12-what-makes-aegira-valuable)
13. [Benefits for Australian Companies](#13-benefits-for-australian-companies)
14. [Target Market](#14-target-market)
15. [Summary: Why AEGIRA Exists](#15-summary-why-aegira-exists)

---

## 1. System Overview

**AEGIRA** is a **multi-tenant workforce readiness and check-in management system**. It answers one critical question every day:

> *"Is this worker physically and mentally ready for duty today?"*

### Core Value Proposition

| Problem | AEGIRA Solution |
|---------|-----------------|
| No visibility into worker wellness | Daily readiness scoring (sleep, stress, physical, pain) |
| Late or absent workers go unnoticed | Automated missed check-in detection every 15 minutes |
| Workplace incidents poorly tracked | Full incident → case pipeline with WHS review |
| Teams managed on paper or spreadsheets | Digital team management with schedule enforcement |
| No data for safety decisions | Readiness trends, analytics, and compliance reports |
| Disconnected reporting hierarchy | Role-based dashboards — each role sees exactly what they need |

### How It Works (High Level)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AEGIRA SYSTEM                               │
│                                                                     │
│  WORKER ──check-in──→ READINESS SCORE ──→ TEAM LEAD sees status     │
│    │                      │                      │                  │
│    │                      ▼                      ▼                  │
│    │               GREEN/YELLOW/RED       SUPERVISOR sees teams     │
│    │                                             │                  │
│    └──report incident──→ WHS reviews ──→ CASE investigation        │
│                                                                     │
│  ADMIN manages: workers, teams, holidays, company settings          │
│  SYSTEM auto-detects: missed check-ins, late submissions            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Role Hierarchy & Access

```
                    ┌──────────┐
                    │  ADMIN   │  ← Full system control
                    └────┬─────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
       ┌────▼───┐  ┌─────▼─────┐  ┌──▼──────────┐
       │  WHS   │  │SUPERVISOR │  │ (other admin │
       │Officer │  │           │  │  functions)  │
       └────┬───┘  └─────┬─────┘  └─────────────┘
            │            │
            │       ┌────▼─────┐
            │       │TEAM LEAD │  ← Direct team oversight
            │       └────┬─────┘
            │            │
            │       ┌────▼─────┐
            └───────│  WORKER  │  ← Daily check-ins + incident reports
                    └──────────┘
```

### What Each Role Can Do

| Role | Primary Responsibility | Key Pages |
|------|----------------------|-----------|
| **WORKER** | Submit daily check-ins, report incidents | Dashboard, Check-In, History, My Incidents |
| **TEAM_LEAD** | Monitor team check-in status, track readiness | Team Dashboard, Members, Missed Check-Ins, Analytics |
| **SUPERVISOR** | Oversee multiple teams, view trends | Supervisor Dashboard, Teams, Analytics, Reports |
| **WHS** | Review incidents, manage safety cases | WHS Dashboard, Incidents, Cases, Analytics, Workers |
| **ADMIN** | Full system management | Admin Dashboard, Teams, Workers, Holidays, Settings, Audit Logs |

---

## 3. System Flow: Worker Perspective

The **WORKER** is the foundation of the entire system. Everything starts here.

### 3.1 Daily Check-In Flow (Core Feature)

This is the **most important flow** in the entire system — it generates all readiness data.

```
WORKER opens app
    │
    ▼
┌─────────────────────────────────────┐
│         WORKER DASHBOARD            │
│                                     │
│  ┌─ Has checked in today? ─────┐   │
│  │                             │   │
│  │  NO                   YES   │   │
│  │  ↓                    ↓     │   │
│  │  Show schedule    Show today's│  │
│  │  status:          readiness: │   │
│  │  • Holiday?       • Score %  │   │
│  │  • Day off?       • Level    │   │
│  │  • Too early?     • Metrics  │   │
│  │  • Window open?             │   │
│  │  • Window closed?           │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
    │
    │ (clicks "Start Check-In")
    ▼
┌─────────────────────────────────────┐
│         CHECK-IN FORM               │
│                                     │
│  1. Hours Slept      _____ hours    │
│  2. Sleep Quality    _____ / 10     │
│  3. Stress Level     _____ / 10     │
│  4. Physical Cond.   _____ / 10     │
│  5. Pain Level       _____ / 10     │
│  6. Pain Location    ___________    │
│  7. Notes (optional) ___________    │
│                                     │
│  [ Submit Check-In ]                │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│     READINESS CALCULATION           │
│                                     │
│  Formula:                           │
│    Sleep    × 30%                   │
│    Stress   × 30%                   │
│    Physical × 25%                   │
│    Pain     × 15%                   │
│    ─────────────                    │
│    = READINESS SCORE (0-100)        │
│                                     │
│  Levels:                            │
│    75-100  → GREEN  (Ready)         │
│    50-74   → YELLOW (Modified duty) │
│    0-49    → RED    (Needs help)    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│     RESULT DISPLAYED                │
│                                     │
│  ✓ Readiness: 82% (GREEN)          │
│  ✓ Recommendations shown           │
│  ✓ Factor breakdown displayed       │
│  ✓ Event recorded in system         │
│  ✓ Team Lead notified (if RED)      │
└─────────────────────────────────────┘
```

**Step-by-step detail:**

| Step | What Happens | Backend Logic |
|------|-------------|---------------|
| 1 | Worker opens dashboard | `GET /dashboard/worker` — fetches today's status, streak, schedule |
| 2 | System checks eligibility | `GET /check-ins/status` — validates: active worker, active team, not holiday, work day, window timing |
| 3 | Worker fills form | Client-side Zod validation (all fields 1-10 range, hours 0-24) |
| 4 | Worker submits | `POST /check-ins` — validates schedule, calculates readiness |
| 5 | Late detection | If submitted after window closes → flagged as `is_late`, `late_by_minutes` calculated |
| 6 | Missed check-in resolved | If a MissedCheckIn record exists for today → auto-resolved |
| 7 | Event recorded | `CHECK_IN_SUBMITTED` event created with full time tracking |
| 8 | Result returned | Check-in record with readiness score, level, factor breakdown |

### 3.2 Schedule Rules

```
Worker's effective schedule = Personal Override OR Team Default

Personal Override (set by Admin):
  • work_days: "1,2,3,4,5" (custom)
  • check_in_start: "07:00"
  • check_in_end: "11:00"

Team Default (set by Admin on team):
  • work_days: "1,2,3,4,5" (Mon-Fri)
  • check_in_start: "06:00"
  • check_in_end: "10:00"

Check-In Window Rules:
  • Before window opens → ERROR: "Too early, window opens at [time]"
  • During window       → NORMAL submission
  • After window closes → ALLOWED but flagged as LATE
  • Holiday             → ERROR: "No check-in required (holiday)"
  • Not a work day      → ERROR: "Not a scheduled work day"
  • Newly assigned today→ "Not required" (starts tomorrow)
```

### 3.3 Check-In History

```
Worker → History Page
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  CHECK-IN HISTORY (Paginated, 10 per page)                  │
│                                                             │
│  Date        Time    Status   Readiness  Sleep  Stress ...  │
│  ──────────  ──────  ───────  ─────────  ─────  ────── ...  │
│  2026-02-21  08:30   On-time  85% GREEN  7.5h   3/10   ... │
│  2026-02-20  10:45   Late     62% YELLOW 5.0h   7/10   ... │
│  2026-02-19  07:15   On-time  91% GREEN  8.0h   2/10   ... │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Incident Reporting

Any worker can report a workplace incident:

```
Worker → "Report Incident"
    │
    ▼
┌─────────────────────────────────────┐
│     INCIDENT REPORT FORM            │
│                                     │
│  Type: [dropdown]                   │
│    • Physical Injury                │
│    • Illness/Sickness               │
│    • Mental Health                  │
│    • Medical Emergency              │
│    • Health & Safety Concern        │
│    • Other                          │
│                                     │
│  Severity: [dropdown]               │
│    • Low (minor, no danger)         │
│    • Medium (needs attention)       │
│    • High (urgent)                  │
│    • Critical (life-threatening)    │
│                                     │
│  Title: _______________             │
│  Location: ____________             │
│  Description: _________             │
│                                     │
│  [ Submit Report ]                  │
└─────────────────────────────────────┘
    │
    ▼
  Incident created (status: PENDING)
  → WHS officer receives notification
  → Worker can track in "My Incidents"
```

### 3.5 Worker Notifications

Workers receive notifications for:
- Check-in reminders
- Incident approval/rejection
- Team transfer notices
- Team deactivation
- Holiday announcements

---

## 4. System Flow: Team Lead Perspective

The **TEAM LEAD** is the first line of oversight — they monitor their team's daily readiness.

### 4.1 Team Lead Dashboard

```
TEAM LEAD opens dashboard
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│              TEAM LEAD DASHBOARD                         │
│                                                          │
│  Team: "Alpha Squad"                                     │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │Team Size │ │Check-Ins │ │Avg Ready │ │Compliance│   │
│  │   12     │ │  8/10    │ │   78%    │ │   80%    │   │
│  │ members  │ │  today   │ │  today   │ │  rate    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  Note: "10" = expected check-ins (excludes holidays,     │
│         newly assigned workers, non-work days)           │
│                                                          │
│  ┌─ MEMBER STATUS TABLE ────────────────────────────┐   │
│  │ Sorted by priority: Missed → Pending → Submitted │   │
│  │                                                   │   │
│  │ Name        Status    Readiness  Score   Time     │   │
│  │ ──────────  ────────  ─────────  ──────  ──────   │   │
│  │ Juan Cruz   MISSED    —          —       —        │   │
│  │ Maria Santos MISSED   —          —       —        │   │
│  │ Pedro Reyes PENDING   —          —       —        │   │
│  │ Ana Garcia  SUBMITTED GREEN      85%     08:30    │   │
│  │ Jose Rizal  SUBMITTED YELLOW     62%     09:15    │   │
│  │ ...                                               │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Team Lead Features

| Feature | Path | What It Shows |
|---------|------|---------------|
| **Dashboard** | `/team-dashboard` | Real-time team status, member check-in status table |
| **Members** | `/team/members` | Full member roster with current readiness |
| **Missed Check-Ins** | `/team/missed-check-ins` | Workers who missed their check-in, with historical context |
| **Analytics** | `/team/analytics` | Readiness trends (7d/30d/90d), completion rates |
| **Check-In History** | `/team/check-in-history` | Browse any member's past check-ins |
| **Worker Detail** | `/team/workers/:id` | Individual worker profile + check-in trends |

### 4.3 Missed Check-In Detail (What Team Lead Sees)

```
Team Lead clicks "View" on missed check-in
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  MISSED CHECK-IN DETAIL                             │
│                                                     │
│  Worker: Juan Cruz                                  │
│  Date: Feb 21, 2026                                 │
│  Schedule Window: 06:00 - 10:00                     │
│  Status: UNRESOLVED                                 │
│                                                     │
│  ── State When Missed ──                            │
│  Streak before miss: 15 days                        │
│  Avg readiness (recent): 78%                        │
│  Days since last check-in: 1                        │
│  Days since last miss: 45                           │
│                                                     │
│  ── Miss Frequency ──                               │
│  Last 30 days: 0 misses                             │
│  Last 60 days: 1 miss                               │
│  Last 90 days: 2 misses                             │
│                                                     │
│  Badge: "First miss in 30 days"                     │
└─────────────────────────────────────────────────────┘
```

---

## 5. System Flow: Supervisor Perspective

The **SUPERVISOR** oversees multiple teams — they see the bigger picture.

### 5.1 Supervisor Dashboard

```
SUPERVISOR opens dashboard
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│              SUPERVISOR DASHBOARD                        │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Teams   │ │ Workers  │ │Check-Ins │ │Avg Ready │   │
│  │    4     │ │   48     │ │  35/40   │ │   76%    │   │
│  │ assigned │ │  total   │ │  today   │ │ company  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ┌─ TEAM OVERVIEW ──────────────────────────────────┐   │
│  │                                                   │   │
│  │ Team          Lead        Workers  Check-Ins  Avg │   │
│  │ ────────────  ──────────  ───────  ─────────  ─── │   │
│  │ Alpha Squad   Juan Cruz   12       10/10    82%   │   │
│  │ Bravo Team    Maria S.    15       12/14    71%   │   │
│  │ Charlie Unit  Pedro R.    11       8/10     79%   │   │
│  │ Delta Force   Ana G.      10       5/6      85%   │   │
│  │                                                   │   │
│  │ (click any team → team detail)                    │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Supervisor Features

| Feature | Path | What It Shows |
|---------|------|---------------|
| **Dashboard** | `/dashboard` | All assigned teams overview, aggregate stats |
| **Teams** | `/team` | Team list with member counts, create/edit teams |
| **Missed Check-Ins** | `/team/missed-check-ins` | Cross-team missed check-ins |
| **Analytics** | `/team/analytics` | Multi-team readiness trends |
| **Reports** | `/team/reports` | Compliance reports, export options |
| **Trends** | via dashboard | 30-day readiness trends by team |

### 5.3 Supervisor vs Team Lead Scope

```
SUPERVISOR sees:               TEAM LEAD sees:
├── Team A (assigned)           ├── Team A (their team only)
│   ├── Members                 │   ├── Members
│   ├── Check-ins               │   ├── Check-ins
│   └── Analytics               │   └── Analytics
├── Team B (assigned)           └── (nothing else)
│   ├── Members
│   └── ...
├── Team C (assigned)
└── Cross-team analytics
```

---

## 6. System Flow: WHS Perspective

The **WHS (Workplace Health & Safety)** officer handles incident investigation and safety cases.

### 6.1 WHS Dashboard

```
WHS Officer opens dashboard
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│              WHS DASHBOARD                               │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Pending  │ │ My Open  │ │All Open  │ │Resolved  │   │
│  │Incidents │ │  Cases   │ │  Cases   │ │This Month│   │
│  │    5     │ │    3     │ │    8     │ │   12     │   │
│  │ awaiting │ │ assigned │ │  total   │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ┌─ PENDING INCIDENTS TABLE ────────────────────────┐   │
│  │ #     Reporter    Type           Sev.   Actions   │   │
│  │ ────  ──────────  ─────────────  ─────  ──────    │   │
│  │ I-001 Juan Cruz   Physical Inj.  HIGH   View│Appr│   │
│  │ I-002 Maria S.    Mental Health   MED    View│Appr│   │
│  │ I-003 Pedro R.    Safety Concern  LOW    View│Appr│   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Cases by Status ─┐  ┌─ Recent Activity ──────────┐  │
│  │   [PIE CHART]     │  │ • Case C-005 → Investigating│  │
│  │   Open: 3         │  │ • Incident I-001 approved    │  │
│  │   Investigating: 2│  │ • Case C-003 → Resolved      │  │
│  │   Resolved: 5     │  │ • Incident I-008 rejected    │  │
│  │   Closed: 8       │  │                              │  │
│  └───────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Incident → Case Pipeline (Most Important WHS Flow)

```
┌──────────┐     ┌────────────────┐     ┌──────────────────┐
│  WORKER  │────→│    INCIDENT    │────→│      CASE        │
│  Reports │     │   (PENDING)    │     │     (OPEN)       │
└──────────┘     └───────┬────────┘     └────────┬─────────┘
                         │                       │
                    WHS Reviews                  │
                    ┌────┴────┐              WHS Manages
                    │         │                  │
               ┌────▼───┐ ┌──▼──────┐     ┌─────▼──────────┐
               │APPROVED│ │REJECTED │     │ INVESTIGATING  │
               │        │ │         │     └────────┬───────┘
               │Creates │ │Reason   │              │
               │ Case   │ │provided │         ┌────▼────┐
               └────────┘ └─────────┘         │RESOLVED │
                                              └────┬────┘
                                                   │
                                              ┌────▼────┐
                                              │ CLOSED  │
                                              └─────────┘
```

**Step-by-step:**

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Worker | Reports incident via form | Incident created (PENDING), WHS notified |
| 2 | WHS | Opens `/whs/incidents`, filters by "Pending" | Sees all pending incidents |
| 3 | WHS | Reviews incident details | Full incident info + reporter profile |
| 4a | WHS | **Approves** incident | Case auto-created (OPEN), reporter notified, event logged |
| 4b | WHS | **Rejects** incident (with reason) | Reporter notified with rejection reason |
| 5 | WHS | Opens `/whs/cases` | Manages case lifecycle |
| 6 | WHS | Assigns case to self | Status → INVESTIGATING |
| 7 | WHS | Adds investigation notes | Timeline updated |
| 8 | WHS | Marks as resolved | Status → RESOLVED, timestamp recorded |
| 9 | WHS | Closes case | Status → CLOSED (final state) |

### 6.3 WHS Additional Features

| Feature | Path | Purpose |
|---------|------|---------|
| **Workers List** | `/whs/workers` | View all workers with risk indicators |
| **WHS Analytics** | `/whs-analytics` | Incident trends by type/severity, case resolution times |
| **Incident Timeline** | `/incidents/:id/timeline` | Full event history of an incident |

---

## 7. System Flow: Admin Perspective

The **ADMIN** has full system control — they set up and maintain everything.

### 7.1 Admin Dashboard

```
ADMIN opens dashboard
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│              ADMIN DASHBOARD                             │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Teams   │ │ Workers  │ │Team Leads│ │Supervisors│  │
│  │  6 total │ │  52 reg  │ │  4 asgn  │ │  2 asgn  │   │
│  │ (5 act.) │ │          │ │          │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ┌─ Workforce Overview ───┐  ┌─ Quick Actions ────────┐  │
│  │ Active Teams: 5        │  │ [Manage Teams]          │  │
│  │ Inactive Teams: 1      │  │ [Manage Workers]        │  │
│  │ Total Workers: 52      │  │ [Manage Holidays]       │  │
│  │ Unassigned: 3          │  │ [Review Logs]           │  │
│  └────────────────────────┘  └─────────────────────────┘  │
│                                                          │
│  ┌─ System Readiness ─────┐  ┌─ Configuration ────────┐  │
│  │ Team Activation: 83%   │  │ Company Settings       │  │
│  │ Worker Allocation: 94% │  │ [Go to Settings →]     │  │
│  └────────────────────────┘  └─────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Admin Setup Flow (First-Time System Configuration)

This is the typical flow when an Admin sets up AEGIRA for their company:

```
Step 1: SIGNUP
    Admin creates account (company + personal info)
    │
    ▼
Step 2: COMPANY SETTINGS
    Configure timezone, business details, address
    │
    ▼
Step 3: CREATE TEAMS
    For each team: name, description, check-in schedule
    │
    ▼
Step 4: CREATE WORKERS
    For each worker: name, email, password, role, team assignment
    │
    ▼
Step 5: ASSIGN TEAM LEADS
    Set team leader for each team (must have TEAM_LEAD role)
    │
    ▼
Step 6: ASSIGN SUPERVISORS (optional)
    Set supervisor for teams that need oversight
    │
    ▼
Step 7: ADD HOLIDAYS
    Configure company holidays (one-time or recurring yearly)
    │
    ▼
Step 8: SYSTEM IS READY
    Workers can now check in on their next scheduled work day
```

### 7.3 Admin Feature Details

#### Team Management

```
Admin → "Manage Teams"
    │
    ├── View all teams (active + inactive)
    ├── Create team:
    │   ├── Name, Description
    │   ├── Team Leader (required, must be TEAM_LEAD role)
    │   ├── Supervisor (optional, must be SUPERVISOR role)
    │   ├── Check-in window: Start time → End time
    │   └── Work days: checkboxes Mon-Sun
    ├── Edit team: change any field
    └── Deactivate team:
        ├── Workers become unassigned
        ├── Orphaned workers receive notification
        └── Outgoing transfers cancelled
```

#### Worker Management

```
Admin → "Manage Workers"
    │
    ├── View all workers (searchable, filterable)
    ├── Create worker:
    │   ├── Name, Email, Password
    │   ├── Role: WORKER / TEAM_LEAD / SUPERVISOR / WHS / ADMIN
    │   ├── Team assignment (for WORKER role)
    │   ├── Personal info: gender, DOB, contact
    │   └── Emergency contact details
    ├── Edit worker:
    │   ├── Change role
    │   ├── Change team (triggers transfer, effective tomorrow)
    │   ├── Set personal schedule override
    │   └── Update personal details
    ├── Cancel pending transfer
    └── Deactivate worker
```

#### Holiday Management

```
Admin → "Manage Holidays"
    │
    ├── View holidays (current year, searchable)
    ├── Add holiday:
    │   ├── Name: "Christmas Day"
    │   ├── Date: 2026-12-25
    │   └── Recurring: Yes (annually) / No (one-time)
    ├── Edit holiday
    └── Delete holiday

Effect: On holiday dates:
    • Workers cannot submit check-ins
    • Missed check-in detector skips the day
    • Dashboard shows "Holiday: [name]"
    • Completion rate excludes holidays
```

#### Audit Logs

```
Admin → "Review Logs"
    │
    ▼
Shows all system actions:
    • Login attempts (success/failure)
    • User CRUD operations
    • Team modifications
    • Role changes
    • Company setting updates
    • Incident reviews

Each log entry includes:
    • Timestamp
    • User who performed action
    • Action type
    • Affected entity
    • Change details (before/after)
```

---

## 8. Cross-Role Features

### 8.1 Notifications (All Roles)

```
┌─────────────────────────────────────────────────────────────┐
│  NOTIFICATIONS PAGE                                         │
│                                                             │
│  Tabs: [All (24)] [Unread (3)] [Read (21)]                  │
│                                                [Mark All]   │
│                                                             │
│  ── Today ──                                                │
│  🔔 Check-in reminder - Window opens at 06:00    2h ago     │
│  🔔 Team transfer - Moving to Bravo Team on Feb 22  1h ago  │
│                                                             │
│  ── Yesterday ──                                            │
│  ✅ Incident #I-005 approved - Case created      Yesterday   │
│                                                             │
│  ── This Week ──                                            │
│  ❌ Incident #I-003 rejected - Duplicate report  3 days ago  │
│  🔔 Holiday: EDSA Revolution Anniversary         4 days ago  │
│                                                             │
│  [Load more (19 remaining)]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Who gets notified for what:**

| Event | Notified Role(s) |
|-------|-----------------|
| Check-in reminder | WORKER |
| Missed check-in detected | TEAM_LEAD |
| Incident submitted | WHS |
| Incident approved | Reporter (WORKER) |
| Incident rejected | Reporter (WORKER) |
| Team transfer initiated | WORKER |
| Team transfer completed | WORKER |
| Team deactivated | Affected WORKERS |
| Worker assigned to team | WORKER (with schedule info) |
| Worker deactivated | TEAM_LEAD |

### 8.2 Profile Settings (All Roles)

```
All users can:
├── View & edit profile (name, contact, emergency contact)
├── Upload/change avatar (JPEG/PNG/WebP, max 5MB)
├── Change password (rotates JWT)
└── View company info (read-only)
```

### 8.3 Incident Reporting (All Roles)

Any authenticated user can report an incident — not just workers. This means team leads, supervisors, and even admins can file safety reports.

---

## 9. Automated System Processes

These run in the background without any user interaction.

### 9.1 Missed Check-In Detector (Every 15 Minutes)

```
┌─────────────────────────────────────────────────────────────┐
│  CRON: Every 15 minutes                                     │
│                                                             │
│  For each active company:                                    │
│  │                                                          │
│  ├── Get current time in company timezone                    │
│  ├── Is today a holiday? → SKIP company                      │
│  │                                                          │
│  ├── For each active worker on active team:                  │
│  │   ├── Assigned before today? (no → skip)                  │
│  │   ├── Today is work day? (no → skip)                      │
│  │   ├── Window + 2min buffer closed? (no → skip)            │
│  │   ├── Already checked in today? (yes → skip)              │
│  │   │                                                      │
│  │   └── CREATE MissedCheckIn record:                        │
│  │       ├── Capture state snapshot:                         │
│  │       │   • Team lead name at time of miss                │
│  │       │   • Check-in streak before miss                   │
│  │       │   • Recent readiness average                      │
│  │       │   • Miss frequency (30d/60d/90d)                  │
│  │       │   • Days since last check-in                      │
│  │       ├── Emit MISSED_CHECK_IN_DETECTED event             │
│  │       └── Notify team lead                                │
│  │                                                          │
│  └── Idempotent: won't duplicate if already recorded         │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Team Transfer Processor (Every 15 Minutes)

```
┌─────────────────────────────────────────────────────────────┐
│  CRON: Every 15 minutes                                     │
│                                                             │
│  Find workers with transfer_date = today (company timezone)  │
│  │                                                          │
│  For each pending transfer:                                  │
│  ├── Move worker to new team (update team_id)                │
│  ├── Clear transfer fields                                   │
│  ├── Emit TEAM_TRANSFER_COMPLETED event                      │
│  └── Notify worker of completion                             │
│                                                             │
│  Why 1-day delay?                                            │
│  → Prevents check-in validation conflicts on same day        │
│  → Worker checks in with OLD team today, NEW team tomorrow   │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Weekly Cleanup (Sunday 2:00 AM)

```
┌─────────────────────────────────────────────────────────────┐
│  CRON: Sunday 2:00 AM                                       │
│                                                             │
│  Tasks:                                                      │
│  ├── Evict expired holiday cache entries                     │
│  ├── Clear old rate-limit entries                            │
│  └── Archive old audit logs (if configured)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Complete Feature Matrix

### By Module

| Module | Features | Roles |
|--------|----------|-------|
| **Auth** | Signup (company+admin), Login, Logout, Password change, Token refresh | All |
| **Check-In** | Submit check-in, View today, Check status, View history | WORKER, TEAM_LEAD |
| **Dashboard** | Worker dashboard, Team Lead dashboard, Supervisor dashboard, Admin dashboard, WHS dashboard, Trends | Per role |
| **Team** | List teams, Create/Edit team, View members, Missed check-ins, Analytics, Check-in history | ADMIN, SUPERVISOR, TEAM_LEAD |
| **Person** | List persons, Create/Edit person, Profile management, Avatar upload, Team transfer | ADMIN, Self |
| **Incident** | Report incident, My incidents, List all, Approve/Reject, Timeline | All (report), WHS (manage) |
| **Case** | List cases, View detail, Update status/assignment/notes | WHS |
| **Notification** | List, Mark read, Mark all read, Unread count | All |
| **Admin** | Company settings, Holidays CRUD, Audit logs, User role management | ADMIN |

### By User Action

| What User Wants To Do | Where To Go | Role Required |
|----------------------|-------------|---------------|
| Submit daily check-in | `/check-in` | WORKER, TEAM_LEAD |
| See my readiness history | `/check-in/history` | WORKER |
| See my team's status | `/team-dashboard` | TEAM_LEAD |
| See who missed check-in | `/team/missed-check-ins` | TEAM_LEAD, SUPERVISOR |
| Report a safety incident | `/report-incident` | Any |
| Review pending incidents | `/whs/incidents` | WHS |
| Manage safety cases | `/whs/cases` | WHS |
| Create a new team | `/admin/teams/create` | ADMIN |
| Add a new worker | `/admin/workers/create` | ADMIN |
| Set company holidays | `/admin/holidays` | ADMIN |
| Change my password | `/settings` | Any |
| View audit trail | `/admin/audit-logs` | ADMIN |
| See company-wide trends | `/dashboard` (supervisor) | SUPERVISOR, ADMIN |
| Transfer worker to team | `/admin/workers/:id/edit` | ADMIN |

---

## 11. Data Flow Diagram

### Complete System Data Flow

```
                        ┌──────────────────────────────┐
                        │         DATABASE              │
                        │  ┌────────────────────────┐   │
                        │  │ Company (tenant root)   │   │
                        │  │   └→ Person (all roles) │   │
                        │  │   └→ Team               │   │
                        │  │   └→ Holiday            │   │
                        │  │   └→ Event (audit trail)│   │
                        │  │   └→ Notification       │   │
                        │  └────────────────────────┘   │
                        └──────────────┬───────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
              ┌─────▼─────┐    ┌──────▼──────┐    ┌─────▼──────┐
              │  CHECK-IN  │    │  INCIDENT   │    │    TEAM    │
              │  SYSTEM    │    │  SYSTEM     │    │   SYSTEM   │
              │            │    │             │    │            │
              │ CheckIn    │    │ Incident    │    │ Team       │
              │ MissedCI   │    │ Case        │    │ Person     │
              │ Amendment  │    │             │    │ Transfer   │
              └─────┬──────┘    └──────┬──────┘    └─────┬──────┘
                    │                  │                  │
           ┌────────┼──────────────────┼──────────────────┼────────┐
           │        ▼                  ▼                  ▼        │
           │   ┌─────────┐      ┌──────────┐      ┌──────────┐   │
           │   │ Readiness│      │ Incident │      │  Team    │   │
           │   │ Score    │      │ Review   │      │ Mgmt     │   │
           │   │ GREEN/   │      │ Approve/ │      │ Create/  │   │
           │   │ YELLOW/  │      │ Reject   │      │ Edit/    │   │
           │   │ RED      │      │ → Case   │      │ Transfer │   │
           │   └────┬─────┘      └────┬─────┘      └────┬─────┘   │
           │        │                 │                  │         │
           │        ▼                 ▼                  ▼         │
           │   ┌──────────────────────────────────────────────┐   │
           │   │              EVENT SOURCING                  │   │
           │   │  Every state change → Event record           │   │
           │   │  Includes: event_time, timezone, late flag   │   │
           │   │  Used for: audit, analytics, timeline        │   │
           │   └──────────────────────────────────────────────┘   │
           │                                                      │
           │   ┌──────────────────────────────────────────────┐   │
           │   │              NOTIFICATIONS                   │   │
           │   │  Fire-and-forget (never blocks main ops)     │   │
           │   │  In-app only (no email/SMS yet)              │   │
           │   └──────────────────────────────────────────────┘   │
           │                                                      │
           │   ┌──────────────────────────────────────────────┐   │
           │   │              CRON JOBS                        │   │
           │   │  • Missed check-in detector (every 15min)    │   │
           │   │  • Transfer processor (every 15min)          │   │
           │   │  • Weekly cleanup (Sunday 2AM)                │   │
           │   └──────────────────────────────────────────────┘   │
           └──────────────────────────────────────────────────────┘
```

### Multi-Tenant Isolation

```
Company A (Asia/Manila)          Company B (America/New_York)
├── Person A1 (ADMIN)            ├── Person B1 (ADMIN)
├── Person A2 (WORKER)           ├── Person B2 (WORKER)
├── Team A-Alpha                 ├── Team B-Alpha
├── Holiday: EDSA Rev.           ├── Holiday: Independence Day
├── Events: [...]                ├── Events: [...]
└── COMPLETE ISOLATION           └── COMPLETE ISOLATION
    (no data leaks between
     companies ever)
```

Every single database query includes `company_id` filter — enforced by `BaseRepository`.

---

## 12. What Makes AEGIRA Valuable

### For Workers
- **Simple daily routine**: 1-minute check-in captures wellness status
- **Self-awareness**: See your own readiness trends over time
- **Late submissions allowed**: Missed the window? Still submit, it's just flagged
- **Incident reporting**: Direct channel to safety officers
- **Transparency**: Know when your incident is reviewed

### For Team Leads
- **Real-time visibility**: See who checked in, who hasn't, and who's struggling
- **Priority sorting**: Missed → Pending → Submitted (focus on problems first)
- **Historical context**: When someone misses, see their streak, frequency, and trends
- **Early warning**: RED readiness scores flag workers who need support

### For Supervisors
- **Multi-team oversight**: Single view of all assigned teams
- **Compliance tracking**: Team-by-team check-in completion rates
- **Trend analysis**: 30-day readiness trends spot declining teams
- **Data-driven decisions**: Objective metrics instead of gut feeling

### For WHS Officers
- **Incident pipeline**: PENDING → APPROVED → CASE → INVESTIGATED → RESOLVED
- **Full case management**: Assign, investigate, resolve, close
- **Analytics**: Incident distribution by type and severity
- **Worker visibility**: See all workers, their readiness, and risk patterns

### For Admins
- **Complete control**: Manage teams, workers, holidays, and company settings
- **Audit trail**: Every action logged with who, what, when
- **System health**: See team activation rates, worker allocation rates
- **Multi-tenant**: Isolated data per company, timezone-aware operations

### System-Wide Design Strengths

| Strength | Implementation |
|----------|---------------|
| **Timezone-aware** | All business logic uses company timezone (Luxon), not UTC |
| **Event-sourced** | Every state change recorded for complete audit trail |
| **Schedule-aware** | Metrics adjust for holidays, weekends, new assignments |
| **Idempotent** | Cron jobs safe to re-run, no duplicate data |
| **Fire-and-forget** | Notifications/audits never block critical operations |
| **Multi-tenant isolated** | Zero chance of cross-company data leakage |
| **Late-tolerant** | Late check-ins accepted and auto-resolve missed records |
| **Immutable snapshots** | Missed check-in state captured at detection time |

---

## 13. Benefits for Australian Companies

### 13.1 Australian WHS Regulatory Compliance

Australia has one of the most comprehensive workplace health and safety frameworks in the world. AEGIRA directly addresses multiple legal obligations under federal and state WHS laws.

#### Work Health and Safety Act 2011 — PCBU Duties

Under the WHS Act 2011, every **Person Conducting a Business or Undertaking (PCBU)** must ensure, so far as is reasonably practicable, the health and safety of workers. This includes:

| PCBU Obligation | How AEGIRA Addresses It |
|----------------|------------------------|
| **Monitor the health of workers** (s.19) | Daily readiness check-ins capture sleep, stress, physical condition, and pain — creating a continuous health monitoring record |
| **Monitor conditions at the workplace** (s.19) | Incident reporting module with type/severity classification provides systematic hazard identification |
| **Consult with workers on WHS matters** (s.47) | Workers actively participate by self-reporting their readiness daily — two-way safety dialogue |
| **Provide information and training** (s.19) | Readiness recommendations displayed after each check-in guide workers on self-care |
| **Maintain records** (s.274) | Event-sourced architecture creates immutable audit trail of every check-in, incident, and safety action |
| **Report notifiable incidents** (s.38) | Structured incident reporting with mandatory type, severity, and description fields — ready for regulator submission |

#### Incident Notification Requirements

Australian law requires **immediate notification** to the WHS regulator for serious incidents (death, serious injury, dangerous occurrences). Penalties for non-compliance:

| Penalty | Amount |
|---------|--------|
| Individual failing to notify | **$10,000** |
| Body corporate failing to notify | **$50,000** |
| Industrial manslaughter (individual) | **Up to 20 years imprisonment** |
| Industrial manslaughter (body corporate) | **Up to $10 million** |

**AEGIRA's incident module** provides:
- Structured incident capture at the moment of occurrence (type, severity, location, description)
- Sequential incident numbering for tracking and regulatory reference
- Full timeline and event history for each incident
- Case management for investigation documentation
- Exportable records ready for regulator submission

#### New Psychosocial Hazard Regulations (December 2025)

As of **1 December 2025**, every Australian state now requires employers to **explicitly identify, assess, and control psychosocial hazards**. Victoria's Occupational Health and Safety (Psychological Health) Regulations 2025 require:

- Identifying psychosocial hazards and eliminating or reducing risks
- Reviewing controls when incidents, complaints, or changes occur
- Applying hierarchy of controls (not just training)

| Psychosocial Requirement | AEGIRA Coverage |
|-------------------------|----------------|
| **Identify psychosocial hazards** | Daily stress level tracking (1-10 scale) + mental health incident type |
| **Monitor worker mental health** | Readiness score trends show declining patterns before crisis |
| **Record and review** | 30/60/90-day trend analytics with team-level aggregation |
| **Act on triggers** | RED readiness alerts flag workers needing immediate support |
| **Report incidents** | Mental Health incident type with severity classification |

**Why this matters**: 17% of workplace injury claims in Victoria are now mental injuries, and only 42% of workers with mental injuries return within 6 months (vs 75% for physical injuries). Early detection through daily check-ins can prevent escalation.

#### Fatigue Management Code of Practice (2025)

Safe Work Australia's updated **Code of Practice on Managing Fatigue Risks at Work** (September 2025) introduces a risk-based approach for high-risk sectors. AEGIRA directly supports this:

| Fatigue Risk Factor | AEGIRA Data Point |
|--------------------|------------------|
| **Sleep hours** | Hours slept (captured daily) |
| **Sleep quality** | Sleep quality rating (1-10) |
| **Physical condition** | Physical condition rating (1-10) |
| **Cumulative fatigue** | 7-day rolling readiness average |
| **Pattern detection** | Streak tracking + missed check-in frequency (30d/60d/90d) |
| **Early intervention** | RED/YELLOW readiness triggers before incidents occur |

### 13.2 Financial Benefits

#### The Cost of NOT Monitoring Worker Readiness

Safe Work Australia data shows the devastating financial impact of workplace injuries:

| Statistic | Number |
|-----------|--------|
| **Annual economic cost** | **$28.6 billion** per year lost to work injuries/illness |
| **Serious claims (2022-23)** | 55,400 claims involving >13 weeks time lost |
| **Cost of serious claims** | **$5.4 billion** (74.8% of total compensation) |
| **Mental health claim cost** | **$67,400** median (4x higher than other claims) |
| **Mental health claim growth** | **+161.1%** increase over 10 years |
| **Fatalities (10 years)** | **1,880+** traumatic injury deaths |
| **Potential jobs created** | **185,500** additional FTE if injuries eliminated |

#### AEGIRA's Financial Impact

```
COST OF ONE SERIOUS WORKPLACE INJURY:
  Workers compensation claim:           $16,300 (median)
  Mental health injury claim:           $67,400 (median, 4x higher)
  Lost productivity (13+ weeks):        $25,000 - $50,000+
  Regulator investigation:              $10,000 - $100,000+
  Legal/insurance costs:                $5,000 - $50,000+
  Replacement worker training:          $5,000 - $15,000
  ──────────────────────────────────────────────────────
  TOTAL PER SERIOUS INCIDENT:          $60,000 - $280,000+

AEGIRA COST:
  SaaS subscription:                    Fraction of one incident

ROI SCENARIO:
  Company with 100 workers
  Industry average: 5.2 serious claims per 100 workers/year
  If AEGIRA prevents just 1 serious claim:
  → Minimum $60,000 saved
  → Plus: reduced insurance premiums, no productivity loss,
    no regulatory scrutiny, no reputation damage
```

#### Insurance Premium Benefits

Australian workers compensation insurers increasingly offer premium discounts for companies demonstrating proactive safety management. AEGIRA provides:

- **Documented daily monitoring** — evidence of active duty of care
- **Trend data** — proves systematic hazard identification
- **Incident investigation records** — shows proper response procedures
- **Compliance audit trail** — reduces insurer risk assessment

### 13.3 Industry-Specific Benefits

#### Mining & Resources (FIFO)

| Challenge | AEGIRA Solution |
|-----------|----------------|
| Fly-In Fly-Out fatigue | Daily sleep + readiness monitoring across rosters |
| Remote site isolation | Digital self-assessment replaces paper-based systems |
| Pre-start fitness for duty | Check-in window enforces pre-shift assessment |
| Regulatory scrutiny | Complete digital audit trail for mine safety auditors |
| Mental health crisis (40% higher depression in construction/mining) | Daily stress tracking + trend analytics catches declining workers |

#### Construction

| Challenge | AEGIRA Solution |
|-----------|----------------|
| High-risk physical work | Pain tracking + physical condition monitoring |
| Subcontractor management | Multi-tenant isolation — each contractor manages their own teams |
| Site-specific hazards | Incident reporting with location field |
| Compliance documentation | Exportable records for SafeWork audits |
| Worker rotation between sites | Team transfer system with 1-day buffer |

#### Manufacturing & Warehousing

| Challenge | AEGIRA Solution |
|-----------|----------------|
| Shift-based operations | Configurable check-in windows per team |
| Repetitive strain injuries | Daily physical condition + pain tracking catches early signs |
| Equipment operation fitness | Pre-shift readiness score determines duty level |
| Multiple team leads | Role-based dashboards — each lead sees only their team |
| Compliance reporting | Automated completion rates + missed check-in tracking |

#### Healthcare & Aged Care

| Challenge | AEGIRA Solution |
|-----------|----------------|
| Staff burnout | Stress level trending over 30/60/90 days |
| Patient safety depends on staff wellness | GREEN/YELLOW/RED readiness levels for duty assignment |
| Mandatory incident reporting | Structured incident types including illness/sickness |
| High staff turnover | Trend data helps identify teams with systemic issues |
| Psychosocial hazards | Compliant with new Dec 2025 psychosocial regulations |

#### Transport & Logistics

| Challenge | AEGIRA Solution |
|-----------|----------------|
| Driver fatigue (Chain of Responsibility) | Sleep hours + sleep quality as primary inputs |
| Distributed workforce | Mobile-responsive web app — check in from anywhere |
| Compliance with fatigue management plans | Digital records replace manual logbooks |
| Multiple depots | Multi-team structure with per-team schedules |

#### Agriculture & Farming

| Challenge | AEGIRA Solution |
|-----------|----------------|
| Seasonal worker management | Flexible team assignment with holiday management |
| Remote locations | Works on any device with internet access |
| Harsh working conditions | Physical condition + pain monitoring |
| Limited HR resources | Admin dashboard provides full workforce overview |

### 13.4 Competitive Advantages for Australian Market

#### vs Paper-Based Systems

| Paper/Spreadsheet | AEGIRA |
|-------------------|--------|
| Lost or damaged records | Permanent digital storage |
| Manual tallying | Automatic readiness calculation |
| No real-time visibility | Live dashboards per role |
| No trend analysis | 30/60/90-day automated analytics |
| Compliance risk (missing records) | Complete audit trail |
| No alerts for missed check-ins | Automated detection every 15 minutes |

#### vs Generic HR Platforms

| Generic HR Platform | AEGIRA |
|--------------------|--------|
| Not purpose-built for readiness | Readiness-first design |
| No readiness scoring algorithm | Weighted formula (sleep/stress/physical/pain) |
| No missed check-in detection | Automated cron job with state snapshots |
| No incident → case pipeline | Full workflow: report → review → investigate → resolve |
| No WHS officer role | Dedicated WHS dashboard + case management |
| Complex, expensive | Purpose-built, focused, affordable |

#### Australian Timezone Support

AEGIRA is built **timezone-first** — critical for Australian companies:

```
Supported scenarios:
├── AEST (UTC+10): Sydney, Melbourne, Brisbane
├── ACST (UTC+9:30): Adelaide, Darwin
├── AWST (UTC+8): Perth, mining sites
├── AEDT (UTC+11): Daylight saving states
└── Mixed timezone companies (e.g., HQ in Sydney + mine site in Perth)

Each company sets its own timezone.
All check-in windows, holiday dates, and business logic
operate in the company's configured timezone.
```

---

## 14. Target Market

### 14.1 Primary Target

```
┌─────────────────────────────────────────────────────────────┐
│  PRIMARY TARGET: Australian SMEs & Mid-Market Companies     │
│                                                             │
│  Industry:   High-risk industries with physical workers     │
│  Size:       20 - 500 workers                               │
│  Pain Point: WHS compliance burden + worker safety gaps     │
│  Budget:     Can't afford enterprise solutions ($100K+)     │
│  Current:    Paper forms, spreadsheets, or nothing          │
│                                                             │
│  Key Decision Makers:                                       │
│  • Business Owner / CEO (ADMIN role in AEGIRA)              │
│  • WHS Manager / Safety Officer (WHS role)                  │
│  • Operations Manager (SUPERVISOR role)                     │
└─────────────────────────────────────────────────────────────┘
```

### 14.2 Target Industries (Priority Order)

| Priority | Industry | Why | Company Size Target |
|----------|----------|-----|-------------------|
| **1** | **Mining & Resources** | Highest regulatory scrutiny, FIFO fatigue management, highest willingness to pay | 50-500 workers |
| **2** | **Construction** | Highest injury rates, mandatory WHS compliance, subcontractor complexity | 20-200 workers |
| **3** | **Manufacturing** | Shift-based operations, machinery safety, repetitive strain monitoring | 30-300 workers |
| **4** | **Transport & Logistics** | Chain of Responsibility fatigue laws, driver fitness critical | 20-150 workers |
| **5** | **Healthcare & Aged Care** | Staff burnout epidemic, patient safety depends on staff wellness | 30-200 workers |
| **6** | **Agriculture** | Remote workforce, seasonal workers, limited HR capability | 10-100 workers |
| **7** | **Warehousing & Distribution** | Physical demands, forklift/machinery operation, shift work | 20-150 workers |

### 14.3 Ideal Customer Profile (ICP)

```
┌─────────────────────────────────────────────────────────────┐
│                 IDEAL CUSTOMER PROFILE                       │
│                                                             │
│  COMPANY CHARACTERISTICS:                                   │
│  ├── 50-200 workers (sweet spot)                            │
│  ├── Physical/field workers (not desk workers)              │
│  ├── Operating in high-risk industry                        │
│  ├── Multiple teams or crews                                │
│  ├── Already has WHS officer or safety manager              │
│  ├── Has experienced workplace injuries in past 2 years     │
│  └── Located in Australia (any state)                       │
│                                                             │
│  PAIN POINTS THEY EXPERIENCE:                               │
│  ├── "We don't know if our workers are fit for duty today"  │
│  ├── "We only find out about problems after an incident"    │
│  ├── "Our paper-based system doesn't meet audit standards"  │
│  ├── "Workers comp premiums keep increasing"                │
│  ├── "We can't prove due diligence to regulators"           │
│  └── "Mental health issues are rising but invisible"        │
│                                                             │
│  BUYING TRIGGERS:                                           │
│  ├── Recent workplace incident or near-miss                 │
│  ├── SafeWork audit or improvement notice received          │
│  ├── Insurance premium increase                             │
│  ├── New psychosocial hazard regulations (Dec 2025)         │
│  ├── FIFO/remote site expansion                             │
│  └── Growth requiring systemised safety processes           │
└─────────────────────────────────────────────────────────────┘
```

### 14.4 Customer Segments

#### Segment A: "Compliance-Driven" (Largest Segment)

```
Profile: Companies that MUST comply with WHS regulations
Motivation: Avoid penalties, pass audits, reduce insurance costs
Value prop: "AEGIRA makes WHS compliance automatic"

Examples:
• Mining company with SafeWork improvement notice
• Construction firm preparing for audit
• Transport company under Chain of Responsibility obligations
```

#### Segment B: "Safety-First Culture"

```
Profile: Companies that genuinely care about worker welfare
Motivation: Prevent injuries, improve worker wellbeing, retain staff
Value prop: "AEGIRA catches problems before they become incidents"

Examples:
• Family-owned manufacturing company
• Healthcare provider concerned about staff burnout
• Agricultural company in remote area
```

#### Segment C: "Data-Driven Operations"

```
Profile: Companies wanting operational intelligence
Motivation: Optimise workforce deployment, reduce downtime
Value prop: "AEGIRA gives you daily workforce readiness data"

Examples:
• Mining operation optimising crew assignments
• Logistics company managing driver schedules
• Large construction site with multiple subcontractors
```

### 14.5 Target Geography

```
PHASE 1: Australia (Launch Market)
├── New South Wales (largest workforce, SafeWork NSW active enforcement)
├── Queensland (mining + construction hub)
├── Victoria (new psychosocial regulations Dec 2025)
├── Western Australia (mining + FIFO capital)
└── South Australia, Tasmania, NT, ACT

WHY AUSTRALIA FIRST:
├── Strongest WHS regulatory framework globally
├── High compliance costs create willingness to pay
├── English-speaking market (no localisation needed)
├── Tech-savvy workforce with smartphone penetration
├── Insurance incentives for digital safety tools
└── Government grants available for WHS technology adoption

PHASE 2: New Zealand (Similar WHS framework)
PHASE 3: Southeast Asia (Growing regulatory environment)
```

### 14.6 Value Proposition by Stakeholder

| Stakeholder | What They Care About | AEGIRA Pitch |
|-------------|---------------------|-------------|
| **CEO / Owner** | Cost, compliance, liability | "Reduce injury costs by up to $280K per incident. Prove due diligence to regulators with automated records." |
| **WHS Manager** | Incident management, audits | "Digitise your entire incident pipeline. Every check-in, incident, and case investigation — documented and audit-ready." |
| **Operations Manager** | Workforce availability, productivity | "Know which workers are GREEN (ready), YELLOW (modified duty), or RED (needs support) — before they start their shift." |
| **HR Manager** | Retention, wellbeing, compliance | "Track workforce wellness trends. Identify burnout patterns. Meet psychosocial hazard obligations." |
| **Insurance Broker** | Risk profile, claims history | "Daily wellness monitoring + incident tracking = lower risk profile = potential premium reduction." |
| **Workers** | Simple, non-invasive, helpful | "1-minute daily check-in. See your own readiness trends. Report safety concerns directly to management." |

### 14.7 Market Size Indicators

```
AUSTRALIA WORKFORCE STATISTICS:
├── Total employed persons: ~14.2 million
├── Workers in target industries:
│   ├── Construction: ~1.3 million
│   ├── Mining: ~280,000
│   ├── Manufacturing: ~860,000
│   ├── Transport & Logistics: ~680,000
│   ├── Healthcare: ~2.0 million
│   └── Agriculture: ~320,000
├── Target segment (physical workers in 20-500 company): ~2-3 million
└── Addressable market at $5-15/worker/month: $120M - $540M ARR

COMPETITIVE LANDSCAPE:
├── Paper/spreadsheet-based: ~60% of SMEs (our primary displacement target)
├── Generic HR platforms: ~25% (not purpose-built for readiness)
├── Enterprise WHS software: ~10% (too expensive for SMEs)
└── Direct competitors (readiness-focused): <5% (blue ocean)
```

---

## 15. Summary: Why AEGIRA Exists

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  AEGIRA answers the question every Australian employer      │
│  with physical workers MUST answer every single day:        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │   "Are my workers fit for duty today?"              │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Without AEGIRA:                                            │
│  • You don't know until someone gets hurt                   │
│  • Paper records get lost                                   │
│  • Trends are invisible                                     │
│  • Regulators find gaps in your records                     │
│  • Insurance premiums keep rising                           │
│  • Mental health issues go unnoticed                        │
│                                                             │
│  With AEGIRA:                                               │
│  • Every worker's readiness is scored daily                  │
│  • GREEN/YELLOW/RED tells you who needs support             │
│  • Missed check-ins are auto-detected in 15 minutes        │
│  • Incidents flow through a proper investigation pipeline   │
│  • Every action is event-sourced and audit-ready            │
│  • Trends reveal problems BEFORE they become injuries       │
│  • Your duty of care is documented, timestamped, and proven │
│                                                             │
│  AEGIRA: Workforce Readiness. Compliance. Peace of Mind.    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

*Generated: 2026-02-21 | AEGIRA V5 System Flow Documentation*

**Sources:**
- [Work Health and Safety Act 2011](https://www.legislation.gov.au/Details/C2018C00293)
- [SafeWork Australia Operational Plan 2025-2026](https://www.safeworkaustralia.gov.au/doc/safe-work-australia-operational-plan-2025-2026)
- [SafeWork Australia Key WHS Statistics 2025](https://data.safeworkaustralia.gov.au/insights/key-whs-statistics-australia/latest-release)
- [Victoria Psychosocial Health Regulations 2025](https://www.worksafe.vic.gov.au/news/2025-12/new-regulations-make-psychological-health-priority)
- [Managing Fatigue Code of Practice September 2025](https://www.safeworkaustralia.gov.au/sites/default/files/2025-09/modelcop_fatigue_sept2025.pdf)
- [WHS Incident Reporting Obligations](https://citationgroup.com.au/resources/4-things-employers-must-know-about-whs-incident-reporting-obligations/)
- [WHS Penalties for Breaches](https://www.business.qld.gov.au/running-business/whs/whs-laws/penalties)
- [Workplace Injuries Cost $315B Over 10 Years](https://clarityws.com.au/workplace-injuries-cost-australian-economy-315-billion-over-10-years/)
- [Work Health and Safety Requirements 2026](https://www.safetyforlife.com.au/work-health-and-safety-requirements-2026/)
