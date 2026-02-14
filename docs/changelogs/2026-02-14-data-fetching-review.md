# 2026-02-14: Data Fetching Architecture Review — 2 Fixes + 7 False Alarms Documented

## Context

Senior software engineer review of the entire frontend data fetching architecture — API client, TanStack Query hooks, queryKey patterns, cache invalidation, stale times, and backend response shapes. Initial scan flagged 17 potential issues. After deep verification against actual code and TanStack Query behavior, 7 were confirmed as false alarms, 8 were working as designed, and 2 were real issues worth fixing.

---

## Fixes Applied

### FIX-A: `useWorkerCheckIns` staleTime mismatch (P3)
**File:** `aegira-frontend/src/features/team/hooks/useWorkerCheckIns.ts:93`

- Changed `STALE_TIMES.IMMUTABLE` (30min) to `STALE_TIMES.STATIC` (10min)
- Aligns with `useCheckInHistory` which shows the same data type (check-in history) and uses `STATIC`
- Mutations (`useSubmitCheckIn`) already invalidate `['worker-check-ins']` on success, so new check-ins appear immediately regardless — this only affects background staleness

### FIX-B: API client now throws structured `ApiError` instead of plain `Error` (P3)
**File:** `aegira-frontend/src/lib/api/client.ts`

- Added `ApiError` class (exported) extending `Error` with `code` (string) and `statusCode` (number)
- All error throws updated: non-ok responses, session expired (401), and timeouts
- Preserves backend error codes (`VALIDATION_ERROR`, `DUPLICATE_CHECK_IN`, `OUTSIDE_CHECK_IN_WINDOW`, etc.)
- **Backward-compatible**: `ApiError extends Error`, so all existing `error instanceof Error ? error.message : '...'` checks (14+ components) continue to work without changes
- Components can now optionally use `error instanceof ApiError` to access `error.code` for specific error handling

---

## False Alarms Investigated and Dismissed

### 1. "Dashboard invalidation too broad" — ACTUALLY FINE
`invalidateQueries({ queryKey: ['dashboard'] })` in mutations. TanStack Query only refetches **active (mounted)** queries. If only worker dashboard is open, only `['dashboard', 'worker']` triggers a network request. Unmounted role dashboards just get marked stale — no wasted requests.

### 2. "useTeamLeads hardcoded limit not in queryKey" — ACTUALLY FINE
`limit: '100'` is a static constant, not a dynamic parameter. QueryKeys only need values that change cache identity. Since limit never changes, omitting it is correct.

### 3. "Incident approval missing `['case']` invalidation" — ACTUALLY FINE
`useApproveIncident` invalidates `['cases']` (list) which covers the list page. Approving creates a NEW case — user can't have that case's detail page open yet. `useRejectIncident` correctly doesn't invalidate cases since rejection doesn't create cases.

### 4. "Session staleTime too long" — NOT APPLICABLE
Auth state uses **Zustand** (`useAuthStore`), not TanStack Query. There's no `useSession` query to tune. Auth state updates immediately on `setAuth()`.

### 5. "Notification polling too heavy" — DESIGN CHOICE
30s polling is standard for apps without WebSockets. TanStack Query deduplicates — multiple components using `useUnreadCount` make only 1 request per interval. Tab visibility API pauses polling on inactive tabs.

### 6. "QueryKey structure inconsistent" — ACTUALLY CONSISTENT
After listing all 30+ queryKeys, the pattern is deliberate:
- Plural for lists: `['teams', page, ...]`, `['incidents', page, ...]`
- Singular for details: `['team', id]`, `['incident', id]`
- Prefixed for scoped views: `['worker-check-ins', personId, ...]`
- Nested for relations: `['team', id, 'members', page, ...]`

### 7. "Backend snake_case vs camelCase inconsistency" — INTENTIONAL
- CRUD endpoints return snake_case (raw Prisma passthrough)
- Dashboard/analytics endpoints return camelCase (service-built aggregated objects)
- Team check-in history returns camelCase (controller-transformed)
- Frontend handles both correctly with per-hook transforms (`BackendCheckIn` → `CheckIn`)

---

## Architecture Verdict

The data fetching architecture is **well-aligned with TanStack Query best practices** and internally consistent. Key strengths confirmed:

- Proper `keepPreviousData` on all paginated queries
- `enabled: !!id` guards on all ID-dependent queries
- Well-tiered `STALE_TIMES` constants (REALTIME/STANDARD/STATIC/IMMUTABLE)
- Comprehensive mutation invalidation covering list + detail + related queries
- Clean API client with auto-unwrap, 401 redirect, timeout, and FormData support
- Auth state correctly separated (Zustand for client state, TanStack Query for server state)
