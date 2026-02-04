import { Link } from 'react-router-dom';
import { CalendarDays, Edit } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { useTeams } from '@/features/team/hooks/useTeams';
import { formatScheduleWindow } from '@/lib/utils/format.utils';
import type { Team } from '@/types/team.types';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

// Map work_days CSV numbers to day abbreviations
const DAY_ABBREV: Record<string, string> = {
  '0': 'Sun',
  '1': 'Mon',
  '2': 'Tue',
  '3': 'Wed',
  '4': 'Thu',
  '5': 'Fri',
  '6': 'Sat',
};

// Convert work_days CSV string to array of day abbreviations
function formatWorkDays(workDays: string): string[] {
  if (!workDays) return [];
  return workDays.split(',').map((day) => DAY_ABBREV[day.trim()] || day);
}

export function AdminSchedulesPage() {
  const { data, isLoading, error } = useTeams(1, 100); // Fetch all teams

  const teams: Team[] = data?.items || [];

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="cards">
    <div className="space-y-6">
      <PageHeader
        title="Schedule Configuration"
        description="Configure check-in schedules for teams"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Team Schedules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <EmptyState
              title="No teams found"
              description="Create a team to configure its schedule."
              icon={<CalendarDays className="h-10 w-10" />}
            />
          ) : (
            <div className="space-y-4">
              {teams.map((team) => (
                <Card key={team.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-lg">{team.name}</h4>
                        {team.description && (
                          <p className="text-sm text-muted-foreground mt-1">{team.description}</p>
                        )}
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-24">Team Lead:</span>
                            <span className="font-medium">
                              {team.leader
                                ? `${team.leader.first_name} ${team.leader.last_name}`
                                : 'Not assigned'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-24">Check-in Days:</span>
                            <div className="flex gap-1 flex-wrap">
                              {formatWorkDays(team.work_days).map((day) => (
                                <Badge key={day} variant="outline">{day}</Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-24">Window:</span>
                            <span>{formatScheduleWindow(team.check_in_start, team.check_in_end)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-24">Members:</span>
                            <span>{team._count?.members || 0} workers</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-24">Status:</span>
                            <Badge variant={team.is_active ? 'success' : 'secondary'}>
                              {team.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to={buildRoute(ROUTES.ADMIN_TEAMS_EDIT, { teamId: team.id })}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </PageLoader>
  );
}
