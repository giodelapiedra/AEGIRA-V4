# Chart Patterns
> Recharts AreaChart and PieChart/Donut patterns with theme tokens, EmptyState fallback, and centralized colors

## When to Use
- Analytics pages with historical trends (AreaChart)
- Distribution breakdowns (PieChart/Donut)
- Dashboard widgets with visual data representation
- Any page that renders time-series or categorical chart data

## Canonical Implementation

### AreaChart Pattern (Time Series)
```tsx
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

interface TrendChartProps {
  data: { date: string; total: number; approved: number }[];
}

export function TrendChart({ data }: TrendChartProps) {
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
                    const d = new Date(val);
                    return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
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
                  dataKey="total"
                  stroke={STATUS_COLORS.total}
                  strokeWidth={2}
                  fill="url(#gradTrend)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: STATUS_COLORS.total }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Legend row */}
            <div className="flex items-center justify-center gap-4 pt-2">
              {(['total', 'approved', 'rejected'] as const).map((key) => (
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
```

### PieChart / Donut Pattern (Distribution)
```tsx
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { AlertTriangle } from 'lucide-react';
import { SEVERITY_COLORS, SEVERITY_LABELS } from './chartConfig';

interface DistributionChartProps {
  data: { severity: string; count: number }[];
}

export function DistributionChart({ data }: DistributionChartProps) {
  const hasData = data.length > 0;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Severity Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No data"
            description="No incidents in this period"
            icon={<AlertTriangle className="h-10 w-10" />}
          />
        ) : (
          <div className="flex items-center gap-6">
            {/* Donut chart: 180x180, innerRadius=55, outerRadius=85 */}
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
                    nameKey="severity"
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {data.map((entry) => (
                      <Cell
                        key={entry.severity}
                        fill={SEVERITY_COLORS[entry.severity] ?? '#cbd5e1'}
                      />
                    ))}
                  </Pie>
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
                <div key={entry.severity} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: SEVERITY_COLORS[entry.severity] ?? '#cbd5e1' }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {SEVERITY_LABELS[entry.severity] ?? entry.severity}
                    </span>
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
```

### Chart Color Config (Centralized)
```typescript
// Located at: features/dashboard/components/whs-analytics/chartConfig.ts

// Soft pastel palette (300-400 shades)
export const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#93c5fd',      // blue-300
  MEDIUM: '#fcd34d',   // amber-300
  HIGH: '#fdba74',     // orange-300
  CRITICAL: '#fca5a5', // red-300
};

export const STATUS_COLORS: Record<string, string> = {
  total: '#6366f1',    // indigo-500
  approved: '#34d399', // emerald-400
  rejected: '#f87171', // red-400
  pending: '#fbbf24',  // amber-400
};

export const INCIDENT_TYPE_COLORS: Record<string, string> = {
  PHYSICAL_INJURY: '#fca5a5',
  ILLNESS_SICKNESS: '#fdba74',
  MENTAL_HEALTH: '#d8b4fe',
  MEDICAL_EMERGENCY: '#f87171',
  HEALTH_SAFETY_CONCERN: '#fcd34d',
  OTHER: '#cbd5e1',
};

export const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};
```

### Period Selector Button Group
```tsx
import { cn } from '@/lib/utils/cn';
import type { AnalyticsPeriod } from '@/types/whs-analytics.types';

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

// Used in PageHeader action slot
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
```

### Stacked Area Chart (Multiple Series)
```tsx
{/* Each series uses fillOpacity=0.1 and stackId for stacking */}
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
{/* Overlay line (not stacked, no stackId) */}
<Area
  type="monotone"
  dataKey="total"
  stroke={STATUS_COLORS.total}
  strokeWidth={2}
  fill="url(#gradTrend)"
  dot={false}
  activeDot={{ r: 4, strokeWidth: 0, fill: STATUS_COLORS.total }}
/>
```

## Rules
- ✅ DO use `ResponsiveContainer` with `width="100%"` for all charts
- ✅ DO use theme tokens for grid/axis/tooltip: `hsl(var(--border))`, `hsl(var(--muted-foreground))`, `hsl(var(--card))`
- ✅ DO wrap every chart in a `Card` with `EmptyState` fallback when `data.length === 0`
- ✅ DO centralize colors in a `chartConfig.ts` file per feature
- ✅ DO use soft pastel palette (300-400 Tailwind shades) for chart colors
- ✅ DO use standard chart height of 260px for AreaCharts
- ✅ DO use standard donut size: `w-[180px] h-[180px]`, `innerRadius={55}`, `outerRadius={85}`
- ✅ DO hide axis lines and tick lines: `axisLine={false}` `tickLine={false}`
- ✅ DO hide dots on Area: `dot={false}`, show only `activeDot`
- ✅ DO use `vertical={false}` on CartesianGrid (horizontal lines only)
- ✅ DO use `tabular-nums` class for numeric values in legends
- ✅ DO add a legend row below AreaCharts with colored circles
- ✅ DO use absolute positioned center label for donuts
- ✅ DO use `paddingAngle={2}` and `stroke="hsl(var(--card))"` on Pie for visual separation
- ❌ NEVER hardcode colors inline in chart components (use chartConfig)
- ❌ NEVER use raw hex colors for grid/axis/tooltip (use `hsl(var(--token))`)
- ❌ NEVER render a chart without an EmptyState fallback
- ❌ NEVER use fixed pixel widths on ResponsiveContainer (always `width="100%"`)
- ❌ NEVER put chart colors in individual chart files (centralize in chartConfig.ts)

## Common Mistakes

### ❌ WRONG: Hardcoded colors in chart component
```tsx
<Area
  dataKey="total"
  stroke="#6366f1"     // Hardcoded hex
  fill="#6366f1"
/>
<CartesianGrid stroke="#e5e7eb" />  // Hardcoded gray
```

### ✅ CORRECT: Centralized colors + theme tokens
```tsx
import { STATUS_COLORS } from './chartConfig';

<Area
  dataKey="total"
  stroke={STATUS_COLORS.total}        // From chartConfig
  fill={STATUS_COLORS.total}
/>
<CartesianGrid stroke="hsl(var(--border))" />  // Theme token
```

### ❌ WRONG: No empty state fallback
```tsx
export function TrendChart({ data }: TrendChartProps) {
  return (
    <Card>
      <CardContent>
        {/* Crashes or renders empty chart when data=[] */}
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data}>
            {/* ... */}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### ✅ CORRECT: EmptyState fallback
```tsx
export function TrendChart({ data }: TrendChartProps) {
  const hasData = data.length > 0;

  return (
    <Card>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No trend data"
            description="No data recorded in this period"
            icon={<TrendingUp className="h-10 w-10" />}
          />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data}>
              {/* ... */}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

### ❌ WRONG: Fixed width container
```tsx
<ResponsiveContainer width={600} height={260}>
  <AreaChart data={data}>{/* ... */}</AreaChart>
</ResponsiveContainer>
```

### ✅ CORRECT: Percentage width
```tsx
<ResponsiveContainer width="100%" height={260}>
  <AreaChart data={data}>{/* ... */}</AreaChart>
</ResponsiveContainer>
```

### ❌ WRONG: Non-standard donut dimensions
```tsx
<div className="w-[250px] h-[250px]">
  <PieChart>
    <Pie innerRadius={40} outerRadius={100} />
  </PieChart>
</div>
```

### ✅ CORRECT: Standard donut dimensions
```tsx
<div className="relative shrink-0 w-[180px] h-[180px]">
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie innerRadius={55} outerRadius={85} paddingAngle={2} />
    </PieChart>
  </ResponsiveContainer>
</div>
```
