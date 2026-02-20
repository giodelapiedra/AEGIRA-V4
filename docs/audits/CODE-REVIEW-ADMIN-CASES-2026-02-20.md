# Senior Code Review: Admin Cases Page

**Reviewer**: Senior Software Engineer (Claude)
**Date**: 2026-02-20
**Scope**: Full-stack review of `/admin/cases` — frontend page, detail page, hooks, components, backend controller, service, repository, routes, validators
**Files reviewed**: 14 files, ~1,540 lines

---

## Executive Summary

**Overall verdict: SOLID — production-ready with minor improvements needed.**

The admin cases feature is well-architected with clean layer separation, strong security posture, and consistent adherence to established AEGIRA patterns. The case lifecycle (status transitions, event sourcing, audit trails) is properly implemented with TOCTOU prevention. The CaseDetailPage is particularly well-crafted with a clear 2x2 quadrant layout and role-based form visibility.

**Score: 8/10** — Strong foundation. A few items below would push this to excellent.

---

## 1. Code Structure & Architecture

### What's done well

- **Layer separation is textbook.** Routes → Controller → Service → Repository. No layer bleeds into another. The service is only introduced for `updateCase` (where business logic exists), while the list/detail endpoints go controller → repository directly. Correct use of the "service only when needed" pattern.
- **Lean vs. Full type split.** `CaseListItem` (6 fields for table) vs `CaseWithRelations` (full detail). List queries don't over-fetch.
- **Column definitions outside the component** (`AdminCasesPage.tsx:20`). Prevents re-renders. Correct pattern.
- **VALID_TRANSITIONS defined on both frontend AND backend** (`CaseDetailPage.tsx:37`, `case.service.ts:7`). Defense in depth — the frontend uses it to limit the dropdown options, the backend enforces it in the transaction. Neither trusts the other.
- **TOCTOU prevention.** `updateCase` in the service fetches + validates inside `$transaction` (line 34–58). Prevents race conditions where two WHS officers update the same case simultaneously.
- **Same-status no-op stripping** (service line 55–57). If the submitted status equals the current status, it's stripped to avoid creating misleading audit events. Smart detail.
- **Event sourcing with `buildEventData`**. All case state changes are recorded as events with `entity_type='incident'` for a unified timeline. Correct integration with Phase 1 event model.
- **Fire-and-forget for audit.** `logAudit()` is called outside the transaction and never awaited. Main operation succeeds even if audit fails.
- **CaseDetailPage header renders outside `PageLoader`** (line 129–149). The back button and title render immediately for fast LCP, while the data-dependent section loads inside `PageLoader`. Good performance pattern.
- **`useForm` with `values` prop** (not `defaultValues`) in CaseDetailPage. This syncs the form with server data on every re-render, which is correct for edit forms where the server state might change (e.g., another officer updates the case).

### Issues found

#### ISSUE-01 [LOW] — `mapCaseToListItem` and `mapCaseToResponse` return `Record<string, unknown>`

**Files**: `case.controller.ts:31, 48`

```typescript
function mapCaseToListItem(caseRecord: CaseListItem): Record<string, unknown> {
function mapCaseToResponse(caseRecord: CaseWithRelations, timezone: string): Record<string, unknown> {
```

Same issue as the incident module. These lose type safety at the controller boundary. The frontend `CaseListItem` and `Case` interfaces are manually kept in sync with no compile-time guarantee.

**Recommendation**: Define response interfaces:

```typescript
interface CaseListItemResponse {
  id: string;
  caseNumber: number;
  incident: { title: string; severity: string; reporterName: string };
  status: CaseStatus;
  assigneeName: string | null;
  createdAt: string;
}

function mapCaseToListItem(caseRecord: CaseListItem): CaseListItemResponse {
```

**Severity**: Low — works at runtime, but would catch shape mismatches at compile time.

#### ISSUE-02 [LOW] — `calculateAge` is duplicated across controllers

**Files**: `case.controller.ts:19`, `incident.controller.ts:63`

The exact same function exists in both controllers with identical logic (timezone-aware age calculation using Luxon). This is a clear DRY violation.

