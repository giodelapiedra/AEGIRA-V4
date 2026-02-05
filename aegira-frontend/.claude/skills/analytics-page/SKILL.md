---
name: analytics-page
description: Generate a chart-based analytics page for AEGIRA frontend. Use when creating pages with period selectors, Recharts charts (area, pie/donut), centralized color config, and summary StatCards.
---
# Analytics Page (Charts + Period Selector)

Analytics pages display historical trends and distributions using Recharts. They use a period selector (7d/30d/90d) and centralized chart color config.

## File Structure

```
aegira-frontend/src/features/<feature>/
├── pages/
│   └── <Feature>AnalyticsPage.tsx        # Page with period selector + chart grid
├── components/
│   └── <feature>-analytics/
│       ├── chartConfig.ts                # Centralized color constants
│       ├── TrendChart.tsx                 # Area chart (time series)
│       ├── TypeDistributionChart.tsx      # Donut pie chart
│       ├── SeverityChart.tsx              # Donut pie chart
│       └── BreakdownTable.tsx             # Simple table (no DataTable)
├── hooks/
│   └── use<Feature>Analytics.ts          # Query hook with period param
└── (types defined in src/types/<feature>-analytics.types.ts)
```

## Types File

```typescript
// src/types/<feature>-analytics.types.ts

export type AnalyticsPeriod = '7d' | '30d' | '90d';

export interface FeatureAnalyticsResponse {
  period: AnalyticsPeriod;
  dateRange: { start: string; end: string };
  summary: {
    totalCount: number;
    // ... other summary metrics
  };
  trends: TrendPoint[];
  distributionByType: TypeBreakdown[];
  // ... other chart data arrays
}

export interface TrendPoint {
  date: string;
  total: number;
  // ... other series
}

export interface TypeBreakdown {
  type: string;
  label: string;
  count: number;
  percentage: number;
}
```

## Query Hook (with keepPreviousData)

```typescript
// src/features/<feature>/hooks/use<Feature>Analytics.ts

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { AnalyticsPeriod, FeatureAnalyticsResponse } from '@/types/<feature>-analytics.types';

export type { AnalyticsPeriod, FeatureAnalyticsResponse } from '@/types/<feature>-analytics.types';

export function use<Feature>Analytics(period: AnalyticsPeriod = '30d') {
  return useQuery({
    queryKey: ['<feature>', 'analytics', period],
    staleTime: STALE_TIMES.STATIC,        // 10min — historical data
    placeholderData: keepPreviousData,     // Smooth transition between periods
    queryFn: () => {
      const params = new URLSearchParams({ period });
      return apiClient.get<FeatureAnalyticsResponse>(
        `${ENDPOINTS.<FEATURE>.ANALYTICS}?${params.toString()}`
      );
    },
  });
}
```

## Chart Color Config

```typescript
// src/features/<feature>/components/<feature>-analytics/chartConfig.ts

// Soft pastel palette matching shadcn/ui design
export const CATEGORY_COLORS: Record<string, string> = {
  TYPE_A: '#fca5a5',   // red-300
  TYPE_B: '#fdba74',   // orange-300
  TYPE_C: '#d8b4fe',   // purple-300
  OTHER: '#cbd5e1',    // slate-300
};

export const STATUS_COLORS: Record<string, string> = {
  total: '#6366f1',    // indigo-500
  approved: '#34d399', // emerald-400
  rejected: '#f87171', // red-400
  pending: '#fbbf24',  // amber-400
};

export const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#93c5fd',      // blue-300
  MEDIUM: '#fcd34d',   // amber-300
  HIGH: '#fdba74',     // orange-300
  CRITICAL: '#fca5a5', // red-300
};

export const CYCLING_COLORS = ['#fca5a5', '#fdba74', '#fcd34d', '#cbd5e1'];

export const CATEGORY_LABELS: Record<string, string> = {
  TYPE_A: 'Type A',
  TYPE_B: 'Type B',
};
```

## Analytics Page Template

