/**
 * Centralized badge utilities for consistent status displays
 * Single source of truth for badge variants and labels
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
 * Active/Inactive Status Badge
 */
export function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? 'success' : 'secondary'}>
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  );
}

/**
 * Incident Status Badge
 */
export function IncidentStatusBadge({ status }: { status: 'PENDING' | 'APPROVED' | 'REJECTED' }) {
  const config = {
    PENDING: { variant: 'warning' as const, label: 'Pending' },
    APPROVED: { variant: 'success' as const, label: 'Approved' },
    REJECTED: { variant: 'destructive' as const, label: 'Rejected' },
  };

  const { variant, label } = config[status] || { variant: 'secondary' as const, label: status };

  return <Badge variant={variant}>{label}</Badge>;
}

/**
 * Severity Badge
 */
export function SeverityBadge({ severity }: { severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }) {
  const config = {
    LOW: { variant: 'info' as const, label: 'Low' },
    MEDIUM: { variant: 'warning' as const, label: 'Medium' },
    HIGH: { variant: 'warning' as const, label: 'High' },
    CRITICAL: { variant: 'destructive' as const, label: 'Critical' },
  };

  const { variant, label} = config[severity] || { variant: 'secondary' as const, label: severity };

  return <Badge variant={variant}>{label}</Badge>;
}

/**
 * Case Status Badge
 */
export function CaseStatusBadge({ status }: { status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' }) {
  const config = {
    OPEN: { variant: 'warning' as const, label: 'Open' },
    IN_PROGRESS: { variant: 'info' as const, label: 'In Progress' },
    RESOLVED: { variant: 'success' as const, label: 'Resolved' },
    CLOSED: { variant: 'secondary' as const, label: 'Closed' },
  };

  const { variant, label } = config[status] || { variant: 'secondary' as const, label: status };

  return <Badge variant={variant}>{label}</Badge>;
}
