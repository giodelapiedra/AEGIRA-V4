import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { TrendingUp, Users, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/features/dashboard/components/StatCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { PageLoader } from '@/components/common/PageLoader';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { SEMANTIC_STATUS } from '@/lib/constants';
import { STALE_TIMES } from '@/config/query.config';

interface CheckInRecord {
  name: string;
  date: string;
  readinessScore: number;
  readinessLevel: 'GREEN' | 'YELLOW' | 'RED';
  submitTime: string;
}

interface AnalyticsResponse {
  period: string;
  summary: {
    totalCheckIns: number;
    avgReadiness: number;
    workerCount: number;
    readinessDistribution: {
      green: number;
      yellow: number;
      red: number;
    };
  };
  records: CheckInRecord[];
}

const columns: ColumnDef<CheckInRecord>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'date',
    header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
  },
  {
    accessorKey: 'readinessScore',
    header: ({ column }) => <SortableHeader column={column}>Readiness</SortableHeader>,
    cell: ({ row }) => `${row.original.readinessScore}%`,
  },
  {
    accessorKey: 'readinessLevel',
    header: 'Status',
    cell: ({ row }) => {
      const readinessConfig = SEMANTIC_STATUS.READINESS_LEVEL[row.original.readinessLevel];
      return (
        <Badge variant={readinessConfig?.variant ?? 'secondary'}>
          {readinessConfig?.label ?? row.original.readinessLevel}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'submitTime',
    header: 'Submit Time',
    cell: ({ row }) => {
      const time = row.original.submitTime;
      if (!time) return <span className="text-muted-foreground">—</span>;
      const [h, m] = time.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
    },
  },
];

export function TeamAnalyticsPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  const { data, isLoading, error } = useQuery({
    queryKey: ['team', 'analytics', period],
    staleTime: STALE_TIMES.STANDARD, // ✅ FIX: Analytics data updates occasionally
    queryFn: () => apiClient.get<AnalyticsResponse>(`${ENDPOINTS.TEAM_MANAGEMENT.ANALYTICS}?period=${period}`),
  });

  const summary = data?.summary || {
    totalCheckIns: 0,
    avgReadiness: 0,
    workerCount: 0,
    readinessDistribution: { green: 0, yellow: 0, red: 0 },
  };
  const records = data?.records || [];

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
    <div className="space-y-6">
      <PageHeader
        title="Team Analytics"
        description="Team performance metrics and trends"
        action={
          <div className="flex gap-2">
            <Button
              variant={period === '7d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('7d')}
            >
              7 Days
            </Button>
            <Button
              variant={period === '30d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('30d')}
            >
              30 Days
            </Button>
            <Button
              variant={period === '90d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('90d')}
            >
              90 Days
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Workers"
          value={summary.workerCount}
          icon={<Users className="h-4 w-4" />}
          iconBgColor="blue"
        />
        <StatCard
          title="Total Check-ins"
          value={summary.totalCheckIns}
          icon={<CheckCircle className="h-4 w-4" />}
          iconBgColor="green"
        />
        <StatCard
          title="Avg Readiness"
          value={`${summary.avgReadiness}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          iconBgColor="purple"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${SEMANTIC_STATUS.READINESS_LEVEL.GREEN.indicator}`}
              />
              <span className="text-2xl font-bold">{summary.readinessDistribution.green}</span>
            </div>
            <p className="text-sm text-muted-foreground">Green (Ready)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${SEMANTIC_STATUS.READINESS_LEVEL.YELLOW.indicator}`}
              />
              <span className="text-2xl font-bold">{summary.readinessDistribution.yellow}</span>
            </div>
            <p className="text-sm text-muted-foreground">Yellow (Modified Duty)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${SEMANTIC_STATUS.READINESS_LEVEL.RED.indicator}`}
              />
              <span className="text-2xl font-bold">{summary.readinessDistribution.red}</span>
            </div>
            <p className="text-sm text-muted-foreground">Red (Not Ready)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Check-in Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={records}
            isLoading={isLoading}
            emptyMessage="No check-in records for the selected period."
          />
        </CardContent>
      </Card>
    </div>
    </PageLoader>
  );
}