**Recommendation**: Move to `shared/utils.ts`:

```typescript
// shared/utils.ts
export function calculateAge(dateOfBirth: Date | null, timezone: string): number | null {
  if (!dateOfBirth) return null;
  const now = DateTime.now().setZone(timezone);
  let age = now.year - dateOfBirth.getUTCFullYear();
  const monthDiff = now.month - (dateOfBirth.getUTCMonth() + 1);
  if (monthDiff < 0 || (monthDiff === 0 && now.day < dateOfBirth.getUTCDate())) {
    age--;
  }
  return age;
}
```

**Severity**: Low — both copies are correct, but maintaining two copies risks them drifting apart.

#### ISSUE-03 [LOW] — Service mutates input parameter

**File**: `case.service.ts:57`

```typescript
// No-op: same status — strip it so we don't create misleading audit events
data.status = undefined;
```

The service directly mutates the `data` parameter object. If the caller ever needed to reference `data.status` after calling `updateCase()`, it would be `undefined` unexpectedly. This is a subtle side effect.

**Recommendation**: Create a local copy:

```typescript
const effectiveStatus = (data.status && data.status !== existing.status) ? data.status : undefined;
```

Then use `effectiveStatus` instead of `data.status` throughout the transaction.

**Severity**: Low — currently the caller (controller) doesn't reference `data` after the service call, so no bug. But defensive coding would prevent future surprises.

#### ISSUE-04 [INFO] — `resolved_at` gets overwritten on CLOSED transition

**File**: `case.service.ts:65–67`

```typescript
if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
  updateData.resolved_at = new Date();
}
```

If a case follows OPEN → INVESTIGATING → RESOLVED → CLOSED, the `resolved_at` timestamp will be overwritten when transitioning to CLOSED. The original "resolved" timestamp is lost.

This is a design decision, not a bug — you could argue that CLOSED means "fully resolved/archived" and the final timestamp is what matters. But if you need to track when it was first resolved vs. when it was closed, consider adding a separate `closed_at` column.

**Verdict**: Keep as-is unless business requirements need distinct timestamps.

---

## 2. State Management

### What's done well

- **Server state via TanStack Query** (`useCases`, `useCase`), client state via `useState` (filters, pagination, form). Clean separation.
- **`keepPreviousData`** in `useCases.ts:25` (via `placeholderData`) — prevents content flash when switching tabs/pages. Correct.
- **Pagination reset on filter change** (lines 129, 134). Both search and tab changes reset `pageIndex` to 0. Correct.
- **Dual search state pattern** (`searchInput` for input value, `search` for committed query). Prevents unnecessary re-fetches while typing.
- **Query cache invalidation in `useUpdateCase`** is comprehensive — invalidates `cases`, `case`, `incidents`, `my-incidents`, `dashboard`, and `incident-timeline`. All related caches are properly busted.
- **`enabled: !!incidentId`** in `useIncidentTimeline` (line 15) — prevents firing with empty string when `caseData` is still loading. Correct guard.

### Issues found

#### ISSUE-05 [MEDIUM] — Search not reset when switching status tabs

**File**: `AdminCasesPage.tsx:132–135`

```typescript
const handleTabChange = (value: string) => {
  setStatusTab(value as StatusTab);
  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
};
```

When switching tabs, the search term persists. If a user searched for "John", then switches from "All" to "Open" tab, they'll see only OPEN cases matching "John" — which might return zero results and confuse the user.

**Recommendation**: Same fix as the incidents module — either reset search on tab switch:

```typescript
const handleTabChange = (value: string) => {
  setStatusTab(value as StatusTab);
  setSearch('');
  setSearchInput('');
  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
};
```

Or make it explicit that search is cumulative by showing active filter chips.

**Severity**: Medium — UX decision needed, not a bug.

#### ISSUE-06 [LOW] — No URL state sync for filters

Same as the incidents module — filters, search, and pagination are in `useState` and lost on refresh. For WHS officers sharing links ("look at these open cases"), URL state would help.

**Recommendation**: Optional — sync `statusTab`, `search`, and `page` to `useSearchParams()`.

