/**
 * Centralized badge utilities for consistent status displays
 * Single source of truth for badge variants and labels
 *
 * Note: Incident-specific badges (IncidentStatusBadge, SeverityBadge, CaseStatusBadge)
 * live in features/incident/components/ — do not duplicate here.
 */

import { Badge } from '@/components/ui/badge';

/**
 * Readiness Level Badge (GREEN/YELLOW/RED)
 */
export function ReadinessBadge({ level }: { level: 'GREEN' | 'YELLOW' | 'RED' }) {
  const config = {
    GREEN: { variant: 'success' as const, label: 'Green' },
    YELLOW: { variant: 'warning' as const, label: 'Yellow' },
    RED: { variant: 'destructive' as const, label: 'Red' },
  };

  const { variant, label } = config[level] || { variant: 'secondary' as const, label: level };

  return <Badge variant={variant}>{label}</Badge>;
}

/**
 * Readiness Category Badge (ready/modified_duty/needs_attention/not_ready)
 * Used for check-in results where category is derived from readiness score.
 */
export function ReadinessCategoryBadge({ category }: { category?: string }) {
  if (!category) return <Badge variant="outline">-</Badge>;

  switch (category) {
    case 'ready':
      return <Badge variant="success">Ready</Badge>;
    case 'modified_duty':
      return <Badge variant="warning">Modified Duty</Badge>;
    case 'needs_attention':
      return <Badge className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400">Needs Attention</Badge>;
    case 'not_ready':
      return <Badge variant="destructive">Not Ready</Badge>;
    default:
      return <Badge variant="outline">{category}</Badge>;
  }
}

/**
 * Missed Check-In Resolution Status Badge
 */
export function MissedCheckInStatusBadge({ resolvedAt }: { resolvedAt?: string | null }) {
  if (resolvedAt) {
    return <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">Resolved (Late)</Badge>;
  }
  return <Badge variant="destructive">Unresolved</Badge>;
}

/**
 * Submission Status Badge (On Time / Late)
 */
export function SubmissionStatusBadge({ isLate }: { isLate?: boolean }) {
  if (isLate === undefined) return <Badge variant="outline">--</Badge>;
  if (!isLate) return <Badge variant="success">On Time</Badge>;
  return <Badge variant="warning">Late</Badge>;
}
