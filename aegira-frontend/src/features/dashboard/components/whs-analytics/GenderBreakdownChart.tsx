import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { Users } from 'lucide-react';
import { GENDER_COLORS } from './chartConfig';
import type { GenderBreakdown } from '@/types/whs-analytics.types';

interface GenderBreakdownChartProps {
  data: GenderBreakdown[];
}

export function GenderBreakdownChart({ data }: GenderBreakdownChartProps) {
  const hasData = data.length > 0;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Incidents by Gender
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No data"
            description="No incidents in this period"
            icon={<Users className="h-10 w-10" />}
          />
        ) : (
          <div className="flex items-center gap-6">
            {/* Donut chart */}
            <div className="relative shrink-0 w-[180px] h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="count"
                    nameKey="label"
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.gender} fill={GENDER_COLORS[entry.gender] ?? '#cbd5e1'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                    formatter={(value) => [value, 'Count']}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold">{total}</span>
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
            </div>

            {/* Legend list */}
            <div className="flex-1 space-y-2.5">
              {data.map((entry) => (
                <div key={entry.gender} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: GENDER_COLORS[entry.gender] ?? '#cbd5e1' }}
                    />
                    <span className="text-sm text-muted-foreground truncate">{entry.label}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