```typescript
// src/features/<feature>/pages/<Feature>AnalyticsPage.tsx

import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { Button } from '@/components/ui/button';
import { StatCard } from '../components/StatCard';
import { TrendChart } from '../components/<feature>-analytics/TrendChart';
import { TypeDistributionChart } from '../components/<feature>-analytics/TypeDistributionChart';
import { use<Feature>Analytics } from '../hooks/use<Feature>Analytics';
import { formatNumber, formatPercentage, formatDuration } from '@/lib/utils/format.utils';
import { cn } from '@/lib/utils/cn';
import type { AnalyticsPeriod } from '@/types/<feature>-analytics.types';

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function FeatureAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const { data, isLoading, error } = use<Feature>Analytics(period);

  const summary = data?.summary;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      <div className="space-y-6">
        <PageHeader
          title="Feature Analytics"
          description="Historical trends and distributions"
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

        {/* Row 1: Charts (2 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TrendChart data={data?.trends ?? []} />
          <TypeDistributionChart data={data?.distributionByType ?? []} />
        </div>

        {/* Row 2: Summary StatCards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Total" value={formatNumber(summary?.totalCount ?? 0)} />
          {/* ... more stat cards */}
        </div>

        {/* Row 3+: More charts */}
      </div>
    </PageLoader>
  );
}
```

## Area Chart Component Template

```typescript
// src/features/<feature>/components/<feature>-analytics/TrendChart.tsx

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { STATUS_COLORS } from './chartConfig';

interface TrendPoint {
  date: string;
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}

interface TrendChartProps {
  data: TrendPoint[];
}

export function TrendChart({ data }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Trends</CardTitle></CardHeader>
        <CardContent><EmptyState message="No trend data" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Trends</CardTitle></CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(val) => {
                  const d = new Date(val);
                  return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="total"
                stroke={STATUS_COLORS.total}
                fill={STATUS_COLORS.total}
                fillOpacity={0.1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Donut Pie Chart Component Template

```typescript
// src/features/<feature>/components/<feature>-analytics/TypeDistributionChart.tsx

import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { CATEGORY_COLORS } from './chartConfig';

interface TypeBreakdown {
  type: string;
  label: string;
  count: number;
  percentage: number;
}

interface TypeDistributionChartProps {
  data: TypeBreakdown[];
}

export function TypeDistributionChart({ data }: TypeDistributionChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Distribution</CardTitle></CardHeader>
        <CardContent><EmptyState message="No data" /></CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader><CardTitle>Distribution</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Donut chart */}
          <div className="h-[200px] w-[200px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {data.map((entry) => (
                    <Cell key={entry.type} fill={CATEGORY_COLORS[entry.type] ?? '#cbd5e1'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{total}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2">
            {data.map((item) => (
              <div key={item.type} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[item.type] ?? '#cbd5e1' }}
                  />
                  <span>{item.label}</span>
                </div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Key Rules

- ALWAYS use `keepPreviousData` in the analytics query hook (smooth period transitions)
- ALWAYS use `STALE_TIMES.STATIC` (10min) for historical analytics data
- ALWAYS centralize chart colors in a `chartConfig.ts` file — never inline hex colors
- ALWAYS wrap each chart in a `Card` with `CardHeader` + `CardTitle`
- ALWAYS provide `EmptyState` fallback when data array is empty
- ALWAYS use `ResponsiveContainer` wrapping all Recharts charts
- ALWAYS pass `data ?? []` from the page to chart components (never undefined)
- ALWAYS define `AnalyticsPeriod` type as `'7d' | '30d' | '90d'`
- ALWAYS put period selector in PageHeader's `action` slot
- ALWAYS use `cn()` for conditional button styling in period selector
- Use soft pastel colors matching shadcn/ui design (blue-300, amber-300, etc.)
- Use `formatNumber`, `formatPercentage`, `formatDuration` from `@/lib/utils/format.utils`
- Chart components receive typed props (explicit interface, no `any`)
- For donut charts: `innerRadius={60} outerRadius={90} paddingAngle={2}`
- For area charts: `fillOpacity={0.1}` for subtle area fill
