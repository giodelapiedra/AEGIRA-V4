import { AlertTriangle, FolderOpen, Briefcase, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { StatCard } from '../components/StatCard';
import { PendingIncidentsTable } from '../components/whs/PendingIncidentsTable';
import { CasesByStatus } from '../components/whs/CasesByStatus';
import { RecentActivity } from '../components/whs/RecentActivity';
import { useWhsDashboardStats } from '../hooks/useDashboardStats';

export function WhsDashboard() {
  const { data, isLoading, error } = useWhsDashboardStats();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      <div className="space-y-6">
        <PageHeader title="WHS Dashboard" description="Incident monitoring overview" />

        {/* Row 1: Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Incidents"
            value={data?.pendingIncidentsCount || 0}
            icon={<AlertTriangle className="h-4 w-4" />}
            description="Awaiting your review"
            iconBgColor="orange"
          />
          <StatCard
            title="My Open Cases"
            value={data?.myCasesCount || 0}
            icon={<FolderOpen className="h-4 w-4" />}
            description="Assigned to you"
            iconBgColor="blue"
          />
          <StatCard
            title="Total Open Cases"
            value={data?.totalOpenCasesCount || 0}
            icon={<Briefcase className="h-4 w-4" />}
            description="Across all officers"
            iconBgColor="purple"
          />
          <StatCard
            title="Resolved This Month"
            value={data?.resolvedThisMonthCount || 0}
            icon={<CheckCircle className="h-4 w-4" />}
            description="This month"
            iconBgColor="green"
          />
        </div>

        {/* Row 2: Pending Incidents Table (full width) */}
        <PendingIncidentsTable incidents={data?.pendingIncidents ?? []} />

        {/* Row 3: Cases + Activity (2 columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CasesByStatus
            casesByStatus={data?.casesByStatus ?? { open: 0, investigating: 0, resolved: 0, closed: 0 }}
          />
          <RecentActivity events={data?.recentActivity ?? []} />
        </div>
      </div>
    </PageLoader>
  );
}
