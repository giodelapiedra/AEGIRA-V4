import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Calendar, TrendingUp, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatCard } from '@/features/dashboard/components/StatCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/common/PageLoader';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { PageHeader } from '@/components/common/PageHeader';
import { usePerson, usePersonStats } from '../hooks/usePersons';
import { ROLE_LABELS } from '@/lib/utils/format.utils';
import { useTeam } from '@/features/team/hooks/useTeams';

export function PersonDetailPage() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();

  const { data: person, isLoading, error } = usePerson(personId || '');
  const { data: stats } = usePersonStats(personId || '');
  const { data: team } = useTeam(person?.team_id || '');

  if (!person && !isLoading) {
    return <ErrorMessage message="Person not found" />;
  }

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="detail">
    {person && (
    <div className="space-y-6">
      <PageHeader
        title={`${person.first_name} ${person.last_name}`}
        description={person.email}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button>Edit Profile</Button>
          </div>
        }
      />

      {/* Person Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Role</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default">{ROLE_LABELS[person.role]}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Team</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {person.team?.name || (
                <span className="text-muted-foreground">Not assigned</span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={person.is_active ? 'success' : 'secondary'}>
              {person.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Check-in Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.checkInStreak || 0} days</p>
          </CardContent>
        </Card>
      </div>

      {/* Worker Schedule (if WORKER role and has team) */}
      {person.role === 'WORKER' && person.team_id && team && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Work Schedule
            </CardTitle>
            <CardDescription>
              Check-in requirements for this worker
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Work Days</p>
              <p className="text-base font-medium">
                {person.work_days || team.work_days}
                {!person.work_days && (
                  <span className="ml-2 text-xs text-muted-foreground">(Team default)</span>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Check-in Window</p>
              <p className="text-base font-medium">
                {person.check_in_start && person.check_in_end
                  ? `${person.check_in_start} - ${person.check_in_end}`
                  : `${team.check_in_start} - ${team.check_in_end}`}
                {(!person.check_in_start || !person.check_in_end) && (
                  <span className="ml-2 text-xs text-muted-foreground">(Team default)</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Average Readiness"
            value={`${stats.avgReadiness}%`}
            description="last 7 days"
            icon={<Activity className="h-5 w-5" />}
            iconBgColor="green"
          />
          <StatCard
            title="Weekly Completion"
            value={`${stats.weeklyCompletion}%`}
            description="this week"
            icon={<Calendar className="h-5 w-5" />}
            iconBgColor="blue"
          />
          <StatCard
            title="Total Check-Ins"
            value={stats.totalCheckIns}
            description="all time"
            icon={<TrendingUp className="h-5 w-5" />}
            iconBgColor="purple"
          />
        </div>
      )}

      {/* Recent Check-Ins placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Check-Ins</CardTitle>
          <CardDescription>
            View the person's recent check-in history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Check-in history will be displayed here
          </p>
        </CardContent>
      </Card>
    </div>
    )}
    </PageLoader>
  );
}
