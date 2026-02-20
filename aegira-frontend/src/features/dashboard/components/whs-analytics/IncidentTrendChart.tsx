import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { TrendingUp } from 'lucide-react';
import { STATUS_COLORS } from './chartConfig';
import { MONTH_NAMES_SHORT } from '@/lib/constants';
import type { IncidentTrendPoint } from '@/types/whs-analytics.types';

interface IncidentTrendChartProps {
  data: IncidentTrendPoint[];
}

export function IncidentTrendChart({ data }: IncidentTrendChartProps) {
  const hasData = data.length > 0;
  const total = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Incident Trends
        </CardTitle>
        <span className="text-2xl font-bold tabular-nums">{total}</span>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No trend data"
            description="No incidents recorded in this period"
            icon={<TrendingUp className="h-10 w-10" />}
          />
        ) : (
          <>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={STATUS_COLORS.total} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={STATUS_COLORS.total} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(val: string) => {
                  const [, mm, dd] = val.split('-');
                  return `${Number(dd)} ${MONTH_NAMES_SHORT[Number(mm) - 1]}`;
                }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="approved"
                stroke={STATUS_COLORS.approved}
                strokeWidth={1.5}
                fill={STATUS_COLORS.approved}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: STATUS_COLORS.approved }}
                stackId="status"
              />
              <Area
                type="monotone"
                dataKey="rejected"
                stroke={STATUS_COLORS.rejected}
                strokeWidth={1.5}
                fill={STATUS_COLORS.rejected}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: STATUS_COLORS.rejected }}
                stackId="status"
              />
              <Area
                type="monotone"
                dataKey="pending"
                stroke={STATUS_COLORS.pending}
                strokeWidth={1.5}
                fill={STATUS_COLORS.pending}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: STATUS_COLORS.pending }}
                stackId="status"
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke={STATUS_COLORS.total}
                strokeWidth={2}
                fill="url(#gradTrend)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: STATUS_COLORS.total }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 pt-2">
            {(['total', 'approved', 'rejected', 'pending'] as const).map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[key] }}
                />
                <span className="text-xs text-muted-foreground capitalize">{key}</span>
              </div>
            ))}
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
