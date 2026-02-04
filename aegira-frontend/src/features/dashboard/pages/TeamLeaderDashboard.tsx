import { ColumnDef } from '@tanstack/react-table';
import { Users, CheckCircle, AlertCircle, TrendingUp, Clock, UserPlus, XCircle, BarChart3, CalendarOff } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/common/PageLoader';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { StatCard } from '../components/StatCard';
import { useTeamLeadDashboardStats } from '../hooks/useDashboardStats';
import type { TeamMemberStatus } from '@/types/check-in.types';
import { formatTime } from '@/lib/utils/date.utils';

// Helper to get readiness badge
const getReadinessBadge = (category?: string) => {
  if (!category) return <Badge variant="outline">-</Badge>;

  switch (category) {
    case 'ready':
      return <Badge variant="success">Ready</Badge>;
    case 'modified_duty':
      return <Badge variant="warning">Modified Duty</Badge>;
    case 'needs_attention':
      return <Badge className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400">Needs Attention</Badge>;
    case 'not_ready':
      return <Badge variant="destructive">Not Ready</Badge>;
    default:
      return <Badge variant="outline">{category}</Badge>;
  }
};

// Get status badge based on member check-in status
const getStatusBadge = (member: TeamMemberStatus) => {
  switch (member.status) {
    case 'submitted':
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Submitted
        </Badge>
      );
    case 'missed':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Missed
        </Badge>
      );
    case 'not_required':
      // Distinguish between "just assigned today" and "day off / holiday"
      if (member.assignedToday) {
        return (
          <Badge variant="info" className="gap-1">
            <UserPlus className="h-3 w-3" />
            Just Assigned
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="gap-1">
          <CalendarOff className="h-3 w-3" />
          Day Off
        </Badge>
      );
    case 'pending':
    default:
      return (
        <Badge variant="warning" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
  }
};

// Column definitions for team member status table
const columns: ColumnDef<TeamMemberStatus>[] = [
  {
    accessorKey: 'fullName',
    header: ({ column }) => <SortableHeader column={column}>Member</SortableHeader>,
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.fullName}</p>
        {row.original.email && (
          <p className="text-sm text-muted-foreground">{row.original.email}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => getStatusBadge(row.original),
  },
  {
    accessorKey: 'readinessCategory',
    header: 'Readiness',
    cell: ({ row }) => getReadinessBadge(row.original.readinessCategory),
  },
  {
    accessorKey: 'readinessScore',
    header: ({ column }) => <SortableHeader column={column}>Score</SortableHeader>,
    cell: ({ row }) => (
      row.original.readinessScore !== undefined && row.original.readinessScore !== null
        ? <span className="font-medium">{row.original.readinessScore}%</span>
        : <span className="text-muted-foreground">-</span>
    ),
  },
  {
    accessorKey: 'checkInTime',
    header: 'Check-in Time',
    cell: ({ row }) => (
      row.original.checkInTime
        ? <span className="text-sm">{formatTime(row.original.checkInTime)}</span>
        : <span className="text-muted-foreground">-</span>
    ),
  },
];

export function TeamLeadDashboard() {
  const { data: stats, isLoading, error } = useTeamLeadDashboardStats();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="team-lead-dashboard">
      {!stats?.teamId ? (
        <div className="space-y-6">
          <PageHeader title="Team Dashboard" />
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No team assigned</p>
              <p className="text-sm text-muted-foreground mt-2">
                Contact your administrator to be assigned as a team leader.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
    <div className="space-y-6">
      <PageHeader title="Team Dashboard" description={stats.teamName ?? undefined} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Team Size"
          value={stats?.teamSize || 0}
          icon={<Users className="h-4 w-4" />}
          description="active members"
          iconBgColor="blue"
        />
        <StatCard
          title="Submissions"
          value={`${stats?.todaySubmissions || 0}/${stats?.expectedCheckIns ?? stats?.teamSize ?? 0}`}
          icon={<CheckCircle className="h-4 w-4" />}
          description="check-ins today"
          iconBgColor="green"
        />
        <StatCard
          title="Avg Readiness"
          value={`${stats?.teamAvgReadiness || 0}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          description="today"
          iconBgColor="purple"
        />
        <StatCard
          title="Pending"
          value={stats?.pendingCheckIns || 0}
          icon={<AlertCircle className="h-4 w-4" />}
          description="awaiting submission"
          iconBgColor="orange"
        />
        <StatCard
          title="Missed"
          value={stats?.missedCheckIns || 0}
          icon={<XCircle className="h-4 w-4" />}
          description="window closed"
          iconBgColor="orange"
        />
        <StatCard
          title="Compliance"
          value={`${stats?.complianceRate || 0}%`}
          icon={<BarChart3 className="h-4 w-4" />}
          description="submission rate"
          iconBgColor="blue"
        />
      </div>

      {(stats?.newlyAssigned || 0) > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserPlus className="h-4 w-4" />
              <span>{stats.newlyAssigned} member(s) just assigned today — not required to check in</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Member Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={stats?.memberStatuses || []}
            searchable
            searchPlaceholder="Search member..."
            searchColumn="fullName"
            emptyMessage="No team members found."
          />
        </CardContent>
      </Card>
    </div>
      )}
    </PageLoader>
  );
}
