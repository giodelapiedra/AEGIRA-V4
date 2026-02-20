/**
 * Centralized application constants
 * Single source of truth for hardcoded values used across the app
 */

/**
 * Pagination configuration
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 30, 50, 100],
  MIN_PAGE: 1,
} as const;

/**
 * Day names (0 = Sunday, 6 = Saturday)
 */
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Short month names (for charts)
 */
export const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Semantic status styles used across badges, indicators, and labels.
 * Keep these centralized so status styling remains consistent app-wide.
 */
export const SEMANTIC_STATUS = {
  READINESS_LEVEL: {
    GREEN: {
      label: 'Ready',
      variant: 'success',
      indicator: 'bg-green-500',
    },
    YELLOW: {
      label: 'Modified Duty',
      variant: 'warning',
      indicator: 'bg-yellow-500',
    },
    RED: {
      label: 'Not Ready',
      variant: 'destructive',
      indicator: 'bg-red-500',
    },
  },
  READINESS_CATEGORY: {
    ready: {
      label: 'Ready',
      variant: 'success',
    },
    modified_duty: {
      label: 'Modified Duty',
      variant: 'warning',
    },
    needs_attention: {
      label: 'Needs Attention',
      variant: 'orange',
    },
    not_ready: {
      label: 'Not Ready',
      variant: 'destructive',
    },
  },
  READINESS_IMPACT: {
    positive: {
      bar: 'bg-green-500',
      text: 'text-green-700 dark:text-green-400',
    },
    neutral: {
      bar: 'bg-yellow-500',
      text: 'text-yellow-700 dark:text-yellow-400',
    },
    negative: {
      bar: 'bg-red-500',
      text: 'text-red-700 dark:text-red-400',
    },
  },
  INCIDENT_STATUS: {
    PENDING: {
      label: 'Pending',
      variant: 'warning',
    },
    APPROVED: {
      label: 'Approved',
      variant: 'success',
    },
    REJECTED: {
      label: 'Rejected',
      variant: 'destructive',
    },
  },
  INCIDENT_SEVERITY: {
    LOW: {
      label: 'Low',
      variant: 'slate',
    },
    MEDIUM: {
      label: 'Medium',
      variant: 'warning',
    },
    HIGH: {
      label: 'High',
      variant: 'orange',
    },
    CRITICAL: {
      label: 'Critical',
      variant: 'destructive',
    },
  },
  CASE_STATUS: {
    OPEN: {
      label: 'Open',
      variant: 'info',
    },
    INVESTIGATING: {
      label: 'Investigating',
      variant: 'violet',
    },
    RESOLVED: {
      label: 'Resolved',
      variant: 'success',
    },
    CLOSED: {
      label: 'Closed',
      variant: 'slate',
    },
  },
  MISSED_CHECK_IN_STATUS: {
    RESOLVED_LATE: {
      label: 'Resolved (Late)',
      variant: 'amber',
    },
    UNRESOLVED: {
      label: 'Unresolved',
      variant: 'destructive',
    },
  },
} as const;

/**
 * Semantic surface styles for alert/notice containers.
 */
export const SEMANTIC_SURFACE = {
  WARNING_SOFT:
    'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400',
} as const;
