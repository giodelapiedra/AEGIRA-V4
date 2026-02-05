# AEGIRA Frontend - Code Review Findings

> **Review Date**: 2026-02-05
> **Scope**: Deep code inspection ng actual source files
> **Focus**: Pattern violations, bugs, security issues, performance problems
> **Last Updated**: 2026-02-05 (CRITICAL + HIGH issues fixed)

---

## Summary

| Severity | Count | Fixed | Remaining |
|----------|:-----:|:-----:|:---------:|
| CRITICAL | 1 | 1 | 0 |
| HIGH | 4 | 4 | 0 |
| MEDIUM | 6 | 1 | 5 |
| LOW | 4 | 0 | 4 |

---

## CRITICAL Issues

### 1. Hardcoded Navigation URL ✅ FIXED
**File**: `src/features/incident/pages/IncidentDetailPage.tsx:225`

```typescript
// FIXED - now uses buildRoute with ROUTES constant
onClick={() => navigate(buildRoute(ROUTES.ADMIN_CASE_DETAIL, { id: incident.caseId! }))}
```

**Fix Applied**: Added `buildRoute` import and replaced hardcoded URL with ROUTES constant.

---

## HIGH Severity Issues

### 2. TeamsPage - Client-side Filtering Only (NO PAGINATION) ✅ FIXED
**File**: `src/features/team/pages/TeamsPage.tsx`

**Fix Applied**: Complete refactor to use DataTable with server-side pagination:
- Added `PaginationState` with `useState`
- Uses `useDeferredValue` for search (prevents race condition)
- Uses `useEffect` to reset pagination when search changes
- Server-side search via `useTeams(page, limit, includeInactive, search)`
- Proper column factory pattern with `getColumns()`

---

### 3. Missing URL Encoding in buildRoute ✅ FIXED
**File**: `src/lib/utils/route.utils.ts:1-6`

**Fix Applied**: Added `encodeURIComponent()` to parameter values:
```typescript
export function buildRoute(route: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)),
    route
  );
}
```

---

### 4. Race Condition sa AdminWorkersPage Search ✅ FIXED
**File**: `src/features/admin/pages/AdminWorkersPage.tsx:78-90`

**Fix Applied**: Pagination now resets via `useEffect` when `deferredSearch` changes:
```typescript
useEffect(() => {
  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
}, [deferredSearch]);

const handleSearchChange = (value: string) => {
  setSearch(value);
  // No more instant pagination reset here
};
```

---

### 5. Silent Error Handling sa API Client ✅ FIXED
**File**: `src/lib/api/client.ts:44-45`

**Fix Applied**: Added error logging in development mode:
```typescript
const errorBody = await response.json().catch((parseError) => {
  if (import.meta.env.DEV) {
    console.error('[APIClient] Failed to parse error response:', parseError);
  }
  return { error: { message: response.statusText } };
});
```

---

## MEDIUM Severity Issues

### 6. TeamsPage - Hindi gumagamit ng DataTable ✅ FIXED
**File**: `src/features/team/pages/TeamsPage.tsx`

