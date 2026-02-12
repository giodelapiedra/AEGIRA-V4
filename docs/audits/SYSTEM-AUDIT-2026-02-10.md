# AEGIRA V5 - Full System Architecture & Code Quality Audit

**Audit Date:** February 10, 2026
**Auditor:** Senior Software Engineer (QA)
**Scope:** Full-stack review — Backend, Frontend, Security, Business Logic, Data Integrity
**Model:** Claude Opus 4.6

---

## Executive Summary

AEGIRA V5 is a well-architected multi-tenant workforce readiness system. The audit covered both `aegira-backend/` and `aegira-frontend/` codebases. **9 actionable issues were identified and fixed**, spanning security, bugs, and code quality.

**Overall Assessment:** Solid codebase with strong type safety (zero `any` types), consistent multi-tenant isolation, proper event sourcing, and clean separation of concerns.

---

## Fixes Applied

### Security Fixes

#### S-1. Logout Cache Leak — Data Leakage Risk (FIXED)
**File:** `src/features/auth/hooks/useLogout.ts`
**Problem:** The `onSuccess` handler selectively removed query caches by key, missing `my-incidents`, `incidents`, `cases`, `worker-check-ins`, `worker-missed-check-ins`, and `team` (singular). On shared workstations, one user could see stale cached data from a previous user.
**Fix:** Replaced selective `removeQueries` calls with `queryClient.removeQueries()` (no args) to clear ALL cached data on logout success. The `onError` handler already did this correctly.

#### S-2. Cross-Tenant Login Scope (FIXED)
**File:** `aegira-backend/src/modules/auth/auth.controller.ts`
**Problem:** Login uses `findFirst({ where: { email } })` without `company_id` filter. The DB constraint is `@@unique([company_id, email])`, meaning the same email CAN exist in two companies. If duplicates exist, `findFirst` returns non-deterministically.
**Fix:** Added `orderBy: { created_at: 'desc' }` for deterministic behavior and documented the assumption with a detailed comment. The deeper fix (global unique constraint) requires a schema migration.

#### S-3. Stub Refresh Token Route — Attack Surface (FIXED)
**Files:** `aegira-backend/src/modules/auth/auth.controller.ts`, `aegira-backend/src/modules/auth/auth.routes.ts`
**Problem:** Refresh token was a stub returning empty data on an **unprotected** route. Logout was also unprotected.
**Fix:** Protected both `/refresh` and `/logout` routes with `authMiddleware`. Changed the refresh stub to throw `AppError('NOT_IMPLEMENTED', ..., 501)` instead of returning fake success.
**Verified:** Frontend API client already lists `ENDPOINTS.AUTH.LOGOUT` in `AUTH_ENDPOINTS` (no hard redirect on 401), so if the user's token is expired when clicking logout, the `onError` handler in `useLogout` correctly clears state + redirects to login. No regression from adding `authMiddleware` to logout.

### Bug Fixes

#### B-1. Streak Off-By-One in Worker Dashboard (FIXED)
**File:** `aegira-backend/src/modules/dashboard/dashboard.service.ts`
**Problem:** Streak calculation started from `i=0` (today), causing inconsistency: if the worker hadn't checked in yet today, today was silently skipped. But if they had checked in, today was counted. The missed-check-in snapshot service correctly started from `i=1`.
**Fix:** Changed streak to start from `i=1` (yesterday) and count backwards. Then explicitly add today to the streak only if the worker has already checked in today.

#### B-2. Hardcoded `navigate()` Paths in Incident Pages (FIXED)
**Files:**
- `src/features/incident/pages/AdminIncidentsPage.tsx`
- `src/features/incident/pages/AdminCasesPage.tsx`
- `src/features/incident/pages/MyIncidentsPage.tsx`
- `src/features/incident/pages/CaseDetailPage.tsx`

**Problem:** Four files used hardcoded route strings like `` navigate(`/admin/incidents/${id}`) `` instead of `ROUTES` constants.
**Fix:** Replaced all hardcoded paths with `ROUTES.ADMIN_INCIDENT_DETAIL.replace(':id', id)`, `ROUTES.ADMIN_CASE_DETAIL.replace(':id', id)`, and `ROUTES.INCIDENT_DETAIL.replace(':id', id)`. Added `ROUTES` import where missing.

#### B-3. Notification Load-More Replaces Instead of Accumulating (FIXED)
**File:** `src/features/notifications/pages/NotificationsPage.tsx`
**Problem:** Clicking "Load more" incremented `page` from 1 to 2, but `data?.items` only contained page 2's items. The UI replaced the list instead of appending. The button text said "N remaining" implying accumulation.
**Fix:** Added a `useRef<Map<string, Notification[][]>>` to accumulate items per page. Each page's items are stored at the correct index, and the full list is built by flattening all pages. Tab changes reset the accumulated data. Also fixed `useCallback` dependency from unstable `markAsRead` to stable `markAsRead.mutateAsync`.

#### B-4. Unweighted Average Readiness in Supervisor Dashboard (FIXED)
**File:** `aegira-backend/src/modules/dashboard/dashboard.service.ts`
**Problem:** `overallAvgReadiness` averaged team averages without weighting by check-in count. A team with 50 check-ins got the same weight as a team with 2.
**Fix:** Changed to compute directly from raw `checkInsByPerson` array (already available in scope) — a proper weighted average based on individual check-in scores.

