# WHS Feature Audit

## Document Information

| Field | Value |
|-------|-------|
| **Project** | AEGIRA V5 — Workforce Readiness & WHS Management |
| **Document** | Inventory of WHS incident/case features, current state, and gap analysis |
| **Version** | 2.0 |
| **Date** | 2026-02-04 |
| **Audience** | Developers, Product Owners, WHS Officers |

---

## Table of Contents

1. [WHS Officer Role Definition](#1-whs-officer-role-definition)
2. [Incident Report Data](#2-incident-report-data)
3. [Case Management Data](#3-case-management-data)
4. [Current WHS Officer Experience](#4-current-whs-officer-experience)
5. [Backend Endpoints Available to WHS](#5-backend-endpoints-available-to-whs)
6. [Frontend Pages & Components](#6-frontend-pages--components)
7. [Gap Analysis](#7-gap-analysis)

---

## 1. WHS Officer Role Definition

The **WHS** role in AEGIRA is focused on one thing: **monitoring and processing incident reports submitted by workers**.

| Responsibility | Description |
|---------------|-------------|
| Review incidents | Receive submitted incident reports, evaluate them |
| Approve incidents | Approve valid incidents → automatically creates a Case |
| Reject incidents | Reject invalid incidents with a reason and explanation |
| Manage cases | Track, assign, investigate, and resolve cases |
| Self-report | Can also submit their own incident reports |

The WHS officer does **not** manage:
- Daily readiness check-ins (that's Team Lead / Supervisor)
- Check-in compliance rates (that's Team Lead / Supervisor)
- Team composition or worker management (that's Admin)
- Pain data from check-ins (that's check-in module, not incident module)

---

## 2. Incident Report Data

### 2.1 Incident Fields

| Field | Type | Values |
|-------|------|--------|
| `incident_number` | Auto-sequential | Per company (e.g., INC-2026-0001) |
| `reporter_id` | FK | Person who submitted |
| `incident_type` | Enum | PHYSICAL_INJURY, ILLNESS_SICKNESS, MENTAL_HEALTH, MEDICAL_EMERGENCY, HEALTH_SAFETY_CONCERN, OTHER |
| `severity` | Enum | LOW, MEDIUM, HIGH, CRITICAL |
| `title` | String | Max 200 chars |
| `description` | String | Max 2000 chars, required |
| `location` | String | Optional, free text |
| `status` | Enum | PENDING, APPROVED, REJECTED |
| `reviewed_by` | FK | WHS officer who reviewed (nullable) |
| `reviewed_at` | Timestamp | When reviewed (nullable) |
| `rejection_reason` | Enum | DUPLICATE_REPORT, INSUFFICIENT_INFORMATION, NOT_WORKPLACE_INCIDENT, OTHER |
| `rejection_explanation` | String | Max 500 chars (required on rejection) |

### 2.2 Incident Status Workflow

```
Worker submits → PENDING
                    ├── WHS approves → APPROVED (creates Case automatically)
                    └── WHS rejects  → REJECTED (with reason + explanation)
```

Both APPROVED and REJECTED are terminal states.

### 2.3 Incident Types Explained

| Type | When to Use |
|------|------------|
| PHYSICAL_INJURY | Physical injury at workplace |
| ILLNESS_SICKNESS | Illness or sickness related to work |
| MENTAL_HEALTH | Mental health concern |
| MEDICAL_EMERGENCY | Urgent medical situation |
| HEALTH_SAFETY_CONCERN | General safety hazard or concern |
| OTHER | Does not fit above categories |

### 2.4 Severity Levels

| Severity | Meaning |
|----------|---------|
| LOW | Minor, no immediate action needed |
| MEDIUM | Moderate, needs attention |
| HIGH | Serious, prompt action required |
| CRITICAL | Urgent, immediate action required |

---

## 3. Case Management Data

### 3.1 Case Fields

| Field | Type | Values |
|-------|------|--------|
| `case_number` | Auto-sequential | Per company |
| `incident_id` | FK | Source incident (1:1) |
| `assigned_to` | FK | WHS/ADMIN officer (nullable, auto-assigned to approver) |
| `status` | Enum | OPEN, INVESTIGATING, RESOLVED, CLOSED |
| `notes` | String | Investigation notes |
| `resolved_at` | Timestamp | When resolved (nullable) |

### 3.2 Case Status Workflow

```
Incident approved → OPEN
                      ├── INVESTIGATING
                      │     ├── RESOLVED → CLOSED
                      │     └── CLOSED
                      ├── RESOLVED → CLOSED
                      └── CLOSED
```

CLOSED is the terminal state.

### 3.3 Case Actions (WHS Only)

| Action | Details |
|--------|---------|
| Change status | Must follow valid transitions above |
| Assign officer | Must be active WHS or ADMIN role |
| Add notes | Investigation notes, free text |
| Resolve | Sets `resolved_at` timestamp |

---

## 4. Current WHS Officer Experience

### 4.1 What WHS Officers See When They Log In

| Item | Current State |
|------|--------------|
| **Dashboard** | Falls through to WorkerDashboard — **wrong dashboard, no WHS-specific view** |
| **Sidebar nav** | Dashboard, Incidents (ShieldAlert icon), Cases (FolderOpen icon), Settings |
| **Incidents page** | `/admin/incidents` — full table with status tabs, filters, approve/reject actions |
| **Cases page** | `/admin/cases` — full table with status tabs, search |
| **Incident detail** | `/admin/incidents/:id` — 4-quadrant info layout + timeline + approve/reject buttons |
| **Case detail** | `/admin/cases/:id` — 4-quadrant info layout + WHS management form + timeline |
| **Notifications** | Receives INCIDENT_SUBMITTED notifications |

### 4.2 Dashboard Router (the Problem)

In `features/dashboard/pages/Dashboard.tsx`, the role-based routing currently is:

| Role | Dashboard Component |
|------|-------------------|
| WORKER | WorkerDashboard |
| TEAM_LEAD | TeamLeaderDashboard |
| SUPERVISOR | SupervisorDashboard |
| ADMIN | AdminDashboard |
| **WHS** | **Falls through to WorkerDashboard (incorrect)** |

The WHS role has no dedicated dashboard. A WHS officer logging in sees personal check-in stats — completely irrelevant to their job.

### 4.3 Existing Incident List Features

The `AdminIncidentsPage` already provides:
- Status tabs with counts: ALL | PENDING | APPROVED | REJECTED
- Filters: search (title/reporter), severity dropdown, type dropdown
- Table: Incident #, Title, Reporter, Team, Type, Severity, Status, Reviewed By, Date, Actions
- Inline actions: View, Approve (confirm dialog), Reject (rejection dialog)

### 4.4 Existing Case List Features

The `AdminCasesPage` already provides:
- Status tabs with counts: ALL | OPEN | INVESTIGATING | RESOLVED | CLOSED
- Search filter
- Table: Case #, Incident Title, Reporter, Severity, Status, Assigned To, Created, Actions
- View action (goes to detail page)

---

## 5. Backend Endpoints Available to WHS

### 5.1 Incident Endpoints

| Endpoint | Method | Purpose | Access |
|----------|--------|---------|--------|
| `/api/v1/incidents` | GET | List all incidents (paginated, filterable by status/severity/type) | WHS, ADMIN |
| `/api/v1/incidents/:id` | GET | Incident detail | WHS, ADMIN, or reporter |
| `/api/v1/incidents/:id/timeline` | GET | Event timeline for incident | WHS, ADMIN, or reporter |
| `/api/v1/incidents/:id/approve` | PATCH | Approve → creates Case | **WHS only** |
| `/api/v1/incidents/:id/reject` | PATCH | Reject with reason | **WHS only** |
| `/api/v1/incidents` | POST | Submit new incident | All authenticated |
| `/api/v1/incidents/my` | GET | Own incidents | All authenticated |

### 5.2 Case Endpoints

| Endpoint | Method | Purpose | Access |
|----------|--------|---------|--------|
| `/api/v1/cases` | GET | List all cases (paginated, filterable by status) | WHS, ADMIN |
| `/api/v1/cases/:id` | GET | Case detail | WHS, ADMIN, or reporter |
| `/api/v1/cases/:id` | PATCH | Update status, assign officer, add notes | **WHS only** |

### 5.3 Supporting Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/notifications` | GET | Notification list (includes INCIDENT_SUBMITTED) |
| `/api/v1/notifications/unread` | GET | Unread count |

### 5.4 What's NOT Available (Missing Endpoints)

| Missing Endpoint | Purpose |
|-----------------|---------|
| `GET /api/v1/dashboard/whs` | WHS-specific dashboard stats |
| Cases filtered by `assigned_to=me` | "My Cases" view |
| Incident/case aggregation stats | Counts by type, severity, trends |

---

## 6. Frontend Pages & Components

### 6.1 Incident Feature Files

```
src/features/incident/
├── pages/
│   ├── ReportIncidentPage.tsx        ← Submit form (all users)
│   ├── MyIncidentsPage.tsx           ← Worker's own reports
│   ├── AdminIncidentsPage.tsx        ← WHS/Admin list + approve/reject
│   ├── IncidentDetailPage.tsx        ← Shared detail view
│   ├── AdminCasesPage.tsx            ← WHS/Admin case list
│   └── CaseDetailPage.tsx            ← Case detail + WHS management form
├── components/
│   ├── IncidentStatusBadge.tsx       ← PENDING/APPROVED/REJECTED badge
│   ├── SeverityBadge.tsx             ← LOW/MEDIUM/HIGH/CRITICAL badge
│   ├── CaseStatusBadge.tsx           ← OPEN/INVESTIGATING/RESOLVED/CLOSED badge
│   ├── IncidentTimeline.tsx          ← Event timeline component
│   └── RejectionDialog.tsx           ← Reject modal with reason/explanation
└── hooks/
    ├── useIncidents.ts               ← List incidents (paginated, filterable)
    ├── useMyIncidents.ts             ← Worker's own incidents
    ├── useIncident.ts                ← Single incident detail
    ├── useIncidentTimeline.ts        ← Incident event timeline
    ├── useCreateIncident.ts          ← Submit incident mutation
    ├── useApproveIncident.ts         ← Approve mutation
    ├── useRejectIncident.ts          ← Reject mutation
    ├── useCases.ts                   ← List cases (paginated, filterable)
    ├── useCase.ts                    ← Single case detail
    ├── useUpdateCase.ts              ← Update case mutation
    └── useWhsOfficers.ts            ← List WHS officers (for case assignment)
```

### 6.2 Reusable Components Available

| Component | Location | Useful For |
|-----------|----------|-----------|
| `IncidentStatusBadge` | `features/incident/components/` | Status display |
| `SeverityBadge` | `features/incident/components/` | Severity display |
| `CaseStatusBadge` | `features/incident/components/` | Case status display |
| `StatCard` | `features/dashboard/components/` | Dashboard metric cards |
| `Card` | `components/ui/` | Section containers |
| `Badge` | `components/ui/` | Count badges |
| `PageHeader` | `components/common/` | Page title |
| `PageLoader` | `components/common/` | Loading/error wrapper |
| `EmptyState` | `components/common/` | No data states |

---

## 7. Gap Analysis

### 7.1 Critical Gaps

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| 1 | **No WHS dashboard** — falls through to WorkerDashboard | WHS officer sees irrelevant personal check-in data on login | **Critical** |
| 2 | **No WHS dashboard endpoint** — backend has no `/dashboard/whs` | No aggregated stats available for a dashboard | **Critical** |
| 3 | **No "My Cases" filter** — cannot filter cases assigned to current officer | Hard to track personal workload | **High** |

### 7.2 Medium Gaps

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| 4 | No incident/case count summary on dashboard | Must navigate to list pages to see counts | **Medium** |
| 5 | No quick actions from dashboard | Must navigate to incidents page to start reviewing | **Medium** |
| 6 | No recent activity feed | Cannot see what happened recently at a glance | **Medium** |

### 7.3 What Already Works Well

| Feature | Status |
|---------|--------|
| Incident list with tabs, filters, approve/reject | Complete |
| Case list with tabs and search | Complete |
| Incident detail with timeline and approve/reject buttons | Complete |
| Case detail with WHS management form (status, assign, notes) | Complete |
| Notification system for new incidents | Complete |
| Event sourcing for full audit trail | Complete |
| Rejection workflow with reason and explanation | Complete |

---

**Next:** [WHS Dashboard Design](WHS_DASHBOARD_DESIGN.md)