**Fix Applied**: Refactored to use `DataTable` component with proper column factory pattern. (Fixed together with Issue #2)

---

### 7. Uncontrolled refetchInterval sa useCheckInStatus
**File**: `src/features/check-in/hooks/useCheckInStatus.ts:25-32`

```typescript
refetchInterval: 60000,  // Runs kahit naka-ibang tab yung user
```

**Fix**: Add condition para hindi mag-poll kung hindi active:
```typescript
refetchInterval: (query) => (document.visibilityState === 'visible' ? 60000 : false),
```

---

### 8. Mutation Error Hindi Nag-revert ng UI State
**File**: `src/features/team/pages/MissedCheckInsPage.tsx:170-185`

```typescript
const handleStatusUpdate = async (id: string, status: MissedCheckInStatus) => {
  try {
    await updateMutation.mutateAsync({ id, status });
    toast({ variant: 'success', ... });
  } catch (error) {
    toast({ variant: 'destructive', ... });
    // UI still shows wrong value!
  }
};
```

Kung mag-fail yung mutation, yung dropdown nag-update na sa UI pero hindi na-revert. Need optimistic update with rollback.

---

### 9. IncidentDetailPage Header Outside PageLoader
**File**: `src/features/incident/pages/IncidentDetailPage.tsx:87-107`

Per CLAUDE.md pattern: `PageLoader → content`. Pero dito may content na gumagamit ng `incident` data na naka-render before PageLoader. Causes layout shift.

---

### 10. CheckInPage Hindi Nag-pass ng Error to PageLoader
**File**: `src/features/check-in/pages/CheckInPage.tsx:267`

```typescript
<PageLoader isLoading={isLoading} error={null} skeleton="check-in">
```

Always `null` ang error kahit may error sa hooks. Dapat i-pass yung actual error.

---

### 11. Conflicting Abort Handling
**File**: `src/lib/api/client.ts:50-54`

Kung mag-timeout yung request pero na-resolve na yung fetch, pwedeng magkaroon ng double error state.

---

## LOW Severity Issues

### 12. Multiple useSession Calls per Route Change
**File**: `src/routes/RouteGuard.tsx:13`

Every route change, nag-trigger ng API call. Consider caching or hydrating from store on init.

### 13. Unused useDeferredValue
**File**: `src/features/admin/pages/AdminWorkersPage.tsx:1`

Import is there pero yung behavior is negated by immediate pagination reset.

### 14. Missing Error Message Display sa Textarea
**File**: `src/features/check-in/components/CheckInFormComplete.tsx:508-527`

Notes textarea error message rendered outside the component. Inconsistent sa ibang form fields.

### 15. Redundant Variable in MemberMissedCheckInTable
**File**: `src/features/team/components/MemberMissedCheckInTable.tsx:106`

Minor code smell lang, not critical.

---

## Priority Fix Order

### Immediate (Today) ✅ DONE
1. ~~**Issue #1** - Fix hardcoded URL in IncidentDetailPage~~ ✅
2. ~~**Issue #3** - Add URL encoding to buildRoute~~ ✅

### This Week ✅ DONE
3. ~~**Issue #2** - Refactor TeamsPage to use DataTable with pagination~~ ✅
4. ~~**Issue #4** - Fix race condition in AdminWorkersPage search~~ ✅
5. ~~**Issue #5** - Add error logging to API client~~ ✅
6. ~~**Issue #6** - TeamsPage DataTable~~ ✅ (fixed with #2)

### Next Sprint (Remaining)
- **Issue #7** - Uncontrolled refetchInterval
- **Issue #8** - Mutation error UI state
- **Issue #9** - Header outside PageLoader
- **Issue #10** - CheckInPage error prop
- **Issue #11** - Conflicting abort handling
- **Issue #12-15** - Low severity items

---

## Files Fixed

| File | Issues Fixed |
|------|--------------|
| `src/features/incident/pages/IncidentDetailPage.tsx` | #1 ✅ |
| `src/lib/utils/route.utils.ts` | #3 ✅ |
| `src/features/team/pages/TeamsPage.tsx` | #2, #6 ✅ |
| `src/features/admin/pages/AdminWorkersPage.tsx` | #4 ✅ |
| `src/lib/api/client.ts` | #5 ✅ |

## Files Remaining

| File | Issues |
|------|--------|
| `src/features/incident/pages/IncidentDetailPage.tsx` | #9 |
| `src/lib/api/client.ts` | #11 |
| `src/features/team/pages/MissedCheckInsPage.tsx` | #8 |
| `src/features/check-in/hooks/useCheckInStatus.ts` | #7 |
| `src/features/check-in/pages/CheckInPage.tsx` | #10 |
