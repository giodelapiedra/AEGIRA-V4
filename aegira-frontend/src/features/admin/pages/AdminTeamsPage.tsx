import { useState, useDeferredValue } from 'react';
import { Link } from 'react-router-dom';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Users, Plus, MoreHorizontal, Eye, Edit, Search } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
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
import { PageLoader } from '@/components/common/PageLoader';
import { useTeams, Team } from '@/features/team/hooks/useTeams';
import { ROUTES } from '@/config/routes.config';

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
      <Badge variant={row.original.is_active ? 'success' : 'destructive'}>
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
            <Link to={ROUTES.TEAM_DETAIL.replace(':teamId', row.original.id)}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={`${ROUTES.ADMIN_TEAMS}/${row.original.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
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
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const { data: teamsData, isLoading, error } = useTeams(
    pagination.pageIndex + 1,
    pagination.pageSize,
    true, // includeInactive for admin view
    deferredSearch
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const teams = teamsData?.items || [];
  const pageCount = teamsData?.pagination
    ? Math.ceil(teamsData.pagination.total / pagination.pageSize)
    : 0;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Create and manage teams"
        action={
          <Button asChild>
            <Link to={ROUTES.ADMIN_TEAMS_CREATE}>
              <Plus className="h-4 w-4 mr-2" />
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
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by team name..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
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
