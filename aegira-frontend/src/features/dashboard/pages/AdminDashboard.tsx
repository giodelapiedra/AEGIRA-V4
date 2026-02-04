import { Link } from 'react-router-dom';
import { Users, UserCircle, Shield, Eye, UserX, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '../components/StatCard';
import { useAdminDashboardStats } from '../hooks/useDashboardStats';
import { ROUTES } from '@/config/routes.config';

export function AdminDashboard() {
  const { data: stats, isLoading, error } = useAdminDashboardStats();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Company-wide overview and management"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Teams"
          value={stats?.totalTeams || 0}
          icon={<Users className="h-4 w-4" />}
          description={`${stats?.activeTeams || 0} active, ${stats?.inactiveTeams || 0} inactive`}
          iconBgColor="blue"
        />
        <StatCard
          title="Total Workers"
          value={stats?.totalWorkers || 0}
          icon={<UserCircle className="h-4 w-4" />}
          description="registered workers"
          iconBgColor="green"
        />
        <StatCard
          title="Team Leads"
          value={stats?.totalTeamLeads || 0}
          icon={<Shield className="h-4 w-4" />}
          description="assigned team leads"
          iconBgColor="purple"
        />
        <StatCard
          title="Supervisors"
          value={stats?.totalSupervisors || 0}
          icon={<Eye className="h-4 w-4" />}
          description="assigned supervisors"
          iconBgColor="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workforce Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Workforce Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Teams</span>
                <span className="font-semibold">{stats?.activeTeams || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Inactive Teams</span>
                <span className="font-semibold">{stats?.inactiveTeams || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Workers</span>
                <span className="font-semibold">{stats?.totalWorkers || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Unassigned Workers</span>
                </div>
                <span className="font-semibold">{stats?.unassignedWorkers || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link to={ROUTES.ADMIN_TEAMS}>
                  <Users className="h-6 w-6" />
                  <span>Manage Teams</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link to={ROUTES.ADMIN_WORKERS}>
                  <UserCircle className="h-6 w-6" />
                  <span>Manage Workers</span>
                </Link>
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link to={ROUTES.ADMIN_TEAMS}>
                View All Teams
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
    </PageLoader>
  );
}
