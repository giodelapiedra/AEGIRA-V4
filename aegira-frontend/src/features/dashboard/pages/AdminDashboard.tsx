import { Link } from 'react-router-dom';
import {
  Users,
  UserCircle,
  Shield,
  Eye,
  UserX,
  ArrowRight,
  Calendar,
  FileClock,
  Building2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '../components/StatCard';
import { useAdminDashboardStats } from '../hooks/useDashboardStats';
import { ROUTES } from '@/config/routes.config';

export function AdminDashboard() {
  const { data: stats, isLoading, error } = useAdminDashboardStats();

  const activeTeams = stats?.activeTeams || 0;
  const inactiveTeams = stats?.inactiveTeams || 0;
  const totalTeams = stats?.totalTeams || 0;
  const totalWorkers = stats?.totalWorkers || 0;
  const unassignedWorkers = stats?.unassignedWorkers || 0;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      <div className="section-stack">
        <PageHeader title="Admin Dashboard" description="Company-wide overview, workforce health, and management actions." />

        <section className="dashboard-grid-4">
          <StatCard
            title="Total Teams"
            value={totalTeams}
            icon={<Users className="h-4 w-4" />}
            description={`${activeTeams} active, ${inactiveTeams} inactive`}
            iconBgColor="blue"
          />
          <StatCard
            title="Total Workers"
            value={totalWorkers}
            icon={<UserCircle className="h-4 w-4" />}
            description="Registered workforce"
            iconBgColor="green"
          />
          <StatCard
            title="Team Leads"
            value={stats?.totalTeamLeads || 0}
            icon={<Shield className="h-4 w-4" />}
            description="Assigned lead accounts"
            iconBgColor="purple"
          />
          <StatCard
            title="Supervisors"
            value={stats?.totalSupervisors || 0}
            icon={<Eye className="h-4 w-4" />}
            description="Assigned supervisor accounts"
            iconBgColor="orange"
          />
        </section>

        <section className="dashboard-grid-2">
          <Card>
            <CardHeader>
              <CardTitle>Workforce Overview</CardTitle>
              <p className="section-description">Current staffing and allocation breakdown.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/35 px-4 py-3">
                <span className="text-sm text-muted-foreground">Active Teams</span>
                <span className="text-base font-semibold">{activeTeams}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/35 px-4 py-3">
                <span className="text-sm text-muted-foreground">Inactive Teams</span>
                <span className="text-base font-semibold">{inactiveTeams}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/35 px-4 py-3">
                <span className="text-sm text-muted-foreground">Total Workers</span>
                <span className="text-base font-semibold">{totalWorkers}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/35 px-4 py-3">
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Unassigned Workers</span>
                </div>
                <span className="text-base font-semibold">{unassignedWorkers}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <p className="section-description">Most common administrative tasks.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button asChild variant="outline" className="h-auto min-h-[88px] justify-start gap-3 px-4 py-4 text-left">
                <Link to={ROUTES.ADMIN_TEAMS}>
                  <Users className="h-5 w-5 shrink-0" />
                  <span className="font-medium">Manage Teams</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto min-h-[88px] justify-start gap-3 px-4 py-4 text-left">
                <Link to={ROUTES.ADMIN_WORKERS}>
                  <UserCircle className="h-5 w-5 shrink-0" />
                  <span className="font-medium">Manage Workers</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto min-h-[88px] justify-start gap-3 px-4 py-4 text-left">
                <Link to={ROUTES.ADMIN_HOLIDAYS}>
                  <Calendar className="h-5 w-5 shrink-0" />
                  <span className="font-medium">Manage Holidays</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto min-h-[88px] justify-start gap-3 px-4 py-4 text-left">
                <Link to={ROUTES.ADMIN_AUDIT_LOGS}>
                  <FileClock className="h-5 w-5 shrink-0" />
                  <span className="font-medium">Review Logs</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="dashboard-grid-2">
          <Card>
            <CardHeader>
              <CardTitle>System Readiness</CardTitle>
              <p className="section-description">Operational snapshot for first-view scanning.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Team Activation Rate</span>
                  <span className="font-semibold">
                    {totalTeams > 0 ? Math.round((activeTeams / totalTeams) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{
                      width: `${totalTeams > 0 ? Math.round((activeTeams / totalTeams) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Worker Allocation Rate</span>
                  <span className="font-semibold">
                    {totalWorkers > 0 ? Math.round(((totalWorkers - unassignedWorkers) / totalWorkers) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${totalWorkers > 0 ? Math.round(((totalWorkers - unassignedWorkers) / totalWorkers) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <p className="section-description">Company profile and policy controls.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/35 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Company Settings</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Update profile, policies, and role-level defaults.
                </p>
              </div>
              <Button asChild className="w-full justify-between">
                <Link to={ROUTES.ADMIN_SETTINGS}>
                  Open Company Settings
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </PageLoader>
  );
}
