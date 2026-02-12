# Design Tokens
> Typography scale, color tokens, border opacities, and status colors - NEVER use arbitrary values or hardcoded colors

## Typography Scale

**ALWAYS use Tailwind scale - NEVER use arbitrary values like `text-[11px]`**

```tsx
// ✅ CORRECT - Use Tailwind scale
<p className="text-xs">Small text (0.75rem / 12px)</p>
<p className="text-sm">Body text (0.875rem / 14px)</p>
<p className="text-base">Base text (1rem / 16px)</p>
<p className="text-lg">Large text (1.125rem / 18px)</p>
<p className="text-xl">Extra large (1.25rem / 20px)</p>
<p className="text-2xl">Heading (1.5rem / 24px)</p>
<p className="text-3xl">Large heading (1.875rem / 30px)</p>
<p className="text-4xl">Hero (2.25rem / 36px)</p>

// ❌ WRONG - Arbitrary values
<p className="text-[11px]">Never do this</p>
<p className="text-[15px]">Never do this</p>
```

### Font Weights

```tsx
font-normal    // 400
font-medium    // 500
font-semibold  // 600
font-bold      // 700
```

### Tabular Numbers

Use `tabular-nums` for numeric alignment in tables:

```tsx
<td className="tabular-nums">{score}</td>
<td className="tabular-nums">{percentage}%</td>
```

## Color Tokens

**ALWAYS use semantic color tokens - NEVER hardcode `gray-*` colors**

### Foreground Colors

```tsx
// ✅ CORRECT - Semantic tokens
text-foreground           // Primary text (black in light, white in dark)
text-muted-foreground     // Secondary text (gray-500 in light, gray-400 in dark)
text-primary              // Brand color text
text-destructive          // Error/danger text
text-success              // Success text (for custom config)

// ❌ WRONG - Hardcoded grays
text-gray-900  // Never hardcode
text-gray-500  // Use text-muted-foreground instead
text-gray-400  // Use text-muted-foreground instead
```

### Background Colors

```tsx
// ✅ CORRECT
bg-background       // Page background
bg-card             // Card/container background
bg-muted            // Subtle background (for disabled, hover states)
bg-accent           // Accent background (for hover)
bg-primary          // Brand color background
bg-destructive      // Error/danger background
bg-success          // Success background (for custom config)
bg-secondary        // Secondary background

// ❌ WRONG
bg-gray-50   // Never hardcode
bg-gray-100  // Use bg-muted instead
```

### Border Colors

```tsx
// ✅ CORRECT
border-border       // Default border color
border-input        // Input border color
border-primary      // Brand color border
border-destructive  // Error border

// ❌ WRONG
border-gray-200  // Never hardcode
border-gray-300  // Use border-border instead
```

## Border Opacities

**ONLY use `/50` (subtle) or `/70` (container) - NEVER `/40` or `/60`**

```tsx
// ✅ CORRECT - Only two allowed values
border-border/50   // Subtle borders (list separators, dividers)
border-border/70   // Container borders (cards, modals)

// ❌ WRONG - Invalid opacities
border-border/40   // Never use
border-border/60   // Never use
border-border/80   // Never use

// Usage examples
<div className="border border-border/70 rounded-lg">Card</div>
<tr className="border-b border-border/50">Row</tr>
```

## Status Colors

**Active = `success`, Inactive = `secondary` - NEVER `destructive` for inactive**

```tsx
// ✅ CORRECT - Status badge variants
<Badge variant="success">Active</Badge>
<Badge variant="secondary">Inactive</Badge>
<Badge variant="destructive">Deleted</Badge>
<Badge variant="warning">Pending</Badge>

// ❌ WRONG
<Badge variant="destructive">Inactive</Badge>  // Too aggressive for inactive
<Badge variant="default">Active</Badge>        // Not semantic enough
```

### Status Color Mapping