#### ISSUE-07 [LOW] — No form dirty tracking in CaseDetailPage

**File**: `CaseDetailPage.tsx:331–335`

```typescript
<Button type="submit" disabled={updateCase.isPending}>
  {updateCase.isPending ? 'Saving...' : 'Save Changes'}
</Button>
```

The "Save Changes" button is always enabled (except during submission). Users can click it without making any changes, which triggers a PATCH request that does nothing meaningful on the backend (empty `updateData` object).

**Recommendation**: Use React Hook Form's `formState.isDirty`:

```typescript
const { formState: { isDirty } } = useForm(...);

<Button type="submit" disabled={updateCase.isPending || !isDirty}>
  {updateCase.isPending ? 'Saving...' : 'Save Changes'}
</Button>
```

**Severity**: Low — the backend handles this gracefully (no-op update), but prevents unnecessary API calls.

---

## 3. Security Review

### What's done well

- **Three-tier role enforcement:**
  1. Route level: `whsOrAdmin` for list, `whsOnly` for update (`case.routes.ts:14–15`)
  2. Frontend route: `<RouteGuard allowedRoles={['ADMIN', 'WHS']} />` (`index.tsx:257`)
  3. Frontend UI: `isWhs` check hides manage section from ADMIN (`CaseDetailPage.tsx:262`)
- **Ownership check for non-privileged users.** `getCaseById` allows `allAuthenticated` roles to hit the endpoint, but the controller verifies non-WHS/ADMIN users can only view cases linked to their own incidents (line 128–131). Correctly implements the principle that workers should see their case status.
- **Zod validation on PATCH body** (`updateCaseSchema`) with `.max(2000).trim()` on notes. Input is sanitized before reaching the controller.
- **Tenant isolation.** All repository queries use `this.where()` / `company_id` scoping. `BaseRepository` enforces this.
- **`c.req.valid('json' as never)` pattern** used correctly in `updateCase` controller.
- **Status transition validation inside transaction.** The service validates allowed transitions inside `$transaction`, preventing concurrent requests from bypassing the state machine.

### Issues found

#### ISSUE-08 [LOW] — `updateCaseSchema` allows `OPEN` as a valid status value

**File**: `case.validator.ts:10–11`

```typescript
export const updateCaseSchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']).optional(),
```

