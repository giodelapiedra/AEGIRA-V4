import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Users, CheckCircle, TrendingUp, Clock, UserPlus, XCircle, BarChart3, ArrowRightLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/common/PageLoader';
import { ReadinessCategoryBadge } from '@/components/common/badge-utils';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { StatCard } from '../components/StatCard';
import { useTeamLeadDashboardStats } from '../hooks/useDashboardStats';
import type { TeamMemberStatus } from '@/types/check-in.types';
import { formatTime } from '@/lib/utils/date.utils';

// Priority order for table sorting: problems first, healthy last
const STATUS_ORDER: Record<string, number> = {
  missed: 0,
  pending: 1,
  submitted: 2,
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
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {getStatusBadge(row.original)}
        {row.original.transferringOut && (
          <Badge variant="amber" className="gap-1">
            <ArrowRightLeft className="h-3 w-3" />
            {row.original.transferringToTeam ? `To ${row.original.transferringToTeam}` : 'Transferring'}
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'readinessCategory',
    header: 'Readiness',
    cell: ({ row }) => <ReadinessCategoryBadge category={row.original.readinessCategory} />,
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

  // Filter to expected check-ins only (exclude day off / newly assigned),
  // then sort by priority: missed → pending → submitted
  const sortedMembers = useMemo(() => {
    if (!stats?.memberStatuses) return [];
    return stats.memberStatuses
      .filter((m) => m.status !== 'not_required')
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
  }, [stats?.memberStatuses]);

  // Compute status counts for summary bar (expected check-ins only)
  const statusCounts = useMemo(() => {
    if (!stats?.memberStatuses) return { missed: 0, pending: 0, submitted: 0 };
    let missed = 0, pending = 0, submitted = 0;
    for (const m of stats.memberStatuses) {
      if (m.status === 'missed') missed++;
      else if (m.status === 'pending') pending++;
      else if (m.status === 'submitted') submitted++;
    }
    return { missed, pending, submitted };
  }, [stats?.memberStatuses]);

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

      {/* Stat Cards — 4 key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          title="Compliance"
          value={`${stats?.complianceRate || 0}%`}
          icon={<BarChart3 className="h-4 w-4" />}
          description="submission rate"
          iconBgColor="blue"
        />
      </div>

      {/* Newly assigned alert */}
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

      {/* Team Member Status — sorted by priority, summary badges in header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Member Status
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {statusCounts.missed > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {statusCounts.missed} Missed
                </Badge>
              )}
              {statusCounts.pending > 0 && (
                <Badge variant="warning" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {statusCounts.pending} Pending
                </Badge>
              )}
              {statusCounts.submitted > 0 && (
                <Badge variant="success" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {statusCounts.submitted} Submitted
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={sortedMembers}
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
