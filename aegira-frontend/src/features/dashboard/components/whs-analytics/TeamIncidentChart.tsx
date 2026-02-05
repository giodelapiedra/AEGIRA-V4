import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { Users } from 'lucide-react';
import { SEVERITY_COLORS } from './chartConfig';
import type { TeamIncidentBreakdown } from '@/types/whs-analytics.types';

interface TeamIncidentChartProps {
  data: TeamIncidentBreakdown[];
}

const COLUMNS = [
  { key: 'teamName', label: 'TEAM', align: 'left' as const },
  { key: 'count', label: 'TOTAL', align: 'right' as const },
  { key: 'low', label: 'LOW', align: 'right' as const, color: SEVERITY_COLORS.LOW },
  { key: 'medium', label: 'MEDIUM', align: 'right' as const, color: SEVERITY_COLORS.MEDIUM },
  { key: 'high', label: 'HIGH', align: 'right' as const, color: SEVERITY_COLORS.HIGH },
  { key: 'critical', label: 'CRITICAL', align: 'right' as const, color: SEVERITY_COLORS.CRITICAL },
];

export function TeamIncidentChart({ data }: TeamIncidentChartProps) {
  const hasData = data.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Incidents by Team
        </CardTitle>
        {hasData && (
          <span className="text-xs text-muted-foreground">
            Showing {data.length} {data.length === 1 ? 'team' : 'teams'}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No data"
            description="No team incidents in this period"
            icon={<Users className="h-10 w-10" />}
          />
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`px-6 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {col.color ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: col.color }}
                          />
                          {col.label}
                        </span>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((team) => (
                  <tr key={team.teamId} className="border-b border-border/50 last:border-0">
                    <td className="px-6 py-3 text-sm font-medium">{team.teamName}</td>
                    <td className="px-6 py-3 text-sm font-semibold tabular-nums text-right">
                      {team.count}
                    </td>
                    <td className="px-6 py-3 text-sm tabular-nums text-right text-muted-foreground">
                      {team.severityBreakdown.low}
                    </td>
                    <td className="px-6 py-3 text-sm tabular-nums text-right text-muted-foreground">
                      {team.severityBreakdown.medium}
                    </td>
                    <td className="px-6 py-3 text-sm tabular-nums text-right text-muted-foreground">
                      {team.severityBreakdown.high}
                    </td>
                    <td className="px-6 py-3 text-sm tabular-nums text-right text-muted-foreground">
                      {team.severityBreakdown.critical}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