The validator accepts `OPEN` as a status, but no transition leads TO `OPEN` (it's always the initial status). The service would reject it with "Cannot transition from X to OPEN", so there's no actual vulnerability — but the validator could be tighter:

```typescript
status: z.enum(['INVESTIGATING', 'RESOLVED', 'CLOSED']).optional(),
```

**Severity**: Low — defense in depth. The service catches it, but failing at validation is faster and cleaner.

#### ISSUE-09 [INFO] — Role check uses string comparison with `.toUpperCase()`

**File**: `case.controller.ts:128`

```typescript
const whsOrAdmin = ['ADMIN', 'WHS'].includes(userRole.toUpperCase());
```

The `.toUpperCase()` is defensive but should never be needed — `userRole` comes from `c.get('userRole')` which is set by auth middleware from the JWT, and roles are stored as uppercase enums. The defensive coding is harmless but slightly inconsistent with other modules that don't do this.

**Verdict**: Informational. No change needed, but note the inconsistency.

---

## 4. Performance Review

### What's done well

- **Parallel `Promise.all`** for `findForList` + `countByStatus` in the controller (lines 91–94). Two DB queries run concurrently.
- **Parallel `Promise.all` inside `findForList`** (repository lines 151–159) — `findMany` and `count` also run concurrently. Double-parallel: controller parallelizes two repo calls, each repo call parallelizes its own queries.
- **Lean select for list queries.** `selectForList` only fetches 6 fields + 2 relations. No over-fetching.
- **Pagination enforced** — default 20 items, max 100 (via `parsePagination`).
- **`placeholderData: keepPreviousData`** in `useCases` — prevents content flash during tab/page transitions.

### Issues found

#### ISSUE-10 [LOW] — Search on `OR` conditions without DB index

**File**: `case.repository.ts:124–142`

The search filter uses `contains` (ILIKE in PostgreSQL) on `incident.title`, `incident.reporter.first_name`, and `incident.reporter.last_name`. These are joined table columns with no text index, resulting in sequential scans.

For small-to-medium datasets (<5K cases per company), this is fine. For enterprise scale, consider a trigram index on `incident.title`.

**Severity**: Low at current scale.

#### ISSUE-11 [LOW] — CaseDetailPage has sequential query waterfall

**File**: `CaseDetailPage.tsx:80–81`

```typescript
const { data: caseData } = useCase(id || '');
const { data: timeline } = useIncidentTimeline(caseData?.incidentId || '');
```

The timeline query depends on `caseData.incidentId`, creating a waterfall: first `useCase` must complete, then `useIncidentTimeline` fires. Total wait = case query time + timeline query time.

**Recommendation**: Consider adding the timeline data to the case detail endpoint on the backend, or provide a `/cases/:id/timeline` endpoint that resolves the incident ID server-side. This would parallelize the data loading.

**Severity**: Low — the waterfall is typically <200ms total, acceptable for a detail page.

#### ISSUE-12 [INFO] — `countByStatus` runs without filters, which is correct

The `countByStatus()` call in `getCases` (controller line 93) intentionally has no filters (no search/status), so tab counts always reflect the global company totals. This is correct UX — users expect tab counts to show the overall breakdown, not change when they search or filter. Confirming this is intentional.

---

## 5. UI/UX Improvements

### Current State

**List Page**: Status tabs with counts → Search → DataTable with 8 columns
```
[ All (12) ] [ Open (3) ] [ Investigating (4) ] [ Resolved (3) ] [ Closed (2) ]
```

**Detail Page**: 2x2 quadrant layout (Case Info, Reporter Info, Incident Details, WHS Assignment) → Manage Case form (WHS only) → Timeline

### What's done well

- Tabs with counts give immediate context on case distribution
- 2x2 quadrant layout in detail page is information-dense but scannable
- Responsive column hiding (Case #, Reporter, Status, Assigned To, Created hide at appropriate breakpoints)
- Reporter name shown inline on mobile when Reporter column is hidden (line 40–43)
- "View Incident" button links the case to its parent incident — good for cross-referencing
- Status dropdown shows "(Current)" label — clear visual anchor
- "This case is closed and cannot be transitioned further" message when no transitions available
- Timeline reuses `IncidentTimeline` component — shows the full incident→case lifecycle in one view

### Recommendations

#### UX-01 — Add visual urgency for Open tab

When there are OPEN cases (new, unassigned, uninvestigated), the "Open" tab should draw attention:

```tsx
<TabsTrigger value="OPEN" className="gap-1.5 whitespace-nowrap">
  Open
  {statusCounts.OPEN > 0 ? (
    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
      {statusCounts.OPEN}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">(0)</span>
  )}
</TabsTrigger>
```

OPEN cases are the actionable ones — WHS officers need to notice them.

#### UX-02 — Row click navigation

**File**: `AdminCasesPage.tsx:199–207`

Currently, users must click the "View" button to navigate to case details. The `DataTable` component already supports `onRowClick`. Use it:

```tsx
<DataTable
  columns={columns}
  data={data?.items ?? []}
  onRowClick={(row) => navigate(buildRoute(ROUTES.ADMIN_CASE_DETAIL, { id: row.id }))}
  // ...
/>
```

This is a standard enterprise UX pattern and significantly reduces friction. The "View" button can remain for discoverability.

**Impact**: High UX win for minimal code change.

#### UX-03 — Add severity filter dropdown

Unlike the incidents page which has severity and type filter dropdowns, the cases page only has tabs + search. Cases inherit severity from their parent incidents, and WHS officers often need to filter by severity (e.g., "show me all open CRITICAL cases").

Add a severity dropdown next to the search:

```tsx
<div className="flex flex-col sm:flex-row gap-3">
  <TableSearch ... />
  <Select value={severityFilter} onValueChange={handleSeverityChange}>
    <SelectTrigger className="w-full sm:w-[160px]">
      <SelectValue placeholder="All severities" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="ALL">All Severities</SelectItem>
      <SelectItem value="CRITICAL">Critical</SelectItem>
      <SelectItem value="HIGH">High</SelectItem>
      <SelectItem value="MEDIUM">Medium</SelectItem>
      <SelectItem value="LOW">Low</SelectItem>
    </SelectContent>
  </Select>
</div>
```

This requires adding a `severity` filter to the backend query as well.

#### UX-04 — Tab-specific empty states

When switching to a tab with zero results, the user sees "No cases found." — the generic `emptyMessage`. Consider:

```
Open (0):          "No open cases. All cases are being handled."
Investigating (0): "No cases currently under investigation."
Resolved (0):      "No resolved cases yet."
Closed (0):        "No closed cases."
All (0):           "No cases have been created yet."
```

#### UX-05 — Status transition confirmation

**File**: `CaseDetailPage.tsx:274–307`

The status dropdown allows skipping states (e.g., OPEN → CLOSED, INVESTIGATING → CLOSED). While the `VALID_TRANSITIONS` map allows this, skipping RESOLVED goes straight to archival. Consider adding a confirmation dialog for terminal transitions:

```tsx
// When transitioning to CLOSED without going through RESOLVED:
"Are you sure you want to close this case? It has not been marked as resolved."
```

This prevents accidental case closure, especially for OPEN → CLOSED.

#### UX-06 — Incident number formatting uses wrong date

**File**: `CaseDetailPage.tsx:215`

```tsx
View Incident {formatIncidentNumber(caseData.incident.incidentNumber, caseData.createdAt)}
```

This uses `caseData.createdAt` (the **case's** creation date) to format the **incident** number. `formatIncidentNumber` extracts the year from `createdAt` to produce `INC-2026-0001`. If the incident was created in December 2025 but the case was created in January 2026, this would display `INC-2026-0001` instead of `INC-2025-0001`.

**Recommendation**: Add `incident.createdAt` to the backend response (it's currently not included in `mapCaseToResponse`), then use:

```tsx
formatIncidentNumber(caseData.incident.incidentNumber, caseData.incident.createdAt)
```

**Severity**: Low-Medium — incorrect display in cross-year edge cases.

#### UX-07 — Loading state indicator during data refresh

When switching tabs, `keepPreviousData` shows stale content briefly. Add a subtle opacity transition:

```tsx
<div className={cn("transition-opacity duration-150", isLoading && "opacity-60")}>
  <DataTable ... />
</div>
```

#### UX-08 — Redundant "Back" buttons on CaseDetailPage

**File**: `CaseDetailPage.tsx:144, 327`

The detail page has two "Back to Cases" buttons:
1. Top-right header: `<Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_CASES)}>Back</Button>`
2. Bottom of manage case form: `<Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_CASES)}>Back to Cases</Button>`

For Admin users (who don't see the manage form), only the top button exists — which is correct. For WHS users, having two back buttons is slightly redundant. The bottom one makes sense as "Cancel" for the form, but consider renaming it to "Cancel" for clarity.

---

## 6. Additional Enterprise Enhancements

### ENT-01 — Assignee filter

Cases have an `assigneeName` column. WHS officers managing multiple cases need to filter by assignee: "show me my cases" vs "show me unassigned cases." Add an assignee dropdown filter.

### ENT-02 — Sorting

Columns are not currently sortable. For production, at minimum allow sorting by:
- **Created date** (newest/oldest first)
- **Severity** (critical first)
- **Status** (open first — default for WHS workflow)

### ENT-03 — Case assignment

The `assigned_to` field exists on the Case model but there's no UI to assign a case to a WHS officer. Currently it's only set during case creation (from the incident approval flow). Add the ability for WHS officers to reassign cases.

### ENT-04 — Notes history/append mode

Currently, updating notes overwrites the previous text entirely. For case management, consider:
- A notes history (each update creates a timestamped entry)
- Or at minimum, an append mode with timestamps

This preserves the investigation trail and handoff context.

### ENT-05 — Export

Add a "Download CSV" button for compliance reporting. WHS regulations often require case reports to be exportable.

### ENT-06 — Status transition notifications

When a case status changes (especially to RESOLVED/CLOSED), the incident reporter should be notified. Currently, the service creates audit events but doesn't send notifications. Consider adding fire-and-forget notifications:

```typescript
// After transaction, fire-and-forget
notifyReporter(companyId, caseRecord.incident.reporter.id, {
  type: 'CASE_STATUS_CHANGED',
  caseNumber: caseRecord.case_number,
  newStatus: data.status,
});
```

---

## 7. Summary of All Issues

| ID | Severity | Category | Description |
|---|---|---|---|
| ISSUE-01 | LOW | Type Safety | Mappers return `Record<string, unknown>` — loses compile-time shape checking |
| ISSUE-02 | LOW | DRY | `calculateAge` duplicated in case and incident controllers |
| ISSUE-03 | LOW | Side Effects | Service mutates input `data` parameter directly |
| ISSUE-04 | INFO | Design | `resolved_at` overwritten on CLOSED transition |
| ISSUE-05 | MEDIUM | UX | Search persists across tab switches — potentially confusing |
| ISSUE-06 | LOW | UX | No URL state sync — filters lost on refresh |
| ISSUE-07 | LOW | UX | No form dirty tracking — submit button always enabled |
| ISSUE-08 | LOW | Validation | `updateCaseSchema` allows `OPEN` as a valid status value |
| ISSUE-10 | LOW | Performance | ILIKE search without DB index — fine at current scale |
| ISSUE-11 | LOW | Performance | Detail page has sequential query waterfall (case → timeline) |
| UX-01 | LOW | UI | Open tab lacks visual urgency indicator |
| UX-02 | MEDIUM | UX | Row click should navigate to case details |
| UX-03 | LOW | UI | No severity filter dropdown (unlike incidents page) |
| UX-04 | LOW | UI | Generic empty state message for all tabs |
| UX-05 | LOW | UX | No confirmation for terminal status transitions |
| UX-06 | LOW-MED | Bug | Incident number format uses case's `createdAt` instead of incident's |
| UX-07 | LOW | UI | No visual feedback during data refresh |
| UX-08 | LOW | UI | Redundant "Back" buttons for WHS users |

**Critical/P0 issues**: None
**Blocking issues**: None
**Must-fix before production**: ISSUE-05 (decide on filter behavior), UX-06 (incident number date bug)

---

## 8. Final Assessment

### Strengths
- Clean architecture following AEGIRA conventions consistently
- Strong security posture: three-tier role enforcement + ownership check + tenant isolation + transition validation inside transaction
- Proper event sourcing integration with `buildEventData`
- CaseDetailPage has excellent layout (2x2 quadrant, role-based form visibility, timeline integration)
- Efficient data fetching (lean selects, double-parallel queries, `keepPreviousData`)
- Good component reuse (`CaseStatusBadge`, `SeverityBadge`, `IncidentTimeline`)

### What would I change in an enterprise refactor?
1. **Fix UX-06** (incident number date) — actual display bug, 15 minutes of work
2. **Add row click navigation** (UX-02) — biggest UX win, 2 lines of code
3. **Decide on filter persistence strategy** (ISSUE-05) — either reset on tab switch or show filter chips
4. **Extract `calculateAge` to shared utils** (ISSUE-02) — 10 minutes, prevents drift
5. **Add severity filter** (UX-03) — brings feature parity with the incidents page

### Comparison with Admin Incidents Page
The cases module is leaner than incidents (no approve/reject workflow, no RowActions with dialogs), which is appropriate — cases are about tracking and updating, not reviewing. The code quality is consistent between the two modules, suggesting a mature and disciplined approach. The same patterns (mappers returning `Record<string, unknown>`, no URL state sync, search persistence across tabs) appear in both modules — fixing them in one should be mirrored in the other for consistency.

### Overall
This is clean, well-structured code built on a solid foundation. The backend is production-grade with proper transaction handling, race condition prevention, and event sourcing. The frontend is clean and consistent. The improvements above are refinements, not rewrites.

**No rewrites needed. Ship it, then iterate on the UX polish.**
