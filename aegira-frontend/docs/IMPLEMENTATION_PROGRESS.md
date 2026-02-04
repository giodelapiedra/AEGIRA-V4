# Incident Feature — Implementation Progress

## Status: COMPLETED (core feature + post-implementation improvements)

**Last Updated:** 2026-02-03
**Plan Document:** `docs/COMPLETE_END_TO_END_INCIDENT_FLOW.md`

---

## Decision Log

### Decision 1: Remove Amendment Feature from Admin
- **What:** Removed `AdminAmendmentsPage` and all related routes, endpoints, and lazy imports from frontend
- **Files Changed:**
  - `src/config/routes.config.ts` — removed `ADMIN_AMENDMENTS`
  - `src/lib/api/endpoints.ts` — removed `AMENDMENTS`, `AMENDMENT_APPROVE`, `AMENDMENT_REJECT` from ADMIN section
  - `src/routes/index.tsx` — removed lazy import + route for `AdminAmendmentsPage`
  - `src/features/admin/pages/AdminAmendmentsPage.tsx` — DELETED
- **Note:** A `pendingAmendments` field remains in `src/test/mocks/handlers.ts` (mock data only, harmless)

### Decision 2: Add WHS as Separate Role
- **What:** Added `WHS` to the `Role` enum instead of reusing `ADMIN` for WHS functions
- **Why:** WHS officers should only manage incidents/cases, NOT teams/workers/settings/schedules
- **Impact:** All incident/case access uses `['ADMIN', 'WHS']` role check, NOT just `['ADMIN']`

---

## Plan Document Fixes Applied

The following bugs/hallucinations were identified in the original plan and fixed in `COMPLETE_END_TO_END_INCIDENT_FLOW.md`:

