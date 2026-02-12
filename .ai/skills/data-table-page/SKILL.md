---
name: data-table-page
description: Generate a paginated table page for AEGIRA frontend. Use when creating list pages with server-side pagination using DataTable, PaginationState, and ColumnDef.
---
# Data Table Page

Paginated list page using `DataTable` component with server-side pagination.

## File Structure

```
aegira-frontend/src/features/<feature>/
├── pages/
│   └── Admin<Feature>sPage.tsx       # List page with DataTable
└── hooks/
    └── use<Feature>s.ts              # Query + mutation hooks (grouped)
```

## Data Table Page Pattern

<!-- @pattern: frontend/data-table-pattern -->

## Companion Query Hook Pattern

<!-- @pattern: frontend/query-hooks -->

## Response Format Reference

<!-- @pattern: shared/response-format -->

## Checklist

- [ ] Columns defined OUTSIDE the component as `const columns: ColumnDef<T>[]`
- [ ] Uses `DataTable` from `@/components/ui/data-table`
- [ ] Converts page index: `pagination.pageIndex + 1` (table 0-indexed, API 1-indexed)
- [ ] Uses `useDeferredValue` for search to avoid excessive API calls
- [ ] Resets `pageIndex` to 0 when search/filter changes
- [ ] Wrapped in `PageLoader` with `skeleton="table"`
- [ ] Uses `data?.items ?? []` (never passes undefined)
- [ ] Accesses total from `data?.pagination?.total`
- [ ] Passes `isLoading`, `totalCount`, and `emptyMessage` to DataTable
- [ ] Actions column with DropdownMenu for row-level operations
- [ ] Uses `ROUTES` constants for navigation links
