# Admin Pages Code Review & Fixes

**Date:** 2026-02-11
**Type:** Code Review + Bug Fixes + Refactoring
**Scope:** Admin module — Schedules, Workers, Company Settings
**Reviewed By:** Senior Software Engineer (Claude Code)

---

## Summary

Full-stack code review of admin management pages with focus on update flow correctness, state management, API handling, edge cases, and pattern compliance. All identified issues were fixed.

---

## 1. Removed Redundant AdminSchedulesPage

**Problem:** `/admin/schedules` was a duplicate of `/admin/teams` — same data source, same edit action destination, zero unique functionality.

**Files removed/changed:**
- `aegira-frontend/src/features/admin/pages/AdminSchedulesPage.tsx` — **deleted**
- `aegira-frontend/src/routes/index.tsx` — removed lazy import + route
- `aegira-frontend/src/config/routes.config.ts` — removed `ADMIN_SCHEDULES`
- `aegira-frontend/src/components/layout/Sidebar.tsx` — removed nav item + unused `CalendarDays` import

---

## 2. Worker Management Fixes (Create + Edit Pages)

### Bug: Dual state for workDays causing desync (Edit Page)
- **Was:** `useState<string[]>` + `useEffect` syncing with React Hook Form — could desync on refetch
- **Fix:** Single source of truth via `watch('workDays')` from RHF, matching `AdminTeamEditPage` pattern

### Bug: Missing "both or neither" time validation (Create + Edit)
- **Was:** Frontend allowed `checkInStart` without `checkInEnd` — backend would reject
- **Fix:** Added Zod refinement ensuring both times are set together or both empty

### Bug: TEAM_LEAD team assignment inconsistent (Create Page)
- **Was:** Create page only showed team dropdown for WORKER; Edit page showed it for WORKER + TEAM_LEAD
- **Fix:** Create page now shows team dropdown for both roles, consistent with Edit

### Bug: Empty strings sent to API (Create Page)
- **Was:** Empty string schedule fields sent to backend — failed regex validation
- **Fix:** Strip empty strings to `undefined` before API call

### Bug: `isEndTimeAfterStart` duplicated in 3 files
- **Was:** Same helper copy-pasted in `AdminWorkerCreatePage`, `AdminWorkerEditPage`, `AdminTeamEditPage`
- **Fix:** Extracted to `lib/utils/format.utils.ts` (`isEndTimeAfterStart`, `TIME_REGEX`, `WORK_DAYS_REGEX`)

**Files changed:**
- `aegira-frontend/src/lib/utils/format.utils.ts` — added shared time/schedule utilities
- `aegira-frontend/src/features/admin/pages/AdminWorkerEditPage.tsx` — removed dual state, added validation, shared imports
- `aegira-frontend/src/features/admin/pages/AdminWorkerCreatePage.tsx` — added validation, fixed team assignment, stripped empty strings, shared imports
- `aegira-frontend/src/features/admin/pages/AdminTeamEditPage.tsx` — replaced local helpers with shared imports

---

## 3. Company Settings Rewrite (`/admin/settings`)

### Bug: Backend skipped Zod validated data
- **Was:** `c.req.json()` with type assertion — ignored Zod middleware output
- **Fix:** Changed to `c.req.valid('json' as never) as UpdateSettingsData`

### Bug: Frontend used useState instead of React Hook Form
- **Was:** Manual `useState` + `handleChange` + `useEffect` sync — no validation, broken dirty tracking, eslint-disable suppression
- **Fix:** Full rewrite with React Hook Form + Zod + `zodResolver`

### Bug: Inline useQuery/useMutation instead of dedicated hooks
- **Was:** Query/mutation defined inside component
- **Fix:** Created `features/admin/hooks/useCompanySettings.ts` with proper hooks

### Bug: CompanySettings type inlined in page
- **Was:** Interface defined inside the page file
- **Fix:** Created `types/company.types.ts` with shared types

### Bug: Response mapping duplicated in backend
- **Was:** Identical company→camelCase mapping in GET and PATCH controllers
- **Fix:** Extracted `toCompanySettingsResponse()` helper

### Bug: Phantom settings fields never used
- **Was:** `checkInWindowStart`, `checkInWindowEnd`, `reminderTime` in response + validator — not persisted, not displayed
- **Fix:** Removed from backend response and validator

**Files created:**
- `aegira-frontend/src/types/company.types.ts` — `CompanySettings`, `UpdateCompanySettingsData`
- `aegira-frontend/src/features/admin/hooks/useCompanySettings.ts` — `useCompanySettings`, `useUpdateCompanySettings`

**Files changed:**
- `aegira-frontend/src/features/admin/pages/AdminCompanySettingsPage.tsx` — full rewrite (RHF + Zod)
- `aegira-backend/src/modules/admin/admin.controller.ts` — `c.req.valid()`, shared mapper, removed phantom fields
- `aegira-backend/src/modules/admin/admin.validator.ts` — removed phantom fields, added `.trim()` and max lengths

---

## Verification

- Frontend TypeScript: **0 errors**
- Backend TypeScript: **0 new errors** (pre-existing errors in incident/case modules unchanged)
- All changes follow established project patterns per CLAUDE.md
