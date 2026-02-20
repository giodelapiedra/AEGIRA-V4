import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Users, Plus, MoreHorizontal, Eye, Edit, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { TableSearch } from '@/components/common/TableSearch';
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
import { useTeams, Team } from '@/features/team/hooks/useTeams';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

const columns: ColumnDef<Team>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Team Name</SortableHeader>,
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.description || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'members',
    header: 'Members',
    cell: ({ row }) => row.original._count?.members || 0,
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
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={buildRoute(ROUTES.TEAM_DETAIL, { teamId: row.original.id })}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={buildRoute(ROUTES.ADMIN_TEAMS_EDIT, { teamId: row.original.id })}>
              {row.original.is_active ? (
                <><Edit className="h-4 w-4 mr-2" />Edit</>
              ) : (
                <><RotateCcw className="h-4 w-4 mr-2" />Reactivate</>
              )}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export function AdminTeamsPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const { data: teamsData, isLoading, error } = useTeams(
    pagination.pageIndex + 1,
    pagination.pageSize,
    true, // includeInactive for admin view
    search
  );

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const teams = teamsData?.items || [];
  const pageCount = teamsData?.pagination?.totalPages ?? 0;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="section-stack">
        <PageHeader
          title="Team Management"
          description="Create, activate, and organize teams from one centralized workspace."
          action={
            <Button asChild>
              <Link to={ROUTES.ADMIN_TEAMS_CREATE}>
                <Plus className="mr-2 h-4 w-4" />
                Add Team
              </Link>
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Teams ({teamsData?.pagination?.total || 0})
            </CardTitle>
            <p className="section-description">Use search and actions to review or update team records.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <TableSearch
                placeholder="Search by team name..."
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
                totalCount={teamsData?.pagination?.total || 0}
                emptyMessage="No teams found. Create your first team to get started."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLoader>
  );
}
