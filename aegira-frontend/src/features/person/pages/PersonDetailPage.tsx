import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/common/PageLoader';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { PageHeader } from '@/components/common/PageHeader';
import { usePerson, usePersonStats } from '../hooks/usePersons';
import { ROLE_LABELS } from '@/lib/utils/format.utils';

export function PersonDetailPage() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();

  const { data: person, isLoading, error } = usePerson(personId || '');
  const { data: stats } = usePersonStats(personId || '');

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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Average Readiness
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgReadiness}%</div>
              <p className="text-xs text-muted-foreground">last 7 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Weekly Completion
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.weeklyCompletion}%</div>
              <p className="text-xs text-muted-foreground">this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Check-Ins
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCheckIns}</div>
              <p className="text-xs text-muted-foreground">all time</p>
            </CardContent>
          </Card>
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
