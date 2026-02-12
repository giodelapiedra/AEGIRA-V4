# AEGIRA UI Design System

Canonical reference for UI patterns, tokens, and component usage. All new pages and components MUST follow these rules.

---

## Typography Scale

| Usage | Class | Size |
|-------|-------|------|
| Page title (h1) | `text-3xl font-bold tracking-tight` | 30px |
| Section title (h2) | `text-2xl font-semibold` | 24px |
| Card title | `text-sm font-medium text-muted-foreground` | 14px |
| Table header | `text-xs font-semibold uppercase tracking-wider` | 12px |
| Body text | `text-sm` | 14px |
| Small text / descriptions | `text-xs text-muted-foreground` | 12px |
| Sidebar nav labels | `text-xs font-medium` | 12px |
| Badge text | `text-xs` (via CVA) | 12px |

**Rules:**
- NEVER use arbitrary values like `text-[10px]` or `text-[11px]`
- Use Tailwind scale tokens only: `text-xs`, `text-sm`, `text-base`, etc.

---

## Color Tokens

### Border Opacities (2 values only)

| Usage | Token |
|-------|-------|
| Subtle dividers (sidebar, tabs, table rows) | `border-border/50` |
| Container borders (table wrapper, inputs, cards) | `border-border/70` |

**Rules:**
- NEVER use `border-border/40` or `border-border/60`
- Use `border-border` (full opacity) only for strong separators

### Status Colors (Badge variants)

| Status | Variant |
|--------|---------|
| Active | `success` |
| Inactive | `secondary` |
| Error / Critical | `destructive` |
| Pending / Warning | `warning` |
| Info | `info` |

**Rules:**
- Active = `success`, Inactive = `secondary` (never `destructive` for inactive)
- Use `destructive` only for errors, deletions, critical states

### Role Colors (via RoleBadge component)

| Role | Variant |
|------|---------|
| ADMIN | `destructive` |
| WHS | `secondary` |
| SUPERVISOR | `info` |
| TEAM_LEAD | `warning` |
| WORKER | `outline` |

**Rules:**
- ALWAYS use `<RoleBadge role={role} />` from `@/components/common/RoleBadge`
- NEVER create inline role variant maps

### StatCard Icon Colors

| Color | Background | Text |
|-------|-----------|------|
| blue | `bg-blue-500/10` | `text-blue-600` |
| green | `bg-green-500/10` | `text-green-600` |
| purple | `bg-purple-500/10` | `text-purple-600` |
| orange | `bg-orange-500/10` | `text-orange-600` |
| red | `bg-red-500/10` | `text-red-600` |

### Theme Token Usage

| Hardcoded (NEVER use) | Theme Token (ALWAYS use) |
|----------------------|--------------------------|
| `text-gray-700` | `text-foreground` |
| `text-gray-500` / `text-gray-600` | `text-muted-foreground` |
| `text-gray-400` | `text-muted-foreground` |
| `text-gray-900` | `text-foreground` |
| `text-red-500` | `text-destructive` |
| `bg-gray-100` | `bg-muted` |
| `bg-gray-200` | `bg-muted` |
| `border-gray-200` | `border-input` or `border-border` |

---

## Spacing System

### Page Layout
- Page sections: `space-y-6`
- Within cards: `space-y-4`
- Form fields: `space-y-2` (label to input), `space-y-4` (between fields)
- Grid gaps: `gap-4` (cards), `gap-6` (form sections)

### Component Spacing
- Table cell padding: `px-4 py-3.5`
- Table first/last column: `first:pl-5 last:pr-5`
- Table header height: `h-12`
- Button padding: `h-10 px-4` (default), `h-9 px-3` (sm), `h-11 px-8` (lg)

---

## Component Usage Guide

### PageHeader — Page title with actions

```tsx
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';

<PageHeader
  title="Teams"
  description="Manage teams and members"
  action={<Button onClick={onCreate}>Create Team</Button>}
/>
```

**Rules:**
- ALWAYS use PageHeader at the top of every page
- `title` uses h1 styling (`text-3xl font-bold tracking-tight`)
- `description` is optional, uses muted text
- `action` slot is for buttons, period selectors, or other controls
- Flexbox layout: stacks on mobile, horizontal on desktop

