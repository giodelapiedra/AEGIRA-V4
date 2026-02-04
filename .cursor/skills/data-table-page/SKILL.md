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

## Full Page Template

```typescript
import { useState, useDeferredValue } from 'react';
import { Link } from 'react-router-dom';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Plus, MoreHorizontal, Eye, Edit, Search } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { useFeatures, type Feature } from '../hooks/useFeatures';
import { ROUTES } from '@/config/routes.config';

// 1. Define columns OUTSIDE the component (prevents re-renders)
const columns: ColumnDef<Feature>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? 'success' : 'destructive'}>
        {row.original.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => <SortableHeader column={column}>Created</SortableHeader>,
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={ROUTES.FEATURE_DETAIL.replace(':featureId', row.original.id)}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={ROUTES.ADMIN_FEATURES_EDIT.replace(':featureId', row.original.id)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

// 2. Page component
export function AdminFeaturesPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  // 3. Convert 0-indexed pageIndex to 1-indexed API page
  const { data, isLoading, error } = useFeatures(
    pagination.pageIndex + 1,
    pagination.pageSize,
    true, // includeInactive for admin view
    deferredSearch
  );

  // 4. Reset to first page when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // 5. Calculate page count from PaginatedResponse shape
  const pageCount = data?.pagination
    ? Math.ceil(data.pagination.total / pagination.pageSize)
    : 0;

  // 6. Wrap in PageLoader with skeleton="table"
  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Feature Management"
          description="Create and manage features"
          action={
            <Button asChild>
              <Link to={ROUTES.ADMIN_FEATURES_CREATE}>
                <Plus className="h-4 w-4 mr-2" />
                Add Feature
              </Link>
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>
              All Features ({data?.pagination?.total ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search input */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              {/* DataTable with server-side pagination */}
              <DataTable
                columns={columns}
                data={data?.items ?? []}
                pageCount={pageCount}
                pagination={pagination}
                onPaginationChange={setPagination}
                isLoading={isLoading}
                totalCount={data?.pagination?.total ?? 0}
                emptyMessage="No features found."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLoader>
  );
}
```

## Companion Query Hook

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { PaginatedResponse } from '@/types/common.types';
import type { Feature } from '@/types/feature.types';

export type { Feature };

/**
 * Fetch features with server-side pagination
 */
export function useFeatures(page = 1, limit = 20, includeInactive = false, search = '') {
  return useQuery({
    queryKey: ['features', page, limit, includeInactive, search],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        includeInactive: String(includeInactive),
      });
      if (search) params.set('search', search);
      return apiClient.get<PaginatedResponse<Feature>>(
        `${ENDPOINTS.FEATURE.LIST}?${params.toString()}`
      );
    },
  });
}
```

## PaginatedResponse Shape Reference

The `apiClient` unwraps `response.data` automatically. Hooks receive:

```typescript
// PaginatedResponse<T>
{
  items: T[];
  pagination: {
    page: number;      // Current page (1-indexed)
    limit: number;     // Items per page
    total: number;     // Total item count
    totalPages: number; // Total pages
  };
}
```

Access paths:
- Items: `data?.items ?? []`
- Total count: `data?.pagination?.total ?? 0`
- Page count: `Math.ceil(data.pagination.total / pageSize)` or `data?.pagination?.totalPages`

## DataTable Props Reference

```typescript
<DataTable
  columns={columns}                         // ColumnDef<T>[] — REQUIRED
  data={data?.items ?? []}                  // T[] — REQUIRED, never pass undefined
  pageCount={pageCount}                     // number — total pages for pagination controls
  pagination={pagination}                   // PaginationState — { pageIndex, pageSize }
  onPaginationChange={setPagination}        // (state: PaginationState) => void
  isLoading={isLoading}                     // boolean — shows loading overlay
  totalCount={data?.pagination?.total ?? 0} // number — displayed in footer
  emptyMessage="No items found."            // string — shown when data is empty
/>
```

## Key Rules

- ALWAYS define columns OUTSIDE the component (as `const columns: ColumnDef<T>[]`)
- ALWAYS use `DataTable` from `@/components/ui/data-table` — never build manual pagination
- ALWAYS convert page index: `pagination.pageIndex + 1` (table is 0-indexed, API is 1-indexed)
- ALWAYS use `useDeferredValue` for search to avoid excessive API calls
- ALWAYS reset `pageIndex` to 0 when search/filter changes
- ALWAYS wrap in `PageLoader` with `skeleton="table"`
- ALWAYS use `data?.items ?? []` — never pass undefined to DataTable
- ALWAYS access total from `data?.pagination?.total` (NOT `data?.total`)
- ALWAYS pass `isLoading`, `totalCount`, and `emptyMessage` props to DataTable
- ALWAYS include an actions column with DropdownMenu for row-level operations
- ALWAYS use `ROUTES` constants for navigation links — never hardcode paths
- Build query params with `URLSearchParams` — never concatenate strings
