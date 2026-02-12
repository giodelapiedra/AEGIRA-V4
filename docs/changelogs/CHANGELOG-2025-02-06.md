# AEGIRA Frontend - Code Quality Improvements

**Date:** February 6, 2025
**Author:** Senior Software Engineer Code Review
**Scope:** Search Pattern Optimization + Query Hook Consistency

---

## Summary

This document records code quality improvements made to ensure consistent patterns across the AEGIRA frontend codebase.

### Changes Made

| Category | Files Changed | Impact |
|----------|---------------|--------|
| Search Pattern | 8 pages | Reduced unnecessary API calls |
| Query Hook Pattern | 3 hooks | Smoother pagination UX |

---

## 1. Search Pattern Optimization

### Problem

Several pages were using `useDeferredValue` for search, which does NOT prevent API calls on every keystroke - it only defers rendering priority. This caused unnecessary database queries.

### Solution

Implemented **explicit search pattern** - API calls only fire when user presses Enter or clicks Search button.

### Pattern

```typescript
// BEFORE (fires API on every keystroke)
const [search, setSearch] = useState('');
const deferredSearch = useDeferredValue(search);

// AFTER (fires API only on explicit action)
const [searchInput, setSearchInput] = useState('');  // Input field state
const [search, setSearch] = useState('');             // Query parameter state

const handleSearch = () => {
  setSearch(searchInput.trim());
  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
};

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleSearch();
  }
};
```

### Files Updated

| File | Location |
|------|----------|
| `AdminWorkersPage.tsx` | `src/features/admin/pages/` |
| `TeamsPage.tsx` | `src/features/team/pages/` |
| `PersonsPage.tsx` | `src/features/person/pages/` |
| `AdminIncidentsPage.tsx` | `src/features/incident/pages/` |
| `AdminCasesPage.tsx` | `src/features/incident/pages/` |
| `AdminAuditLogsPage.tsx` | `src/features/admin/pages/` |
| `TeamCheckInHistoryPage.tsx` | `src/features/team/pages/` |
| `AdminTeamsPage.tsx` | `src/features/admin/pages/` |

### Reference Implementation

`WhsWorkersPage.tsx` was already using the correct pattern and served as the reference.

---

## 2. Query Hook Pattern Fix: `keepPreviousData`

### Problem

Some paginated query hooks were missing `placeholderData: keepPreviousData`, causing the UI to show loading spinners on every page change instead of keeping the previous data visible during fetch.

### Solution

Added `keepPreviousData` to all paginated query hooks for smoother UX.

### Pattern

```typescript
import { useQuery, keepPreviousData } from '@tanstack/react-query';

export function usePaginatedData(page: number, limit: number) {
  return useQuery({
    queryKey: ['data', page, limit],
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,  // <-- Required for paginated queries
    queryFn: async () => { ... },
  });
}
```

### Files Updated

| File | Location |
|------|----------|
| `useMyIncidents.ts` | `src/features/incident/hooks/` |
| `useWorkerMissedCheckIns.ts` | `src/features/team/hooks/` |
| `useWorkerCheckIns.ts` | `src/features/team/hooks/` |

---

## 3. Patterns Already Correct (No Changes Needed)

### Backend Patterns ✅

| Pattern | Status | Description |
|---------|--------|-------------|
| Parallel Queries | ✅ Correct | All use `Promise.all([findMany, count])` |
| Select Optimization | ✅ Correct | All queries use `select` for specific fields |
| Search Pattern | ✅ Correct | Uses `startsWith` for names, `contains` for text |
| Pagination | ✅ Correct | Server-side with `skip` + `take` |
| Multi-tenant | ✅ Correct | All queries scoped by `company_id` |

### Frontend Patterns ✅

| Pattern | Status | Description |
|---------|--------|-------------|
| STALE_TIMES | ✅ Correct | All hooks use constants from `query.config.ts` |
| enabled guard | ✅ Correct | All single-entity queries have `enabled: !!id` |
| queryKey completeness | ✅ Correct | All params included in queryKey |
| Cache invalidation | ✅ Correct | All mutations invalidate related queries |

---

## 4. Server-Side Pagination Verification

Confirmed that pagination is **properly server-side**:

```typescript
// Repository Pattern (person.repository.ts)
const [items, total] = await Promise.all([
  this.prisma.person.findMany({
    where,
    skip: calculateSkip(params),  // SQL OFFSET
    take: params.limit,           // SQL LIMIT
    orderBy: { last_name: 'asc' },
  }),
  this.prisma.person.count({ where }),
]);
```

**Result:** Database only returns requested number of rows (e.g., 20), NOT all rows.

---

## 5. Established Patterns Reference

### Search Pattern (Pages)

```typescript
// Two separate states
const [searchInput, setSearchInput] = useState('');
const [search, setSearch] = useState('');

// Explicit search handler
const handleSearch = () => {
  setSearch(searchInput.trim());
  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
};

// Input with Enter key support
<Input
  value={searchInput}
  onChange={(e) => setSearchInput(e.target.value)}
  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
/>
<Button onClick={handleSearch} variant="secondary">
  <Search className="h-4 w-4 mr-1" />
  Search
</Button>
```

### Paginated Query Hook Pattern

```typescript
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { STALE_TIMES } from '@/config/query.config';

export function useItems(page = 1, limit = 20, search = '') {
  return useQuery({
    queryKey: ['items', page, limit, search],  // Include ALL params
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: keepPreviousData,          // Smooth pagination
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set('search', search);
      return apiClient.get<PaginatedResponse<Item>>(
        `${ENDPOINTS.ITEMS.LIST}?${params.toString()}`
      );
    },
  });
}
```

### Single Entity Query Hook Pattern

```typescript
export function useItem(itemId: string) {
  return useQuery({
    queryKey: ['item', itemId],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () => apiClient.get<Item>(ENDPOINTS.ITEMS.BY_ID(itemId)),
    enabled: !!itemId,  // Guard against empty ID
  });
}
```

---

## 6. Future Improvements (Not Yet Implemented)

### Code Organization - Inline Hooks to Extract

| Page | Should Extract To |
|------|-------------------|
| `AdminHolidaysPage.tsx` | `useHolidays.ts` |
| `AdminAuditLogsPage.tsx` | `useAuditLogs.ts` |
| `AdminCompanySettingsPage.tsx` | `useCompanySettings.ts` |
| `AdminSystemHealthPage.tsx` | `useSystemHealth.ts` |

### Optional Optimizations (If Needed for Scale)

| Optimization | When to Consider |
|--------------|------------------|
| Prefetching on hover | If detail page load feels slow |
| Redis caching | If dashboard queries are slow (100k+ records) |
| Cursor pagination | If deep pagination (page 100+) is slow |
| Full-text search (GIN) | If LIKE search is slow on large datasets |

---

## Verification

All changes maintain:
- TypeScript strict mode compliance
- Existing API contracts unchanged
- No breaking changes to components
- Consistent with CLAUDE.md guidelines