### Search — ALWAYS use `TableSearch`

```tsx
import { TableSearch } from '@/components/common/TableSearch';

<TableSearch
  placeholder="Search by name or email..."
  value={searchInput}
  onChange={setSearchInput}
  onSearch={handleSearch}
/>
```

**Rules:**
- NEVER build inline search with Input + Button
- Always provide descriptive `placeholder`
- `onSearch` triggers the search (called on Enter key or button click)
- Uses `type="search"` and `aria-label="Search"` for accessibility

### Tables — ALWAYS use `DataTable`

```tsx
import { DataTable, SortableHeader } from '@/components/ui/data-table';

<DataTable
  columns={columns}
  data={data?.items ?? []}
  pageCount={data?.pagination?.totalPages}
  pagination={pagination}
  onPaginationChange={setPagination}
  totalCount={data?.pagination?.total}
  emptyMessage="No items found."
/>
```

**Rules:**
- Define columns OUTSIDE the component
- Convert page index: `pagination.pageIndex + 1` for API calls
- Use `data?.items ?? []` (never pass undefined)
- NEVER build manual HTML tables

### Stat Cards — Use `StatCard` for numeric metrics

```tsx
import { StatCard } from '@/features/dashboard/components/StatCard';

<StatCard
  title="Average Readiness"
  value="87%"
  description="last 7 days"
  icon={<Activity className="h-5 w-5" />}
  iconBgColor="green"
/>
```

**Rules:**
- Use for numeric/metric displays
- Use raw `Card` only for non-metric content (badges, text, schedules)
- Icon size inside StatCard: `h-5 w-5`

### Role Display — Use `RoleBadge`

```tsx
import { RoleBadge } from '@/components/common/RoleBadge';

<RoleBadge role={person.role} />
```

**Rules:**
- NEVER create inline role variant maps
- NEVER use `<Badge>` directly for roles

### EmptyState — No data messaging

```tsx
import { EmptyState } from '@/components/common/EmptyState';
import { Inbox } from 'lucide-react';

<EmptyState
  title="No data"
  description="No incidents in this period"
  icon={<Inbox className="h-10 w-10" />}
  action={<Button onClick={onCreate}>Create First Item</Button>}
/>
```

**Rules:**
- Use for empty charts, tables, or lists
- Icon should be `h-10 w-10` size
- `action` prop is optional (for CTA buttons)
- Keep title short (2-4 words), description longer

### ConfirmDialog — Confirmation modals

```tsx
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useState } from 'react';

const [confirmOpen, setConfirmOpen] = useState(false);

<ConfirmDialog
  open={confirmOpen}
  onOpenChange={setConfirmOpen}
  title="Delete Team"
  description="Are you sure? This action cannot be undone."
  confirmLabel="Delete"
  cancelLabel="Cancel"
  variant="destructive"
  onConfirm={handleDelete}
  isLoading={deleteMutation.isPending}
/>
```

**Rules:**
- Use for destructive actions (delete, archive, etc.)
- `variant="destructive"` for dangerous actions, `"default"` for safe confirms
- Show loading state with `isLoading` prop
- Disable buttons during loading state

### Loading States — Use `PageLoader`

```tsx
<PageLoader isLoading={isLoading} error={error} skeleton="table">
  {/* Page content */}
</PageLoader>
```

Skeleton types: `page`, `dashboard`, `team-lead-dashboard`, `table`, `cards`, `form`, `detail`, `detail-content`, `check-in`, `stats`

---

## Analytics & Charts Patterns

### Period Selector (Button Group)

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { AnalyticsPeriod } from '@/types/whs-analytics.types';

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function MyAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');

  return (
    <PageHeader
      title="Analytics"
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
  );
}
```

**Rules:**
- Use segmented button group in `PageHeader` action slot
- Active button uses `default` variant, inactive uses `ghost`
- Inactive buttons have `text-muted-foreground`
- Height: `h-8`, padding: `px-4`, font: `text-xs font-medium`
- Wrapper has `rounded-lg border p-1` for button group effect

### Chart Color Configuration

Create a centralized color config file for each analytics feature:

```tsx
// features/<feature>/components/<feature>-analytics/chartConfig.ts
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

