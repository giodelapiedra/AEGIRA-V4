/**
 * Centralized badge utilities for consistent status displays
 * Single source of truth for badge variants and labels
 *
 * Note: Incident-specific badges (IncidentStatusBadge, SeverityBadge, CaseStatusBadge)
 * live in features/incident/components/ — do not duplicate here.
 */

import { Badge } from '@/components/ui/badge';
import { SEMANTIC_STATUS } from '@/lib/constants';

/**
 * Readiness Level Badge (GREEN/YELLOW/RED)
 */
export function ReadinessBadge({ level }: { level: 'GREEN' | 'YELLOW' | 'RED' }) {
  const config = SEMANTIC_STATUS.READINESS_LEVEL;

  const { variant, label } = config[level] || { variant: 'secondary' as const, label: level };

  return <Badge variant={variant}>{label}</Badge>;
}

/**
 * Readiness Category Badge (ready/modified_duty/needs_attention/not_ready)
 * Used for check-in results where category is derived from readiness score.
 */
export function ReadinessCategoryBadge({ category }: { category?: string }) {
  if (!category) return <Badge variant="outline">-</Badge>;

  const statusConfig =
    SEMANTIC_STATUS.READINESS_CATEGORY[
      category as keyof typeof SEMANTIC_STATUS.READINESS_CATEGORY
    ];

  if (!statusConfig) return <Badge variant="outline">{category}</Badge>;

  return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
}

/**
 * Missed Check-In Resolution Status Badge
 */
export function MissedCheckInStatusBadge({ resolvedAt }: { resolvedAt?: string | null }) {
  if (resolvedAt) {
    return (
      <Badge variant={SEMANTIC_STATUS.MISSED_CHECK_IN_STATUS.RESOLVED_LATE.variant}>
        {SEMANTIC_STATUS.MISSED_CHECK_IN_STATUS.RESOLVED_LATE.label}
      </Badge>
    );
  }
  return (
    <Badge variant={SEMANTIC_STATUS.MISSED_CHECK_IN_STATUS.UNRESOLVED.variant}>
      {SEMANTIC_STATUS.MISSED_CHECK_IN_STATUS.UNRESOLVED.label}
    </Badge>
  );
}

/**
 * Submission Status Badge (On Time / Late)
 */
export function SubmissionStatusBadge({ isLate }: { isLate?: boolean }) {
  if (isLate === undefined) return <Badge variant="outline">--</Badge>;
  if (!isLate) return <Badge variant="success">On Time</Badge>;
  return <Badge variant="warning">Late</Badge>;
}
