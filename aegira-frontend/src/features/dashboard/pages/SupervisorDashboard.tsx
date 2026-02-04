import { Users, CheckCircle, TrendingUp, Building2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { StatCard } from '../components/StatCard';
import { useSupervisorDashboardStats } from '../hooks/useDashboardStats';
export function SupervisorDashboard() {
  const { data: stats, isLoading, error } = useSupervisorDashboardStats();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="team-lead-dashboard">
    <div className="space-y-6">
      <PageHeader title="Supervisor Dashboard" description="Overview of all teams" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Teams"
          value={stats?.totalTeams || 0}
          icon={<Building2 className="h-4 w-4" />}
          description="active teams"
          iconBgColor="blue"
        />
        <StatCard
          title="Total Workers"
          value={stats?.totalWorkers || 0}
          icon={<Users className="h-4 w-4" />}
          description="across all teams"
          iconBgColor="green"
        />
        <StatCard
          title="Today's Check-ins"
          value={`${stats?.totalCheckIns || 0}/${stats?.totalWorkers || 0}`}
          icon={<CheckCircle className="h-4 w-4" />}
          description={`${stats?.overallComplianceRate || 0}% compliance`}
          iconBgColor="purple"
        />
        <StatCard
          title="Avg Readiness"
          value={`${stats?.overallAvgReadiness || 0}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          description="company-wide"
          iconBgColor="orange"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.teams?.map((team) => (
              <div
                key={team.teamId}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <h3 className="font-semibold">{team.teamName}</h3>
                  <p className="text-sm text-muted-foreground">
                    Team Lead: {team.leaderName || 'Not assigned'}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="font-medium">{team.workerCount}</p>
                    <p className="text-muted-foreground">Workers</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{team.todayCheckIns}/{team.workerCount}</p>
                    <p className="text-muted-foreground">Check-ins</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">
                      {team.avgReadiness}%
                    </p>
                    <p className="text-xs text-muted-foreground">Readiness</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">
                      {team.complianceRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">Compliance</p>
                  </div>
                </div>
              </div>
            ))}
            {(!stats?.teams || stats.teams.length === 0) && (
              <EmptyState
                title="No teams found"
                description="Teams assigned to you will appear here."
                icon={<Building2 className="h-10 w-10" />}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
    </PageLoader>
  );
}
