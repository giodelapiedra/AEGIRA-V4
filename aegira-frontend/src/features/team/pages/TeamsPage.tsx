import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, MoreVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { useTeams } from '@/features/team/hooks/useTeams';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

export function TeamsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Use the centralized hook - consistent query key with other pages
  const { data, isLoading, error } = useTeams();

  const teams = data?.items || [];
  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(search.toLowerCase())
  );

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

      {/* Search */}
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Teams Table */}
      <Card>
        <CardContent className="p-0">
          {filteredTeams.length === 0 ? (
            <EmptyState
              title={search ? 'No teams found' : 'No teams yet'}
              description={
                search
                  ? 'Try a different search term'
                  : 'Create your first team to get started'
              }
              icon={<Users className="h-12 w-12" />}
              action={
                !search && (
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Team
                  </Button>
                )
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead className="text-center">Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => (
                  <TableRow
                    key={team.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId: team.id }))}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{team.name}</p>
                        {team.description && (
                          <p className="text-sm text-muted-foreground">
                            {team.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{team._count?.members || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={team.is_active ? 'success' : 'destructive'}>
                        {team.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId: team.id }))}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId: team.id }))}>
                            Edit Team
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(buildRoute(ROUTES.TEAM_DETAIL, { teamId: team.id }))}>
                            Manage Members
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Delete Team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
    </PageLoader>
  );
}
