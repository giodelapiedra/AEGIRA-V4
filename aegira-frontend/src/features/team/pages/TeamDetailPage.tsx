import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageLoader } from '@/components/common/PageLoader';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { useTeamDetail } from '../hooks/useTeams';
import { ROUTES } from '@/config/routes.config';

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { data: team, isLoading, error } = useTeamDetail(teamId || '');

  if (!team && !isLoading) {
    return <ErrorMessage message="Team not found" />;
  }

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="detail">
    {team && (
    <div className="space-y-6">
      <PageHeader
        title={team.name}
        description={team.description || 'No description'}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(ROUTES.TEAM)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </div>
        }
      />

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{team.members?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Team ID</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono text-muted-foreground">{team.id.slice(0, 8)}...</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={team.is_active ? 'success' : 'secondary'}>
              {team.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            View and manage team members
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!team.members || team.members.length === 0 ? (
            <EmptyState
              title="No members yet"
              description="Add team members to get started"
              icon={<Users className="h-12 w-12" />}
              action={
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Member
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.first_name} {member.last_name}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'SUPERVISOR' ? 'default' : 'secondary'}>
                        {member.role === 'SUPERVISOR' ? 'Supervisor' : member.role === 'ADMIN' ? 'Admin' : 'Worker'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.is_active ? 'success' : 'outline'}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
    )}
    </PageLoader>
  );
}