```tsx
const statusVariants = {
  active: 'success',      // Green
  inactive: 'secondary',  // Gray
  deleted: 'destructive', // Red
  pending: 'warning',     // Yellow/Orange
  approved: 'success',    // Green
  rejected: 'destructive', // Red
} as const;
```

## Role Colors

**Use RoleBadge component - NEVER inline variant maps**

```tsx
// ✅ CORRECT - Use RoleBadge component
import { RoleBadge } from '@/components/common/RoleBadge';
<RoleBadge role={person.role} />

// ❌ WRONG - Inline variant maps
const roleVariant = role === 'ADMIN' ? 'destructive' : 'default';
<Badge variant={roleVariant}>{role}</Badge>
```

### Role Color Reference

```tsx
// Internal to RoleBadge component
const roleVariants = {
  ADMIN: 'destructive',      // Red
  WHS: 'default',            // Blue
  SUPERVISOR: 'secondary',   // Gray
  TEAM_LEAD: 'outline',      // White with border
  WORKER: 'success',         // Green
} as const;
```

## Chart Colors

**Soft pastel palette - consistent across all charts**

```tsx
// Centralized in src/config/chartConfig.ts
export const CHART_COLORS = {
  primary: 'hsl(var(--chart-1))',      // Soft blue
  secondary: 'hsl(var(--chart-2))',    // Soft green
  tertiary: 'hsl(var(--chart-3))',     // Soft purple
  quaternary: 'hsl(var(--chart-4))',   // Soft orange
  quinary: 'hsl(var(--chart-5))',      // Soft pink
} as const;

// Usage in chartConfig
export const incidentTrendConfig = {
  incidents: {
    label: 'Incidents',
    color: CHART_COLORS.primary,
  },
  resolved: {
    label: 'Resolved',
    color: CHART_COLORS.secondary,
  },
} satisfies ChartConfig;
```

## Theme Token Examples

### Card Component

```tsx
// ✅ CORRECT - Uses semantic tokens
<Card className="border-border/70">
  <CardHeader>
    <CardTitle className="text-foreground">Title</CardTitle>
    <CardDescription className="text-muted-foreground">
      Description
    </CardDescription>
  </CardHeader>
</Card>

// ❌ WRONG - Hardcoded colors
<div className="border border-gray-200 bg-white">
  <h3 className="text-gray-900">Title</h3>
  <p className="text-gray-500">Description</p>
</div>
```

### Button Variants

```tsx
<Button variant="default">Primary</Button>      // bg-primary
<Button variant="secondary">Secondary</Button>  // bg-secondary
<Button variant="destructive">Delete</Button>   // bg-destructive
<Button variant="outline">Cancel</Button>       // border-input
<Button variant="ghost">Ghost</Button>          // transparent
```

### Input Component

```tsx
// ✅ CORRECT - Uses semantic tokens
<Input
  className="border-input focus:border-primary text-foreground"
  placeholder="Enter text"
/>

// ❌ WRONG
<input className="border-gray-300 text-gray-900" />
```

## Rules

- ✅ DO use Tailwind typography scale (`text-xs`, `text-sm`, `text-base`)
- ✅ DO use semantic color tokens (`text-foreground`, `text-muted-foreground`)
- ✅ DO use border opacities `/50` (subtle) or `/70` (container) ONLY
- ✅ DO use `variant="success"` for active status
- ✅ DO use `variant="secondary"` for inactive status
- ✅ DO use `tabular-nums` for numeric alignment in tables
- ✅ DO use RoleBadge component for role colors
- ✅ DO use CHART_COLORS from chartConfig.ts for charts
- ❌ NEVER use arbitrary font sizes like `text-[11px]` or `text-[15px]`
- ❌ NEVER hardcode gray colors like `text-gray-500` or `bg-gray-100`
- ❌ NEVER use border opacities other than `/50` or `/70`
- ❌ NEVER use `variant="destructive"` for inactive status
- ❌ NEVER inline role variant maps - use RoleBadge component
- ❌ NEVER use hardcoded hex colors for charts - use CHART_COLORS