### Code Quality Fixes

#### CS-1. Memoize `getColumns()` Calls (FIXED)
**Files:**
- `src/features/team/components/MemberMissedCheckInTable.tsx`
- `src/features/dashboard/pages/WhsWorkersPage.tsx`

**Problem:** `getColumns()` was called on every render without `useMemo`, creating a new columns array each time and causing unnecessary DataTable re-renders.
**Fix:** Wrapped with `useMemo`. In `WhsWorkersPage`, also wrapped `handleView` with `useCallback` since it's a dependency of the memoized columns.

#### CS-5. Hardcoded `/login` in API Client (FIXED)
**File:** `src/lib/api/client.ts`
**Problem:** `window.location.href = '/login'` hardcoded instead of using `ROUTES.LOGIN`.
**Fix:** Imported `ROUTES` from `@/config/routes.config` and replaced the hardcoded string.

### Bonus Fix

#### Pre-existing: Unused `Badge` Import (FIXED)
**File:** `src/features/team/pages/TeamCheckInHistoryPage.tsx`
**Problem:** Unused `Badge` import caused TypeScript strict mode error.
**Fix:** Removed the unused import.

---

## Build Verification

After all fixes:
```
npx tsc --noEmit  →  0 errors
```

---

## Findings NOT Fixed (Noted for Future)

These items were identified but not fixed in this audit, as they require larger refactoring:

| ID | Category | Description | Effort |
|----|----------|-------------|--------|
| D-1 | Design Flaw | Inline `useQuery` in 6+ page components instead of dedicated hooks | Medium |
| D-2 | Design Flaw | Catch-all route creates double-redirect for unauthenticated users | Low |
| CS-2 | Code Smell | Duplicate 170-line missed check-in detail sheet in 2 files | Medium |
| CS-3 | Code Smell | Inline search UI in 2 pages instead of `TableSearch` component | Low |
| CS-4 | Code Smell | Duplicate `transformCheckIn` logic in 2 hooks | Low |
| CS-6 | Code Smell | Hardcoded `gray-*` colors in auth pages and UI components | Medium |
| CS-7 | Code Smell | Inline type definitions in `TeamCheckInHistoryPage` | Low |
| CS-8 | Code Smell | Unsafe `as` type casts in tab/filter handlers | Low |
| SG-1 | Suggestion | `useWhsOfficers` makes 2 API calls instead of 1 | Low |
| S-5 | Security | No password complexity enforcement beyond min-length | Low |

---

## Positive Observations

| Area | Assessment |
|------|-----------|
| Multi-Tenant Isolation | `BaseRepository.where()` enforces `company_id`. `tenantMiddleware` validates company status. |
| Auth Security | httpOnly cookies, SameSite=Strict, bcrypt 12 rounds, no tokens in localStorage. |
| Input Validation | Zod schemas on all write endpoints. |
| Error Handling | Centralized `AppError`, proper HTTP status codes. |
| Event Sourcing | All state changes create `Event` records inside transactions. |
| SQL Injection | Zero risk — Prisma parameterizes all queries. |
| Race Conditions | TOCTOU-safe check-in (unique constraint in DB). Idempotent missed-check-in detection. |
| TypeScript | Zero `any` types across entire codebase. |
| N+1 Prevention | Dashboard and supervisor endpoints use batch queries and groupBy. |
| Password Safety | `SAFE_PERSON_SELECT` excludes `password_hash` from all read queries. |

---

## Files Modified

### Frontend (`aegira-frontend/`)
| File | Change |
|------|--------|
| `src/features/auth/hooks/useLogout.ts` | Clear all query cache on logout |
| `src/lib/api/client.ts` | Use `ROUTES.LOGIN` instead of hardcoded `/login` |
| `src/features/incident/pages/AdminIncidentsPage.tsx` | Use `ROUTES` constants for navigation |
| `src/features/incident/pages/AdminCasesPage.tsx` | Use `ROUTES` constants for navigation |
| `src/features/incident/pages/MyIncidentsPage.tsx` | Use `ROUTES` constants for navigation |
| `src/features/incident/pages/CaseDetailPage.tsx` | Use `ROUTES` constants for navigation |
| `src/features/notifications/pages/NotificationsPage.tsx` | Fix load-more accumulation + useCallback deps |
| `src/features/team/components/MemberMissedCheckInTable.tsx` | Memoize `getColumns()` |
| `src/features/dashboard/pages/WhsWorkersPage.tsx` | Memoize `getColumns()` + `useCallback` for handler |
| `src/features/team/pages/TeamCheckInHistoryPage.tsx` | Remove unused `Badge` import |

### Backend (`aegira-backend/`)
| File | Change |
|------|--------|
| `src/modules/auth/auth.controller.ts` | Deterministic login query + proper refresh token error |
| `src/modules/auth/auth.routes.ts` | Protect refresh + logout with `authMiddleware` |
| `src/modules/dashboard/dashboard.service.ts` | Fix streak off-by-one + weighted avg readiness |
