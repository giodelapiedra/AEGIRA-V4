---
description: DataTable Patterns for AEGIRA Frontend (Paginated Tables)
globs: ["aegira-frontend/src/**/*.tsx"]
alwaysApply: false
---
# Data Table Page

Paginated list page using `DataTable` component with server-side pagination.

## File Structure

```
aegira-frontend/src/features/<feature>/
├── pages/
│   └── <Feature>ListPage.tsx
└── hooks/
    └── use<Feature>s.ts
```

## Full Page Template

```typescript
import { useState } from 'react';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { useFeatures } from '../hooks/useFeatures';
import type { Feature } from '@/types/feature.types';

// 1. Define columns OUTSIDE the component (prevents re-renders)
const columns: ColumnDef<Feature>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? 'success' : 'secondary'}>
        {row.original.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => <SortableHeader column={column}>Created</SortableHeader>,
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
];

// 2. Page component with PaginationState (0-indexed)
export function FeatureListPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // 3. Convert to 1-indexed for API
  const { data, isLoading, error } = useFeatures({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  });

  const items = data?.items ?? [];
  const pageCount = data?.totalPages ?? 0;

  // 4. Wrap in PageLoader with skeleton="table"
  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Features"
          description="Manage your features"
        />

        <Card>
          <CardHeader>
            <CardTitle>All Features ({data?.total ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={items}
              pageCount={pageCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              isLoading={isLoading}
              emptyMessage="No features found."
            />
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

interface UseFeaturesParams {
  page?: number;
  pageSize?: number;
}

export function useFeatures({ page = 1, pageSize = 10 }: UseFeaturesParams = {}) {
  return useQuery({
    queryKey: ['features', page, pageSize],
    staleTime: STALE_TIMES.STANDARD,
    queryFn: () =>
      apiClient.get(`${ENDPOINTS.FEATURE.LIST}?page=${page}&limit=${pageSize}`),
  });
}
```

## Key Rules

- ALWAYS define columns OUTSIDE the component
- ALWAYS use `DataTable` from `@/components/ui/data-table`
- ALWAYS convert page index: `page: pagination.pageIndex + 1` (API is 1-indexed)
- ALWAYS wrap in `PageLoader` with `skeleton="table"`
- ALWAYS provide `emptyMessage` prop
- ALWAYS reset `pageIndex` to 0 when search/filter changes
- NEVER build custom pagination buttons
