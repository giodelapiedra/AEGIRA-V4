# WHS Dashboard Design Specification

## Document Information

| Field | Value |
|-------|-------|
| **Project** | AEGIRA V5 — Workforce Readiness & WHS Management |
| **Document** | WHS incident monitoring dashboard — layout, components, types, and endpoints |
| **Version** | 3.0 |
| **Date** | 2026-02-04 |
| **Audience** | Frontend Developers, UI/UX, Product Owners |
| **Prereq** | [WHS Feature Audit](WHS_FEATURE_AUDIT.md) |

---

## Table of Contents

1. [Dashboard Overview](#1-dashboard-overview)
2. [Dashboard Sections](#2-dashboard-sections)
3. [Layout Specification](#3-layout-specification)
4. [Component Inventory](#4-component-inventory)
5. [TypeScript Interfaces](#5-typescript-interfaces)
6. [New API Endpoint](#6-new-api-endpoint)

---

## 1. Dashboard Overview

### 1.1 Purpose

Give the WHS officer an **at-a-glance summary** of their incident monitoring workload when they log in. The dashboard answers three questions:

1. **What needs my attention right now?** (pending incidents, urgent cases)
2. **What's the current state of my caseload?** (cases by status, my assignments)
3. **What happened recently?** (recent incident activity)

### 1.2 Target Roles

| Role | Access |
|------|--------|
| WHS | Full access |
| ADMIN | Full access |
| Other roles | No access |

### 1.3 Design Principles

- **Incident-focused** — everything on this dashboard relates to incident reports and cases
- **Actionable** — pending counts link directly to the filtered incidents list
- **Lightweight** — reuses existing hooks and components where possible, single backend endpoint
- **Consistent** — follows the same `StatCard` + `Card` pattern as existing dashboards

---

## 2. Dashboard Sections

### Section 1: Summary Stats (Priority: Critical)

A row of `StatCard` components showing key counts at a glance.

| Stat | Icon | Value | Description | Link |
|------|------|-------|-------------|------|
| Pending Incidents | `AlertTriangle` | Count of PENDING incidents | "Awaiting your review" | `/admin/incidents?status=PENDING` |
| My Open Cases | `FolderOpen` | Cases assigned to current user (OPEN + INVESTIGATING) | "Assigned to you" | `/admin/cases?assignedToMe=true` |
| Total Open Cases | `Briefcase` | All OPEN + INVESTIGATING cases | "Across all officers" | `/admin/cases` |
| Resolved This Month | `CheckCircle` | Cases resolved in current month | "This month" | — |

### Section 2: Pending Incidents Table (Priority: Critical)

A compact table of **PENDING incidents** — the WHS officer's primary task queue.

| Column | Source |
|--------|--------|
| Incident # | `formatIncidentNumber()` |
| Title | Incident title |
| Reporter | Reporter name |
| Type | `IncidentStatusBadge` |
| Severity | `SeverityBadge` |
| Submitted | Relative time ("2h ago") |
| Actions | View, Approve, Reject buttons |

**Behavior:**
- Shows up to 5 most recent PENDING incidents
- Sorted by severity (CRITICAL first), then by date (oldest first)
- "View all pending incidents" link at bottom → navigates to `/admin/incidents?status=PENDING`
- If zero pending: show `EmptyState` with "No pending incidents" message

### Section 3: Cases by Status (Priority: High)

A visual breakdown of the case pipeline.

| Status | Display |
|--------|---------|
| OPEN | Count with `CaseStatusBadge` |
| INVESTIGATING | Count with `CaseStatusBadge` |
| RESOLVED | Count with `CaseStatusBadge` |
| CLOSED | Count with `CaseStatusBadge` |

**Visualization:** Four horizontal segments or a simple stat row. Each status count is clickable, linking to the cases page filtered by that status.

### Section 4: Recent Activity (Priority: Medium)

A scrollable list of the last 10 incident/case events.

| Event Type | Example Display |
|-----------|----------------|
| Incident submitted | "John Doe reported PHYSICAL_INJURY (HIGH)" |
| Incident approved | "You approved Incident #45 — Case #12 created" |
| Incident rejected | "You rejected Incident #38 — DUPLICATE_REPORT" |
| Case status changed | "Case #12 moved to INVESTIGATING" |
| Case assigned | "Case #7 assigned to Maria Santos" |

**Source:** Events table filtered for incident/case event types.

---

## 3. Layout Specification

### 3.1 Desktop Layout (>= 1024px)

```
+------------------------------------------------------------------+
| PAGE HEADER: "WHS Dashboard"                                     |
+------------------------------------------------------------------+
| [Pending]  [My Cases]  [Total Open]  [Resolved]                  |
|  StatCard   StatCard     StatCard      StatCard                   |
+------------------------------------------------------------------+
|                                                                   |
| PENDING INCIDENTS TABLE                                           |
| (top 5, sorted by severity then date)                            |
| "View all pending incidents →"                                    |
|                                                                   |
+----------------------------------+-------------------------------+
|                                  |                               |
| CASES BY STATUS                  | RECENT ACTIVITY               |
| OPEN: 3                         | - John reported PHYSICAL...   |
| INVESTIGATING: 5                | - You approved Incident #45   |
| RESOLVED: 2                     | - Case #12 → INVESTIGATING    |
| CLOSED: 12                      | - ...                         |
|                                  |                               |
+----------------------------------+-------------------------------+
```

### 3.2 Tailwind Grid Implementation

```html
<div className="space-y-6">
  <PageHeader title="WHS Dashboard" />

  <!-- Row 1: Stats -->
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard />  <!-- Pending -->
    <StatCard />  <!-- My Cases -->
    <StatCard />  <!-- Total Open -->
    <StatCard />  <!-- Resolved -->
  </div>

  <!-- Row 2: Pending incidents table (full width) -->
  <Card>
    <PendingIncidentsTable />
  </Card>

  <!-- Row 3: Cases + Activity (2 columns) -->
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card><CasesByStatus /></Card>
    <Card><RecentActivity /></Card>
  </div>
</div>
```

### 3.3 Mobile Layout (< 768px)

Sections stack vertically:
1. Stats (2x2 grid)
2. Pending Incidents Table (horizontal scroll)
3. Cases by Status
4. Recent Activity

---

## 4. Component Inventory

### 4.1 New Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| `WhsDashboard` | `features/dashboard/pages/WhsDashboard.tsx` | Page — composes all sections |
| `PendingIncidentsTable` | `features/dashboard/components/whs/PendingIncidentsTable.tsx` | Top 5 pending incidents with actions |
| `CasesByStatus` | `features/dashboard/components/whs/CasesByStatus.tsx` | Case count breakdown by status |
| `RecentActivity` | `features/dashboard/components/whs/RecentActivity.tsx` | Last 10 incident/case events |

### 4.2 Existing Components to Reuse

| Component | From | Usage |
|-----------|------|-------|
| `StatCard` | `features/dashboard/components/StatCard.tsx` | Summary stat cards |
| `IncidentStatusBadge` | `features/incident/components/` | Incident status in table |
| `SeverityBadge` | `features/incident/components/` | Severity in table |
| `CaseStatusBadge` | `features/incident/components/` | Case status display |
| `PageHeader` | `components/common/` | Dashboard title |
| `PageLoader` | `components/common/` | Loading state |
| `EmptyState` | `components/common/` | No pending incidents |
| `Card`, `Badge`, `Button` | `components/ui/` | Containers, counts, actions |

### 4.3 Existing Hooks to Reuse

| Hook | From | Usage |
|------|------|-------|
| `useApproveIncident` | `features/incident/hooks/` | Approve action on pending table |
| `useRejectIncident` | `features/incident/hooks/` | Reject action on pending table |
| `RejectionDialog` | `features/incident/components/` | Reject modal |

### 4.4 No Chart Library Needed

This dashboard uses `StatCard`, tables, badge lists, and a text feed — **no Recharts or chart library required**.

---

## 5. TypeScript Interfaces

Add to `aegira-frontend/src/types/whs-dashboard.types.ts`:

```typescript
// ============================================================
// WHS Dashboard — Stats Response
// ============================================================

export interface WhsDashboardStats {
  // Summary counts
  pendingIncidentsCount: number;
  myCasesCount: number;          // OPEN + INVESTIGATING, assigned to current user
  totalOpenCasesCount: number;   // OPEN + INVESTIGATING, all officers
  resolvedThisMonthCount: number;

  // Cases breakdown
  casesByStatus: {
    open: number;
    investigating: number;
    resolved: number;
    closed: number;
  };

  // Pending incidents (top 5 for dashboard table)
  pendingIncidents: PendingIncidentRow[];

  // Recent activity
  recentActivity: ActivityEvent[];
}

// ============================================================
// Pending Incident Row (compact, for dashboard table)
// ============================================================

export interface PendingIncidentRow {
  id: string;
  incidentNumber: number;
  title: string;
  reporterName: string;
  incidentType: string;
  severity: string;
  createdAt: string;
}

// ============================================================
// Activity Event
// ============================================================

export interface ActivityEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  actionUrl?: string;
}
```

---

## 6. New API Endpoint

### 6.1 Single Endpoint

Only **one new backend endpoint** is needed:

| Endpoint | Method | Purpose | Access |
|----------|--------|---------|--------|
| `GET /api/v1/dashboard/whs` | GET | All WHS dashboard stats in one response | WHS, ADMIN |

### 6.2 Response Shape

Returns `WhsDashboardStats` containing:

1. **Summary counts** — 4 numbers for the stat cards
2. **Cases by status** — 4 counts for the pipeline view
3. **Pending incidents** — top 5 PENDING incidents (sorted by severity desc, then date asc)
4. **Recent activity** — last 10 events from Event table filtered for:
   - `INCIDENT_CREATED`
   - `INCIDENT_APPROVED`
   - `INCIDENT_REJECTED`
   - `CASE_CREATED`
   - `CASE_UPDATED`
   - `CASE_RESOLVED`

### 6.3 Backend Implementation Notes

- **"My Cases" count** requires the current user's `person_id` — filter cases where `assigned_to = personId` and status in (OPEN, INVESTIGATING)
- **"Resolved This Month"** — filter cases where `resolved_at` is within current calendar month (in company timezone)
- **Pending incidents sort** — `ORDER BY severity_order DESC, created_at ASC` where severity_order maps CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1
- **Activity feed** — query events table, join with person for display names, format messages server-side

### 6.4 Frontend Endpoint Constant

Add `WHS` to the existing `DASHBOARD` object in `aegira-frontend/src/lib/api/endpoints.ts`:

```typescript
DASHBOARD: {
  WORKER: '/dashboard/worker',
  TEAM_LEAD: '/dashboard/team-lead',
  SUPERVISOR: '/dashboard/supervisor',
  ADMIN: '/dashboard/admin',
  WHS: '/dashboard/whs',           // ← add this
},
```

---

**Prev:** [WHS Feature Audit](WHS_FEATURE_AUDIT.md)
**Next:** [WHS Dashboard Implementation Plan](WHS_DASHBOARD_IMPLEMENTATION.md)