export const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};
```

**Rules:**
- Use soft pastel palette for charts (300-400 shades)
- Import colors into all chart components
- Co-locate labels with colors for consistency

### AreaChart Pattern (Recharts)

```tsx
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { TrendingUp } from 'lucide-react';

export function MyTrendChart({ data }: { data: TrendPoint[] }) {
  const hasData = data.length > 0;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Trend Chart
        </CardTitle>
        <span className="text-2xl font-bold tabular-nums">{total}</span>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No data"
            description="No records in this period"
            icon={<TrendingUp className="h-10 w-10" />}
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
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
                  dataKey="value"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#gradTrend)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#6366f1' }}
                />
              </AreaChart>
            </ResponsiveContainer>
            {/* Legend (optional) */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#6366f1]" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

**Rules:**
- Chart height: `260px` (standard), use `ResponsiveContainer` for width
- Margins: `{ top: 0, right: 4, bottom: 0, left: -20 }` (negative left for alignment)
- Grid: `strokeDasharray="3 3"`, no vertical lines (`vertical={false}`)
- Axes: no axis lines or tick lines, `fontSize: 11` for ticks
- Use theme tokens: `hsl(var(--border))`, `hsl(var(--muted-foreground))`, `hsl(var(--card))`
- Tooltips: rounded corners (`8px`), card background, border color
- Area: `dot={false}`, `activeDot={{ r: 4 }}`, gradient fill
- Always wrap chart in Card + show total in header + EmptyState fallback
- Legend at bottom with `pt-2`, `h-2 w-2` color dots, `text-xs text-muted-foreground` labels

### PieChart / Donut Chart Pattern (Recharts)

```tsx
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { AlertTriangle } from 'lucide-react';

const COLORS: Record<string, string> = {
  LOW: '#93c5fd',
  MEDIUM: '#fcd34d',
  HIGH: '#fdba74',
  CRITICAL: '#fca5a5',
};

export function MyDonutChart({ data }: { data: DataPoint[] }) {
  const hasData = data.length > 0;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="No data"
            description="No records in this period"
            icon={<AlertTriangle className="h-10 w-10" />}
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
                      <Cell key={entry.label} fill={COLORS[entry.label] ?? '#cbd5e1'} />
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
                <div key={entry.label} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[entry.label] ?? '#cbd5e1' }}
                    />
                    <span className="text-sm text-muted-foreground">{entry.label}</span>
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

**Rules:**
- Donut dimensions: `w-[180px] h-[180px]`, `innerRadius={55}`, `outerRadius={85}`
- `paddingAngle={2}` for spacing, `stroke="hsl(var(--card))"` for white borders
- Center label: absolute positioned, `text-2xl font-bold` for value, `text-xs text-muted-foreground` for label
- Legend: horizontal layout (`flex items-center gap-6`)
- Legend items: `space-y-2.5`, color dot `h-3 w-3 rounded-full`, `tabular-nums` for counts
- Always wrap in Card + EmptyState fallback

---

## Page Structure Templates

### List Page

```
PageLoader (skeleton="table")
  space-y-6
    PageHeader (title + action button)
    TableSearch
    Card (optional wrapper)
      DataTable (columns + data + pagination)
```

### Detail Page

```
PageLoader (skeleton="detail")
  space-y-6
    PageHeader (title + back/edit buttons)
    Info cards grid (grid-cols-1 md:grid-cols-4)
    StatCard grid (grid-cols-1 md:grid-cols-3)
    Content cards
```

### Create/Edit Page

```
PageLoader (skeleton="form")
  space-y-6
    PageHeader (title + back button)
    Card
      Form (React Hook Form + Zod)
        Form sections (space-y-4)
        Submit + Cancel buttons
```

### Dashboard Page

```
PageLoader (skeleton="dashboard")
  space-y-6
    PageHeader (title + description)
    StatCard grid (grid-cols-1 md:grid-cols-4)
    Sub-components grid
```

**Rules:**
- One hook, one endpoint, one data fetch per dashboard
- Sub-components receive data as props (no individual fetches)
- Group sub-components in `components/<role>/` (e.g., `components/whs/`)

### Analytics Page (Charts + Metrics)

```
PageLoader (skeleton="dashboard")
  space-y-6
    PageHeader (title + period selector in action slot)
    Chart components grid (grid-cols-1 lg:grid-cols-2 gap-6)
      AreaChart component
      PieChart component
    StatCards grid (grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4)
      StatCard (no icons, clean metrics)
    More chart components grid
      PieChart component
      PieChart component
    Full-width components
      Table chart component
```

**Rules:**
- Period selector: `useState<AnalyticsPeriod>` with `'7d' | '30d' | '90d'`
- Use `keepPreviousData: true` in query hook for smooth period switching
- Use `STALE_TIMES.STATIC` (10m) for historical analytics data
- Chart components: Card wrapper + EmptyState fallback + Recharts content
- Centralize chart colors in `chartConfig.ts`
- Pass `data ?? []` to chart components (never undefined)
- Group chart components in `components/<feature>-analytics/`
- StatCards without icons for clean, metric-focused display
- Responsive grids: `grid-cols-1 lg:grid-cols-2` for charts, `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` for stat cards

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| Default | <640px | Mobile — single column, bottom nav |
| `sm:` | 640px+ | Tablet — 2-column grids |
| `md:` | 768px+ | Desktop — sidebar visible, full layouts |
| `lg:` | 1024px+ | Wide — 3-4 column grids |

**Rules:**
- ALWAYS add mobile fallback: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`
- NEVER use `grid-cols-2` or `grid-cols-3` without a `grid-cols-1` mobile fallback
- Sidebar: Desktop = fixed left 80px, Mobile = bottom nav with "More" overflow menu

---

## Formatting Utilities

All formatting functions live in `@/lib/utils/format.utils.ts`. ALWAYS import and use these — NEVER create inline formatters.

### Number Formatting

```tsx
import { formatNumber, formatPercentage, formatCurrency } from '@/lib/utils/format.utils';

formatNumber(1234)           // "1,234"
formatPercentage(87.5)       // "88%"
formatPercentage(87.5, 1)    // "87.5%"
formatCurrency(99.99)        // "$99.99"
```

### Time Formatting

```tsx
import { formatTime12h, formatScheduleWindow } from '@/lib/utils/format.utils';

formatTime12h('06:00')                        // "6:00 AM"
formatTime12h('18:30')                        // "6:30 PM"
formatScheduleWindow('06:00', '10:00')        // "6:00 AM - 10:00 AM"
```

### Incident/Case Formatting

```tsx
import {
  formatIncidentNumber,
  formatCaseNumber,
  formatIncidentType,
  formatDuration,
  formatRejectionReason,
} from '@/lib/utils/format.utils';

formatIncidentNumber(1, '2026-02-10')          // "INC-2026-0001"
formatCaseNumber(1, '2026-02-10')              // "CASE-2026-0001"
formatIncidentType('PHYSICAL_INJURY')          // "Physical Injury"
formatDuration(0.5)                            // "30 min"
formatDuration(3.5)                            // "3.5 hrs"
formatDuration(72)                             // "3.0 days"
formatRejectionReason('DUPLICATE_REPORT')      // "Duplicate Report"
```

### Role & Readiness Formatting

```tsx
import { ROLE_LABELS, getReadinessLabel, getReadinessColor } from '@/lib/utils/format.utils';

ROLE_LABELS['ADMIN']                  // "Admin"
ROLE_LABELS['TEAM_LEAD']              // "Team Lead"
getReadinessLabel('ready')            // "Ready"
getReadinessColor(85)                 // "text-green-600" (score >= 80)
getReadinessColor(65)                 // "text-yellow-600" (60-79)
getReadinessColor(45)                 // "text-orange-600" (40-59)
getReadinessColor(30)                 // "text-red-600" (< 40)
```

### Text Utilities

```tsx
import { capitalize, truncate } from '@/lib/utils/format.utils';

capitalize('hello world')             // "Hello world"
truncate('Long text here', 10)        // "Long text ..."
```

**Rules:**
- NEVER create inline formatters — always use utilities
- For consistent display, import format functions into components
- Use `tabular-nums` class for numeric values in tables/charts

---

## Button Variants & Sizes

### Variants

| Variant | Usage |
|---------|-------|
| `default` | Primary actions (Create, Save, Submit) |
| `secondary` | Secondary actions (Search, Filter) |
| `destructive` | Dangerous actions (Delete, Archive, Reject) |
| `outline` | Tertiary actions, toggle states |
| `ghost` | Subtle actions (Edit, View, Cancel) |
| `link` | Text-only links |

### Sizes

| Size | Height | Padding | Font Size | Usage |
|------|--------|---------|-----------|-------|
| `sm` | `h-9` | `px-3` | `text-xs` | Inline actions, table actions |
| `default` | `h-10` | `px-4` | `text-sm` | Standard buttons |
| `lg` | `h-11` | `px-8` | `text-base` | Hero actions, CTAs |

**Rules:**
- Use `default` variant + `default` size for most buttons
- Destructive actions ALWAYS use `destructive` variant
- Period selectors use `sm` size with `h-8` override
- Icon-only buttons MUST have `aria-label`

---

## Icon Sizes

Consistent icon sizing across components:

| Context | Size | Class |
|---------|------|-------|
| StatCard icon | 20px | `h-5 w-5` |
| EmptyState icon | 40px | `h-10 w-10` |
| Button icon (sm) | 16px | `h-4 w-4` |
| Button icon (default) | 20px | `h-5 w-5` |
| Table action icon | 16px | `h-4 w-4` |
| Chart legend dot | 8px | `h-2 w-2` |
| Severity indicator dot | 12px | `h-3 w-3` |

**Rules:**
- NEVER use arbitrary sizes like `h-[18px]`
- Lucide icons scale cleanly with `h-X w-X` classes
- Add `mr-1` or `mr-2` for icon-text spacing in buttons

---

## Tabular Numbers

Use the `tabular-nums` class for numeric values that should align vertically:

```tsx
// Good - aligns numbers in columns
<span className="text-sm font-semibold tabular-nums">{count}</span>
<span className="text-2xl font-bold tabular-nums">{total}</span>

// Bad - numbers won't align
<span className="text-sm font-semibold">{count}</span>
```

**When to use:**
- Table cells with numeric data
- StatCard values
- Chart totals in headers
- Legend counts
- Time displays (HH:MM format)

---

## Accessibility Requirements

### ARIA Labels
- All icon-only buttons MUST have `aria-label`
- Search inputs MUST have `aria-label="Search"` or `type="search"`
- Navigation elements MUST have `role="navigation"` and `aria-label`
- Active nav links MUST have `aria-current="page"`

### Focus States
- Input: `focus-visible:ring-1 focus-visible:ring-ring`
- Button: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- Table rows: `focus-within:bg-muted/50`

### Touch Targets
- Minimum touch target: 36px (h-9 w-9) on mobile
- Pagination buttons: `h-9 w-9 sm:h-8 sm:w-8`

---

## Empty State Messaging

| Context | Pattern |
|---------|---------|
| Search returned no results | `"No {items} found."` |
| No data exists yet | `"No {items} yet."` |
| DataTable helper text | `"Try adjusting your search or filters."` |

---

## Common Anti-Patterns (AVOID)

### ❌ DON'T: Inline Search Components

```tsx
// BAD - Never build inline search
<div className="flex gap-2">
  <Input placeholder="Search..." value={search} onChange={...} />
  <Button onClick={handleSearch}>Search</Button>
</div>

// GOOD - Use TableSearch component
import { TableSearch } from '@/components/common/TableSearch';
<TableSearch value={search} onChange={setSearch} onSearch={handleSearch} />
```

### ❌ DON'T: Inline Role Variant Maps

```tsx
// BAD - Never create inline role mappings
const roleColors = {
  ADMIN: 'destructive',
  WHS: 'secondary',
  // ...
};
<Badge variant={roleColors[role]}>{role}</Badge>

// GOOD - Use RoleBadge component
import { RoleBadge } from '@/components/common/RoleBadge';
<RoleBadge role={role} />
```

### ❌ DON'T: Manual HTML Tables

```tsx
// BAD - Never build manual tables
<table>
  <thead>...</thead>
  <tbody>...</tbody>
</table>

// GOOD - Use DataTable component
import { DataTable } from '@/components/ui/data-table';
<DataTable columns={columns} data={data?.items ?? []} ... />
```

### ❌ DON'T: Arbitrary Font Sizes

```tsx
// BAD - Never use arbitrary values
<span className="text-[11px]">Label</span>
<span className="text-[13px]">Value</span>

// GOOD - Use Tailwind scale
<span className="text-xs">Label</span>
<span className="text-sm">Value</span>
```

### ❌ DON'T: Hardcoded Gray Colors

```tsx
// BAD - Never use hardcoded grays
<span className="text-gray-600">Description</span>
<div className="bg-gray-100">...</div>
<div className="border-gray-200">...</div>

// GOOD - Use theme tokens
<span className="text-muted-foreground">Description</span>
<div className="bg-muted">...</div>
<div className="border-border">...</div>
```

### ❌ DON'T: Inline Formatters

```tsx
// BAD - Never create inline formatters
const incidentType = type === 'PHYSICAL_INJURY' ? 'Physical Injury' : type;
const duration = hours < 1 ? `${hours * 60}m` : `${hours}h`;

// GOOD - Use format utilities
import { formatIncidentType, formatDuration } from '@/lib/utils/format.utils';
const incidentType = formatIncidentType(type);
const duration = formatDuration(hours);
```

### ❌ DON'T: Wrong Border Opacities

```tsx
// BAD - Never use /40 or /60
<div className="border-border/40">...</div>
<div className="border-border/60">...</div>

// GOOD - Only use /50 (subtle) or /70 (container)
<div className="border-border/50">...</div>  // Subtle dividers
<div className="border-border/70">...</div>  // Container borders
```

### ❌ DON'T: Destructive Variant for Inactive

```tsx
// BAD - Never use destructive for inactive status
<Badge variant={isActive ? 'success' : 'destructive'}>
  {isActive ? 'Active' : 'Inactive'}
</Badge>

// GOOD - Use secondary for inactive
<Badge variant={isActive ? 'success' : 'secondary'}>
  {isActive ? 'Active' : 'Inactive'}
</Badge>
```

### ❌ DON'T: Missing Mobile Fallback

```tsx
// BAD - Missing mobile fallback (breaks on mobile)
<div className="grid grid-cols-3 gap-4">...</div>

// GOOD - Always provide mobile fallback
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">...</div>
```

### ❌ DON'T: Non-Tabular Numbers in Tables

```tsx
// BAD - Numbers won't align vertically
<TableCell className="text-right">{count}</TableCell>

// GOOD - Use tabular-nums for alignment
<TableCell className="text-right tabular-nums">{count}</TableCell>
```

### ❌ DON'T: Missing aria-label on Icon Buttons

```tsx
// BAD - No accessibility label
<Button variant="ghost" size="sm">
  <Edit className="h-4 w-4" />
</Button>

// GOOD - Add aria-label
<Button variant="ghost" size="sm" aria-label="Edit worker">
  <Edit className="h-4 w-4" />
</Button>
```

---

## Files Reference

| Component | Path |
|-----------|------|
| Button | `src/components/ui/button.tsx` |
| Input | `src/components/ui/input.tsx` |
| Table primitives | `src/components/ui/table.tsx` |
| DataTable | `src/components/ui/data-table.tsx` |
| Card | `src/components/ui/card.tsx` |
| Badge | `src/components/ui/badge.tsx` |
| Tabs | `src/components/ui/tabs.tsx` |
| PageHeader | `src/components/common/PageHeader.tsx` |
| PageLoader | `src/components/common/PageLoader.tsx` |
| TableSearch | `src/components/common/TableSearch.tsx` |
| EmptyState | `src/components/common/EmptyState.tsx` |
| RoleBadge | `src/components/common/RoleBadge.tsx` |
| ConfirmDialog | `src/components/common/ConfirmDialog.tsx` |
| StatCard | `src/features/dashboard/components/StatCard.tsx` |
| Sidebar | `src/components/layout/Sidebar.tsx` |
| Header | `src/components/layout/Header.tsx` |
| AppLayout | `src/components/layout/AppLayout.tsx` |