| # | Section | What Was Wrong | What Was Fixed |
|---|---------|----------------|----------------|
| 1 | 2 | Referenced `ADMIN` only for WHS | Updated to separate `WHS` role, authorization matrix now includes WHS column |
| 2 | 3.2 | No retry for concurrent incident number generation | Added retry loop (max 3 attempts) catching Prisma `P2002` |
| 3 | 5.1 | Events, notifications, audit ALL listed as "fire-and-forget" inside tx | Events inside `$transaction` (atomic), notifications + audit OUTSIDE (fire-and-forget) |
| 4 | 5.3 | Route middleware used `adminOnly` | Changed to `whsOrAdmin` = `roleMiddleware(['ADMIN', 'WHS'])` |
| 5 | 5.4 | Used `this.notificationService.create()` (doesn't exist) | Changed to `NotificationRepository` directly with try/catch (matches actual codebase pattern) |
| 6 | 5.5 | `auditLog()` missing `companyId`/`personId` params | Changed to `logAudit()` with full signature matching `shared/audit.ts` |
| 7 | 6.2 | No type for `statusCounts` response | Added `IncidentListResponse` custom type |
| 8 | 6.5 | Separate `<RouteGuard>` wrappers for routes | Fixed to nest inside existing `<RouteGuard><AppLayout /></RouteGuard>` structure |
| 9 | 6.5 | Admin guard was `['ADMIN']` only | Split into `['ADMIN', 'WHS']` for incidents and `['ADMIN']` for existing admin routes |
| 10 | 8.1 | `useMyIncidents` used `PaginatedResponse<Incident>` | Changed to `IncidentListResponse` |
| 11 | 8.1 | `useIncidentTimeline` used string concatenation | Changed to `ENDPOINTS.INCIDENT.TIMELINE(incidentId)` |
| 12 | 8.2 | `apiClient.patch(url)` missing body argument | Added `{}` as second argument |
| 13 | 10.2 | Sidebar mobile overflow not addressed | Added mobile limitation note with resolution options |
| 14 | 10.3 | Frontend `NotificationType` not mentioned | Added section for `common.types.ts` update |
| 15 | 13 | Implementation order missing steps | Expanded from 19 to 27 steps |
| 16 | All | Referenced `Amendment` pattern (removed feature) | Changed to `MissedCheckIn` service pattern |

---

## Phase 1: Backend Foundation — COMPLETED

### Step 1: Prisma Schema — DONE
**File:** `aegira-backend/prisma/schema.prisma`

**New enums added:**
- `IncidentType` — PHYSICAL_INJURY, ILLNESS_SICKNESS, MENTAL_HEALTH, MEDICAL_EMERGENCY, HEALTH_SAFETY_CONCERN, OTHER
- `IncidentSeverity` — LOW, MEDIUM, HIGH, CRITICAL
- `IncidentStatus` — PENDING, APPROVED, REJECTED
- `CaseStatus` — OPEN, INVESTIGATING, RESOLVED, CLOSED
- `RejectionReason` — DUPLICATE_REPORT, INSUFFICIENT_INFORMATION, NOT_WORKPLACE_INCIDENT, OTHER

**Existing enums extended:**
- `Role` — added `WHS` between ADMIN and SUPERVISOR
- `EventType` — added INCIDENT_CREATED, INCIDENT_APPROVED, INCIDENT_REJECTED, CASE_CREATED, CASE_UPDATED, CASE_RESOLVED
- `NotificationType` — added INCIDENT_SUBMITTED, INCIDENT_APPROVED, INCIDENT_REJECTED

**New models added:**
- `Incident` — with `incident_number` (sequential per company), reporter/reviewer relations, `@@map("incidents")`
- `Case` — with `case_number` (sequential per company), 1:1 link to incident via `incident_id @unique`, `@@map("cases")`

**Existing models updated:**
- `Company` — added `incidents Incident[]` and `cases Case[]` relations
- `Person` — added `reported_incidents`, `reviewed_incidents`, `assigned_cases` relations

**Note:** The Incident relation to Case uses `incident_case` as the field name (not `case`) to avoid JavaScript reserved word issues.

**Migration:** `npx prisma db push` applied successfully. `npx prisma generate` ran successfully.

### Step 2: Create incident backend module — DONE
**Target:** `aegira-backend/src/modules/incident/`
- `incident.validator.ts` — Zod schemas: `createIncidentSchema`, `getIncidentsQuerySchema`, `getMyIncidentsQuerySchema`, `rejectIncidentSchema`
- `incident.repository.ts` — extends `BaseRepository`, `findById` with relations (reporter+team, reviewer, incident_case), `findByFilters` (paginated with search across title/reporter name), `countByStatus`, `getTimeline` (events where entity_type='incident')
- `incident.service.ts` — `createIncident` with retry loop (P2002 handling for concurrent incident_number), `approveIncident` ($transaction: update incident + create case + 2 events), `rejectIncident` ($transaction: update incident + event). Fire-and-forget notifications via `NotificationRepository` and audit via `logAudit()`
- `incident.controller.ts` — `createIncident`, `getMyIncidents`, `getIncidents`, `getIncidentById`, `getIncidentTimeline`, `approveIncident`, `rejectIncident`. Includes `mapIncidentToResponse()` for camelCase API output. Auth checks: non-WHS/ADMIN users can only view their own incidents
- `incident.routes.ts` — `/my` (allAuthenticated), `POST /` (allAuthenticated), `GET /` (whsOrAdmin), `/:id` (allAuthenticated), `/:id/timeline` (allAuthenticated), `/:id/approve` (whsOrAdmin), `/:id/reject` (whsOrAdmin)

### Step 3: Create case backend module — DONE
**Target:** `aegira-backend/src/modules/case/`
- `case.validator.ts` — Zod schemas: `getCasesQuerySchema`, `updateCaseSchema` (status, assignedTo, notes)
- `case.repository.ts` — extends `BaseRepository`, `findById` with relations (incident+reporter+team, assignee), `findByFilters` (paginated with search), `countByStatus`
- `case.service.ts` — `updateCase` with status transition validation (OPEN→INVESTIGATING→RESOLVED→CLOSED), sets `resolved_at` on RESOLVED, event sourcing (CASE_UPDATED/CASE_RESOLVED with entity_type='incident'), fire-and-forget audit
- `case.controller.ts` — `getCases`, `getCaseById`, `updateCase`. Includes `mapCaseToResponse()` with nested incident info. Auth: non-WHS/ADMIN can only view cases linked to own incidents
- `case.routes.ts` — `GET /` (whsOrAdmin), `GET /:id` (allAuthenticated), `PATCH /:id` (whsOrAdmin)

### Step 4: Register routes in app.ts — DONE
**Target:** `aegira-backend/src/app.ts`
- Added: `import { incidentRoutes } from './modules/incident/incident.routes';`
- Added: `import { caseRoutes } from './modules/case/case.routes';`
- Added: `api.route('/incidents', incidentRoutes);`
- Added: `api.route('/cases', caseRoutes);`

---

## Phase 2: Frontend Foundation — COMPLETED

### Step 9: Types — DONE
- Created `src/types/incident.types.ts` — all interfaces: `Incident`, `Case`, `CreateIncidentData`, `RejectIncidentData`, `UpdateCaseData`, `IncidentEvent`, `IncidentListResponse`, `CaseListResponse`
- Updated `src/types/common.types.ts` — added `INCIDENT_SUBMITTED`, `INCIDENT_APPROVED`, `INCIDENT_REJECTED` to `NotificationType`

### Step 10–11: Endpoints + Routes — DONE
- Added `INCIDENT` section (CREATE, LIST, MY, BY_ID, TIMELINE, APPROVE, REJECT) to `src/lib/api/endpoints.ts`
- Added `CASE` section (LIST, BY_ID, UPDATE) to `src/lib/api/endpoints.ts`
- Added worker routes (MY_INCIDENTS, REPORT_INCIDENT, INCIDENT_DETAIL) to `src/config/routes.config.ts`
- Added admin routes (ADMIN_INCIDENTS, ADMIN_INCIDENT_DETAIL, ADMIN_CASES, ADMIN_CASE_DETAIL) to `src/config/routes.config.ts`

### Step 12: Auth types — DONE
- Updated `src/types/auth.types.ts` — added `'WHS'` to `UserRole` union
- Updated `src/lib/utils/format.utils.ts` — added `WHS: 'WHS'` to `ROLE_LABELS`
- Updated `src/components/common/RoleBadge.tsx` — added `WHS: 'secondary'` variant

### Step 13: Query/Mutation Hooks — DONE
Created all hooks in `src/features/incident/hooks/`:
- `useMyIncidents.ts` — paginated own incidents with status filter
- `useIncidents.ts` — paginated all incidents with status/severity/type/search filters
- `useIncident.ts` — single incident by ID
- `useIncidentTimeline.ts` — event timeline for incident
- `useCreateIncident.ts` — mutation: POST /incidents
- `useApproveIncident.ts` — mutation: PATCH /incidents/:id/approve
- `useRejectIncident.ts` — mutation: PATCH /incidents/:id/reject
- `useCases.ts` — paginated cases with status/search filters
- `useCase.ts` — single case by ID
- `useUpdateCase.ts` — mutation: PATCH /cases/:id

---

## Phase 3: Worker Pages — COMPLETED

### Step 14–17: Pages + Components — DONE
- `ReportIncidentPage.tsx` — form with Zod (type, severity, title, location, description), toast + redirect to My Incidents
- `MyIncidentsPage.tsx` — DataTable with status tabs (All/Pending/Approved/Rejected), counts from statusCounts, `formatIncidentNumber()` helper
- `IncidentDetailPage.tsx` — shared page for worker (read-only) + admin (approve/reject actions), inline case info when approved, inline rejection details when rejected, timeline, approve ConfirmDialog, reject RejectionDialog
- `IncidentStatusBadge.tsx` — PENDING (yellow), APPROVED (green), REJECTED (red)
- `SeverityBadge.tsx` — LOW (slate), MEDIUM (yellow), HIGH (orange), CRITICAL (red)
- `CaseStatusBadge.tsx` — OPEN (blue), INVESTIGATING (purple), RESOLVED (green), CLOSED (slate)

---

## Phase 4: Admin/WHS Pages — COMPLETED

### Step 18–22: Pages + Components — DONE
- `AdminIncidentsPage.tsx` — DataTable with status tabs + severity filter + type filter + search, row actions (View/Approve/Reject via DropdownMenu)
- `RejectionDialog.tsx` — Dialog with React Hook Form + Zod (reason select + explanation textarea)
- `AdminCasesPage.tsx` — DataTable of cases with status tabs + search, case number formatting
- `CaseDetailPage.tsx` — info card, tabs (Details/Timeline/Manage), manage tab: update status (valid transitions only), update notes
- `IncidentTimeline.tsx` — shared component for event records with icons per event type, vertical timeline layout

---

## Phase 5: Integration — COMPLETED

### Step 23–27: Wiring — DONE
- **Routes registered** in `src/routes/index.tsx`:
  - Worker incident routes (MY_INCIDENTS, REPORT_INCIDENT, INCIDENT_DETAIL) in common authenticated section
  - WHS+ADMIN guard (`allowedRoles={['ADMIN', 'WHS']}`) for ADMIN_INCIDENTS, ADMIN_INCIDENT_DETAIL, ADMIN_CASES, ADMIN_CASE_DETAIL
- **Lazy-loaded** all 6 new page components matching existing `React.lazy()` pattern
- **Sidebar updated** in `src/components/layout/Sidebar.tsx`:
  - Worker: added "Incidents" link (ShieldAlert icon) → MY_INCIDENTS
  - WHS role: Dashboard + Incidents + Cases (new section)
  - Admin: added "Incidents" (ShieldAlert) + "Cases" (FolderOpen) after Workers
- **Dashboard quick actions**: Not yet added (deferred — requires reading existing dashboard component)

---

## Phase 6: Post-Implementation Improvements — COMPLETED

### Fix 1: WHS Account Creation Gap — DONE
**Problem:** WHS role was implemented everywhere (Prisma schema, frontend types, sidebar, route guards, ROLE_LABELS) except in two critical CRUD entry points, making it impossible to create WHS accounts.

**Files Changed:**
- `aegira-backend/src/modules/person/person.validator.ts` — Added `'WHS'` to `role: z.enum()` (was missing from backend validation)
- `aegira-frontend/src/features/admin/pages/AdminWorkerCreatePage.tsx` — Added `'WHS'` to Zod schema, added `<SelectItem value="WHS">WHS</SelectItem>`, added help text for WHS role

### Fix 2: WHS Notification on Incident Submission — DONE
**Problem:** When a worker submitted an incident, WHS and ADMIN users were never notified. The `NotificationType.INCIDENT_SUBMITTED` existed in the Prisma schema but was never used.

**Files Changed:**
- `aegira-backend/src/modules/incident/incident.service.ts` — Added `notifyWhsAndAdminIncidentSubmitted()` private method that queries all active WHS/ADMIN users in the company and creates batch notifications via `NotificationRepository.createMany()`. Called fire-and-forget after incident creation.

### Fix 3: "Reviewed By" Column in List Tables — DONE
**Problem:** Backend already tracked reviewer info (`reviewed_by`, `reviewer` relation) and the detail page displayed it, but the list tables didn't show who reviewed each incident.

**Files Changed:**
- `aegira-frontend/src/features/incident/pages/AdminIncidentsPage.tsx` — Added `reviewerName` column to DataTable
- `aegira-frontend/src/features/incident/pages/MyIncidentsPage.tsx` — Added `reviewerName` column to DataTable

### Fix 4: 4-Quadrant Card Layout for Detail Pages — DONE
**Problem:** IncidentDetailPage and CaseDetailPage had inconsistent layouts. IncidentDetailPage was a stacked vertical card design, CaseDetailPage used tabs. User wanted both to use a clean 4-quadrant card grid.

**Files Changed:**
- `aegira-frontend/src/features/incident/pages/IncidentDetailPage.tsx` — Complete rewrite:
  - Header: title, reporter name, severity badge, status badge, back button
  - 2x2 grid: Incident Information | Reporter Information | Incident Details | WHS Review
  - New `InfoRow` component for consistent label:value rows
  - Action buttons (Approve/Reject) below grid for pending incidents
  - Timeline card at bottom
- `aegira-frontend/src/features/incident/pages/CaseDetailPage.tsx` — Complete rewrite:
  - Matching 4-quadrant layout: Case Information | Reporter Information | Incident Details | WHS Assignment
  - Removed Tabs component — all info visible without tab switching
  - Manage Case form section below grid (status dropdown with valid transitions, notes textarea, save button)
  - Timeline card at bottom

### Fix 5: Case Notes Visibility on Incident Detail Page — DONE
**Problem:** Case notes were only editable/visible on CaseDetailPage. When WHS officers added notes to a case, those notes were not readable from the IncidentDetailPage.

**Files Changed:**
- `aegira-backend/src/modules/incident/incident.repository.ts` — Added `notes: true` to `incident_case` select and `IncidentWithRelations` type
- `aegira-backend/src/modules/incident/incident.controller.ts` — Added `notes: string | null` to `incident_case` type signature, added `caseNotes: incident.incident_case?.notes ?? null` to response mapping
- `aegira-backend/src/modules/incident/incident.service.ts` — Added `notes: true` to all 4 `incident_case` select blocks (createIncident, approveIncident update, approveIncident re-fetch, rejectIncident)
- `aegira-frontend/src/types/incident.types.ts` — Added `caseNotes: string | null` to `Incident` interface
- `aegira-frontend/src/features/incident/pages/IncidentDetailPage.tsx` — Added read-only case notes display in WHS Review card (shows notes text or "No notes yet")

---

## Key Patterns to Follow (from codebase analysis)

### Backend
- **Repository:** Extend `BaseRepository(prisma, companyId)` — use `this.where()` and `this.withCompany()`
- **Controller:** Extract `c.get('companyId')`, `c.get('userId')`, `c.get('userRole')` — return `c.json({ success: true, data })`
- **Service:** Constructor takes repository — validates transitions — uses `prisma.$transaction()` for atomic ops
- **Audit:** `logAudit({ companyId, personId, action, entityType, entityId, details })` — fire-and-forget
- **Notifications:** `new NotificationRepository(prisma, companyId).create({...})` inside try/catch
- **Route registration:** `api.route('/incidents', incidentRoutes)` in `app.ts`
- **Variable naming:** Use `incidentCase` not `case` (reserved word)

### Frontend
- **Hooks:** One file per hook, `queryKey` includes all params, `enabled: !!id`, `STALE_TIMES.STANDARD`
- **Mutations:** `mutateAsync` + try/catch in pages, invalidate related queries in hooks
- **Tables:** `columns` defined OUTSIDE component, `DataTable` with `data?.items ?? []`
- **Forms:** Zod schema OUTSIDE component, `zodResolver`, `defaultValues` always set
- **Pages:** Wrap with `PageLoader`, use `PageHeader` with action buttons
- **Routes:** Nest inside existing `<RouteGuard><AppLayout /></RouteGuard>` block
