import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Eye, Search } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePersons, type Person } from '@/features/person/hooks/usePersons';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';
import { ROLE_LABELS } from '@/lib/utils/format.utils';

const getColumns = (onView: (person: Person) => void): ColumnDef<Person>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Worker</SortableHeader>,
    cell: ({ row }) => {
      const person = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
            {person.first_name.charAt(0)}{person.last_name.charAt(0)}
          </div>
          <div>
            <p className="font-medium">{person.first_name} {person.last_name}</p>
            <p className="text-sm text-muted-foreground">{person.email}</p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => (
      <Badge variant="outline">{ROLE_LABELS[row.original.role]}</Badge>
    ),
  },
  {
    accessorKey: 'team',
    header: 'Team',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.team?.name || 'Unassigned'}
      </span>
    ),
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
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onView(row.original)}
      >
        <Eye className="h-4 w-4 mr-1" />
        View
      </Button>
    ),
  },
];

export function WhsWorkersPage() {
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = usePersons(
    pagination.pageIndex + 1,
    pagination.pageSize,
    false, // includeInactive
    search
  );

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleView = useCallback((person: Person) => {
    navigate(
      buildRoute(ROUTES.TEAM_WORKER_DETAIL, { workerId: person.id }),
      { state: { member: person } }
    );
  }, [navigate]);

  const columns = useMemo(() => getColumns(handleView), [handleView]);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Workers"
          description="View all workers for incident reference and safety oversight"
        />

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="max-w-sm"
          />
          <Button onClick={handleSearch} variant="secondary">
            <Search className="h-4 w-4 mr-1" />
            Search
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          pageCount={data?.pagination?.totalPages}
          pagination={pagination}
          onPaginationChange={setPagination}
          totalCount={data?.pagination?.total}
          emptyMessage="No workers found."
        />
      </div>
    </PageLoader>
  );
}
