import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MoreVertical, Eye } from 'lucide-react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { TableSearch } from '@/components/common/TableSearch';
import { RoleBadge } from '@/components/common/RoleBadge';
import { usePersons, Person } from '../hooks/usePersons';
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
    header: 'Email',
    cell: ({ row }) => row.original.email,
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => <RoleBadge role={row.original.role} />,
  },
  {
    accessorKey: 'team',
    header: 'Team',
    cell: ({ row }) =>
      row.original.team?.name || <span className="text-muted-foreground">-</span>,
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? 'success' : 'secondary'}>
        {row.original.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Person actions menu">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={buildRoute(ROUTES.PERSON_DETAIL, { personId: row.original.id })}>
              <Eye className="h-4 w-4 mr-2" />
              View Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>Edit Person</DropdownMenuItem>
          <DropdownMenuItem>View Check-Ins</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            Deactivate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export function PersonsPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = usePersons(
    pagination.pageIndex + 1,
    pagination.pageSize,
    false,
    search
  );

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="People"
          description="Manage employees and their roles"
          action={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Person
            </Button>
          }
        />

        {/* Search */}
        <TableSearch
          placeholder="Search by name or email..."
          value={searchInput}
          onChange={setSearchInput}
          onSearch={handleSearch}
        />

        {/* Persons Table */}
        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={data?.items ?? []}
              pageCount={data?.pagination?.totalPages}
              pagination={pagination}
              onPaginationChange={setPagination}
              emptyMessage={
                search
                  ? 'No people found. Try a different search term.'
                  : 'No people yet. Add your first employee to get started.'
              }
            />
          </CardContent>
        </Card>
      </div>
    </PageLoader>
  );
}
