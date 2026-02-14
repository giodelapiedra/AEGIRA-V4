# 2026-02-13: Admin Pages UI/UX Consistency Audit

## Context

Senior UI/UX review of all admin pages identified anti-patterns, inconsistencies, duplicated code, and divergent patterns across Create/Edit/List pages. This changelog documents all fixes applied to bring every admin page into alignment with the established design system.

## Changes

### Fix 1: AdminTeamEditPage — Card Fragmentation & Layout Inconsistency

**File:** `aegira-frontend/src/features/admin/pages/AdminTeamEditPage.tsx`

**Problems:**
- 4 separate Cards (Team Details, Team Leader, Supervisor, Schedule) — Team Leader and Supervisor each had a full Card for just 1 Select dropdown. Classic "card fragmentation" anti-pattern causing excessive vertical scrolling.
- Active Status toggle was inside the Team Details card. In `AdminWorkerEditPage`, it sits outside cards before the action buttons. Inconsistent placement.
- Missing `pt-4` on action buttons div (Worker Edit has it).
- Missing `shouldValidate` on Supervisor Select `onValueChange`.
- Unused `Eye` icon import (was only used by the removed Supervisor card).

**Fix:**
- Merged Team Leader + Supervisor into a single **"Leadership"** card with 2-column grid layout (`grid-cols-1 md:grid-cols-2 gap-6`).
- Moved Active Status toggle outside all cards, positioned before action buttons (matches Worker Edit pattern).
- Added `pt-4` to action buttons div.
- Added `{ shouldValidate: true }` to Supervisor Select.
- Removed unused `Eye` import.
- Card count reduced: 4 → 3 + standalone toggle.

---

### Fix 2: AdminTeamCreatePage — Duplicated Utilities & Same Card Issues

**File:** `aegira-frontend/src/features/admin/pages/AdminTeamCreatePage.tsx`

**Problems:**
- **Duplicated `isEndTimeAfterStart()` function** defined locally (lines 27-31) instead of importing from `@/lib/utils/format.utils`.
- **Duplicated `timeRegex`** constant defined locally instead of importing `TIME_REGEX`.
- Same 4-card fragmentation as Edit page.
- Missing `shouldValidate` on both Leader and Supervisor Selects.
- Missing `pt-4` on action buttons.
- Unused `Eye` icon import.

**Fix:**
- Removed local `isEndTimeAfterStart` and `timeRegex` — now imports from `@/lib/utils/format.utils`.
- Applied same Leadership card merge as Edit page.
- Added `{ shouldValidate: true }` to both Select `onValueChange` handlers.
- Added `pt-4` to action buttons.
- Removed unused `Eye` import.

---

### Fix 3: AdminWorkerCreatePage — Missing Spacing & Raw Data Display

**File:** `aegira-frontend/src/features/admin/pages/AdminWorkerCreatePage.tsx`

**Problems:**
- Missing `pt-4` on action buttons div.
- Schedule Override card displayed raw `work_days` value (e.g., `"1,2,3,4,5"`) instead of formatted day names. The Edit page correctly uses `formatWorkDays()` to show `"Mon, Tue, Wed, Thu, Fri"`.

**Fix:**
- Added `pt-4` to action buttons div.
- Added `import { formatWorkDays } from '@/lib/utils/string.utils'`.
- Changed `{selectedTeam.work_days || 'Mon-Fri'}` to `{formatWorkDays(selectedTeam.work_days) || 'Mon-Fri'}`.

---

### Fix 4: AdminHolidaysPage — Multiple Anti-Patterns

**File:** `aegira-frontend/src/features/admin/pages/AdminHolidaysPage.tsx`

**Problems:**
- **`confirm()` for delete** — used browser's native `confirm()` dialog instead of the `ConfirmDialog` component used everywhere else (e.g., Worker Edit transfer confirmation).
- **Button order reversed** — Submit button came first, Cancel second. Every other page in the app uses Cancel → Submit order.
- **Switch layout inconsistent** — used `justify-between` inline layout. Every other Switch in the app uses the bordered card pattern (`flex items-center space-x-4 rounded-lg border p-4`).
- Missing `pt-4` on action buttons.
- No loading state text on submit button.

**Fix:**
- Replaced `confirm()` with `ConfirmDialog` component using `deleteTarget` state pattern and `variant="destructive"`.
- Reversed button order: Cancel (outline) first, Submit second.
- Changed Switch to bordered card pattern with descriptive text that changes based on state.
- Added `pt-4` and `flex justify-end gap-4` to action buttons.
- Added proper loading states: `"Creating..."` / `"Updating..."` on submit button.

---

### Fix 5: AdminTeamsPage — Manual Route Building

**File:** `aegira-frontend/src/features/admin/pages/AdminTeamsPage.tsx`

