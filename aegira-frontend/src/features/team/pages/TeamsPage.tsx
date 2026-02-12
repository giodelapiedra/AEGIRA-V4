import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Users, Plus, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useTeams, type Team } from '@/features/team/hooks/useTeams';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

// Columns defined outside component to prevent re-renders
const getColumns = (
  onNavigate: (teamId: string) => void
): ColumnDef<Team>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Team Name</SortableHeader>,
    cell: ({ row }) => (
      <div
        className="cursor-pointer hover:text-primary"
        onClick={() => onNavigate(row.original.id)}
      >
        <p className="font-medium">{row.original.name}</p>
        {row.original.description && (
          <p className="text-sm text-muted-foreground">{row.original.description}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: '_count.members',
    header: 'Members',
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original._count?.members || 0}</Badge>
    ),
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
    header: '',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Team actions menu">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onNavigate(row.original.id)}>
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onNavigate(row.original.id)}>
            Edit Team
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onNavigate(row.original.id)}>
            Manage Members
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            Delete Team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export function TeamsPage() {
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Server-side pagination and search
  const { data, isLoading, error } = useTeams(
    pagination.pageIndex + 1, // API uses 1-based index
    pagination.pageSize,
    false, // includeInactive
    search
  );

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Memoize to prevent unnecessary re-renders
  const handleNavigate = useCallback(
    (teamId: string) => {
      navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId }));
    },
    [navigate]
  );

  const teams = data?.items || [];
  const pageCount = data?.pagination?.totalPages || 0;
  const totalCount = data?.pagination?.total || 0;

  // Memoize columns since they depend on handleNavigate
  const columns = useMemo(() => getColumns(handleNavigate), [handleNavigate]);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Teams"
          description="Manage your teams and team members"
          action={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Teams ({totalCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <TableSearch
                placeholder="Search teams..."
                value={searchInput}
                onChange={setSearchInput}
                onSearch={handleSearch}
              />
              <DataTable
                columns={columns}
                data={teams}
                pageCount={pageCount}
                pagination={pagination}
                onPaginationChange={setPagination}
                isLoading={isLoading}
                totalCount={totalCount}
                emptyMessage={
                  search
                    ? 'No teams found. Try a different search term.'
                    : 'No teams yet. Create your first team to get started.'
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLoader>
  );
}
