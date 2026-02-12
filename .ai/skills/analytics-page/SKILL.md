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
│       └── BreakdownTable.tsx             # Simple table (no DataTable)
├── hooks/
│   └── use<Feature>Analytics.ts          # Query hook with period param
└── (types in src/types/<feature>-analytics.types.ts)
```

## Analytics Page Pattern

<!-- @pattern: frontend/page-patterns -->

## Chart Patterns

<!-- @pattern: ui/chart-patterns -->

## Design Tokens (Chart Colors)

<!-- @pattern: ui/design-tokens -->

## Checklist

- [ ] Uses `keepPreviousData` in the analytics query hook
- [ ] Uses `STALE_TIMES.STATIC` (10min) for historical analytics data
- [ ] Centralizes chart colors in `chartConfig.ts`
- [ ] Each chart wrapped in `Card` with `CardHeader` + `CardTitle`
- [ ] Provides `EmptyState` fallback when data is empty
- [ ] Uses `ResponsiveContainer` wrapping all Recharts charts
- [ ] Passes `data ?? []` to chart components (never undefined)
- [ ] `AnalyticsPeriod` type defined as `'7d' | '30d' | '90d'`
- [ ] Period selector in PageHeader's `action` slot
- [ ] Uses `cn()` for conditional button styling
- [ ] Soft pastel colors matching shadcn/ui design