**Problems:**
- Edit link used manual string concatenation: `` `${ROUTES.ADMIN_TEAMS}/${row.original.id}/edit` ``
- View link used `.replace()`: `ROUTES.TEAM_DETAIL.replace(':teamId', row.original.id)`
- `AdminWorkersPage` correctly uses `buildRoute()` utility. Inconsistent.

**Fix:**
- Added `import { buildRoute } from '@/lib/utils/route.utils'`.
- Edit: `buildRoute(ROUTES.ADMIN_TEAMS_EDIT, { teamId: row.original.id })`.
- View: `buildRoute(ROUTES.TEAM_DETAIL, { teamId: row.original.id })`.

---

### Fix 6: AdminCompanySettingsPage — Action Button Spacing

**File:** `aegira-frontend/src/features/admin/pages/AdminCompanySettingsPage.tsx`

**Problem:** Action buttons used `mt-6` while every other page uses `pt-4`.

**Fix:** Changed `className="flex justify-end mt-6"` to `className="flex justify-end pt-4"`.

---

### Fix 7: AdminAuditLogsPage — Custom Search Component

**File:** `aegira-frontend/src/features/admin/pages/AdminAuditLogsPage.tsx`

**Problems:**
- Built a manual search UI with inline `Input` + `Button` + `handleKeyDown` instead of the `TableSearch` component used by `AdminTeamsPage` and `AdminWorkersPage`.
- Unused `Search` icon import (was used for the custom search button).

**Fix:**
- Replaced custom search with `TableSearch` component.
- Removed unused `Search` import from lucide-react.
- Removed `handleKeyDown` function (handled internally by `TableSearch`).

---

### Fix 8: Global `.replace()` → `buildRoute()` Cleanup

**Files (5 additional):**
- `aegira-frontend/src/features/incident/pages/MyIncidentsPage.tsx`
- `aegira-frontend/src/features/incident/pages/CaseDetailPage.tsx`
- `aegira-frontend/src/features/incident/pages/AdminCasesPage.tsx`
- `aegira-frontend/src/features/incident/pages/AdminIncidentsPage.tsx`
- `aegira-frontend/src/features/dashboard/components/whs/PendingIncidentsTable.tsx`

**Problem:** All used `ROUTES.XXX.replace(':id', someId)` for route building instead of the `buildRoute()` utility. The utility provides URL encoding (XSS prevention) and consistent pattern.

**Fix:** Added `buildRoute` import and replaced all `.replace(':id', ...)` calls with `buildRoute(ROUTES.XXX, { id: ... })`.

---

## Consistency Matrix (After Fixes)

| Pattern | All Pages |
|---|---|
| Action buttons: `flex justify-end gap-4 pt-4` | Consistent |
| Button order: Cancel → Submit | Consistent |
| Switch layout: bordered card with description | Consistent |
| Select `shouldValidate` on `onValueChange` | Consistent |
| Destructive actions: `ConfirmDialog` (not `confirm()`) | Consistent |
| Route building: `buildRoute()` (not `.replace()`) | Consistent |
| Shared utils: imported (not duplicated locally) | Consistent |
| Loading button text: `"Saving..." / "Creating..."` | Consistent |
| Search in list pages: `TableSearch` component | Consistent |

## Files Modified (14 total)

### Admin pages (9)
1. `aegira-frontend/src/features/admin/pages/AdminTeamEditPage.tsx`
2. `aegira-frontend/src/features/admin/pages/AdminTeamCreatePage.tsx`
3. `aegira-frontend/src/features/admin/pages/AdminWorkerCreatePage.tsx`
4. `aegira-frontend/src/features/admin/pages/AdminHolidaysPage.tsx`
5. `aegira-frontend/src/features/admin/pages/AdminTeamsPage.tsx`
6. `aegira-frontend/src/features/admin/pages/AdminCompanySettingsPage.tsx`
7. `aegira-frontend/src/features/admin/pages/AdminAuditLogsPage.tsx`
8. `aegira-frontend/src/features/admin/pages/AdminWorkerEditPage.tsx` (no changes needed — was already the reference pattern)
9. `aegira-frontend/src/features/admin/pages/AdminWorkersPage.tsx` (no changes needed — was already the reference pattern)

### Route cleanup (5)
10. `aegira-frontend/src/features/incident/pages/MyIncidentsPage.tsx`
11. `aegira-frontend/src/features/incident/pages/CaseDetailPage.tsx`
12. `aegira-frontend/src/features/incident/pages/AdminCasesPage.tsx`
13. `aegira-frontend/src/features/incident/pages/AdminIncidentsPage.tsx`
14. `aegira-frontend/src/features/dashboard/components/whs/PendingIncidentsTable.tsx`
