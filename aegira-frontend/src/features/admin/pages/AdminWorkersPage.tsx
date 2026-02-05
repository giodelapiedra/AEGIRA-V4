import { useState, useDeferredValue, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { UserCircle, Plus, Edit, Search } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { RoleBadge } from '@/components/common/RoleBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { usePersons, Person } from '@/features/person/hooks/usePersons';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

const columns: ColumnDef<Person>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }) => (
      <div className="font-medium">
        {row.original.first_name} {row.original.last_name}
      </div>
    ),
  },
  {
    accessorKey: 'email',
    header: ({ column }) => <SortableHeader column={column}>Email</SortableHeader>,
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => <RoleBadge role={row.original.role} />,
  },
  {
    accessorKey: 'team',
    header: 'Team',
    cell: ({ row }) => row.original.team?.name || '-',
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
    header: ({ column }) => <SortableHeader column={column}>Account Created</SortableHeader>,
    cell: ({ row }) =>
      new Date(row.original.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Button variant="ghost" size="icon" asChild>
        <Link to={buildRoute(ROUTES.ADMIN_WORKERS_EDIT, { workerId: row.original.id })}>
          <Edit className="h-4 w-4" />
        </Link>
      </Button>
    ),
  },
];

export function AdminWorkersPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const { data: personsData, isLoading, error } = usePersons(
    pagination.pageIndex + 1, // API uses 1-based index
    pagination.pageSize,
    true, // includeInactive for admin view
    deferredSearch
  );

  // Reset pagination when deferred search changes (not on every keystroke)
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [deferredSearch]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  const persons = personsData?.items || [];
  const pageCount = personsData?.pagination
    ? Math.ceil(personsData.pagination.total / pagination.pageSize)
    : 0;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
    <div className="space-y-6">
      <PageHeader
        title="Worker Management"
        description="Create and manage workers"
        action={
          <Button asChild>
            <Link to={ROUTES.ADMIN_WORKERS_CREATE}>
              <Plus className="h-4 w-4 mr-2" />
              Add Worker
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            All Workers ({personsData?.pagination?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <DataTable
              columns={columns}
              data={persons}
              pageCount={pageCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              isLoading={isLoading}
              totalCount={personsData?.pagination?.total || 0}
              emptyMessage="No workers found. Add your first worker to get started."
            />
          </div>
        </CardContent>
      </Card>
    </div>
    </PageLoader>
  );
}
