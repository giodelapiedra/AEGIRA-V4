import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { Button } from '@/components/ui/button';
import { StatCard } from '../components/StatCard';
import { IncidentTrendChart } from '../components/whs-analytics/IncidentTrendChart';
import { IncidentTypeChart } from '../components/whs-analytics/IncidentTypeChart';
import { SeverityDistributionChart } from '../components/whs-analytics/SeverityDistributionChart';
import { TeamIncidentChart } from '../components/whs-analytics/TeamIncidentChart';
import { RejectionAnalysisChart } from '../components/whs-analytics/RejectionAnalysisChart';
import { useWhsAnalytics } from '../hooks/useWhsAnalytics';
import { formatNumber, formatDuration, formatPercentage } from '@/lib/utils/format.utils';
import { cn } from '@/lib/utils/cn';
import type { AnalyticsPeriod } from '@/types/whs-analytics.types';

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function WhsAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const { data, isLoading, error } = useWhsAnalytics(period);

  const summary = data?.summary;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      <div className="space-y-6">
        <PageHeader
          title="WHS Analytics"
          description="Historical incident trends and distributions"
          action={
            <div className="flex items-center gap-0.5 rounded-lg border p-1">
              {PERIOD_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={period === opt.value ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-8 px-4 rounded-md text-xs font-medium',
                    period !== opt.value && 'text-muted-foreground'
                  )}
                  onClick={() => setPeriod(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          }
        />

        {/* Row 1: Area chart + Donut (2 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncidentTrendChart data={data?.incidentTrends ?? []} />
          <IncidentTypeChart data={data?.incidentsByType ?? []} />
        </div>

        {/* Row 2: 6 stat cards — reuses existing StatCard (no icon = clean) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            title="Total Incidents"
            value={formatNumber(summary?.totalIncidents ?? 0)}
          />
          <StatCard
            title="Cases Created"
            value={formatNumber(summary?.totalCasesCreated ?? 0)}
          />
          <StatCard
            title="Approval Rate"
            value={formatPercentage(summary?.approvalRate ?? 0)}
          />
          <StatCard
            title="Rejection Rate"
            value={formatPercentage(summary?.rejectionRate ?? 0)}
          />
          <StatCard
            title="Avg Response"
            value={formatDuration(summary?.avgResponseTimeHours ?? null)}
          />
          <StatCard
            title="Avg Resolution"
            value={formatDuration(summary?.avgResolutionTimeHours ?? null)}
          />
        </div>

        {/* Row 3: Severity + Rejections donuts (2 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SeverityDistributionChart data={data?.incidentsBySeverity ?? []} />
          <RejectionAnalysisChart data={data?.rejectionsByReason ?? []} />
        </div>

        {/* Row 4: Team table (full width) */}
        <TeamIncidentChart data={data?.incidentsByTeam ?? []} />
      </div>
    </PageLoader>
  );
}
