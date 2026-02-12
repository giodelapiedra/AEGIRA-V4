import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { Users } from 'lucide-react';
import type { TeamIncidentBreakdown } from '@/types/whs-analytics.types';

interface TeamIncidentChartProps {
  data: TeamIncidentBreakdown[];
}

const COLUMNS = [
  { key: 'teamName', label: 'TEAM', align: 'left' as const },
  { key: 'count', label: 'TOTAL', align: 'right' as const },
  { key: 'low', label: 'LOW', align: 'right' as const, severity: 'low' as const },
  { key: 'medium', label: 'MEDIUM', align: 'right' as const, severity: 'medium' as const },
  { key: 'high', label: 'HIGH', align: 'right' as const, severity: 'high' as const },
  { key: 'critical', label: 'CRITICAL', align: 'right' as const, severity: 'critical' as const },
];

const SEVERITY_DOT_CLASS: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'bg-blue-300',
  medium: 'bg-amber-300',
  high: 'bg-orange-300',
  critical: 'bg-red-300',
};

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
          <div className="-mx-6 overflow-x-auto">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((col) => (
                    <TableHead
                      key={col.key}
                      className={col.align === 'right' ? 'text-right' : 'text-left'}
                    >
                      {col.severity ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT_CLASS[col.severity]}`}
                            aria-hidden="true"
                          />
                          {col.label}
                        </span>
                      ) : (
                        col.label
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((team) => (
                  <TableRow key={team.teamId}>
                    <TableCell className="text-sm font-medium">{team.teamName}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {team.count}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                      {team.severityBreakdown.low}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                      {team.severityBreakdown.medium}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                      {team.severityBreakdown.high}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                      {team.severityBreakdown.critical}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
