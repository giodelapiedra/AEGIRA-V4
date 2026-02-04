import type { UserRole } from '@/types/auth.types';
import type { ReadinessCategory } from '@/types/check-in.types';

/**
 * Format number with locale
 */
export function formatNumber(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format currency
 */
export function formatCurrency(
  value: number,
  currency = 'USD',
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Format readiness score with color class
 */
export function getReadinessColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Convert 24-hour time string (HH:mm) to 12-hour format with AM/PM.
 * "06:00" → "6:00 AM", "18:00" → "6:00 PM", "23:10" → "11:10 PM"
 */
export function formatTime12h(time24: string): string {
  const parts = time24.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const hours12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hours12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Format check-in window as "6:00 AM - 10:00 AM"
 */
export function formatScheduleWindow(start: string, end: string): string {
  return `${formatTime12h(start || '06:00')} - ${formatTime12h(end || '10:00')}`;
}

/**
 * Get readiness category label
 */
export function getReadinessLabel(category: ReadinessCategory): string {
  const labels: Record<ReadinessCategory, string> = {
    ready: 'Ready',
    modified_duty: 'Modified Duty',
    needs_attention: 'Needs Attention',
    not_ready: 'Not Ready',
  };
  return labels[category];
}

/**
 * Shared role display labels — single source of truth
 * Must include all values from UserRole type in auth.types.ts
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  WORKER: 'Worker',
  TEAM_LEAD: 'Team Lead',
  SUPERVISOR: 'Supervisor',
  WHS: 'WHS',
  ADMIN: 'Admin',
};

/**
 * Convert backend readiness level (GREEN/YELLOW/RED) to frontend category
 */
export function levelToCategory(level: string): 'ready' | 'modified_duty' | 'needs_attention' | 'not_ready' {
  switch (level) {
    case 'GREEN': return 'ready';
    case 'YELLOW': return 'modified_duty';
    case 'RED': return 'not_ready';
    default: return 'needs_attention';
  }
}

// ---------------------------------------------------------------------------
// Incident / Case formatting — single source of truth
// ---------------------------------------------------------------------------

/**
 * Format incident number: INC-2026-0001
 */
export function formatIncidentNumber(num: number, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  return `INC-${year}-${String(num).padStart(4, '0')}`;
}

/**
 * Format case number: CASE-2026-0001
 */
export function formatCaseNumber(num: number, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  return `CASE-${year}-${String(num).padStart(4, '0')}`;
}

/**
 * Human-readable incident type label
 */
export function formatIncidentType(type: string): string {
  const labels: Record<string, string> = {
    PHYSICAL_INJURY: 'Physical Injury',
    ILLNESS_SICKNESS: 'Illness / Sickness',
    MENTAL_HEALTH: 'Mental Health',
    MEDICAL_EMERGENCY: 'Medical Emergency',
    HEALTH_SAFETY_CONCERN: 'Health & Safety Concern',
    OTHER: 'Other',
  };
  return labels[type] ?? type;
}

/**
 * Human-readable rejection reason label
 */
export function formatRejectionReason(reason: string): string {
  const labels: Record<string, string> = {
    DUPLICATE_REPORT: 'Duplicate Report',
    INSUFFICIENT_INFORMATION: 'Insufficient Information',
    NOT_WORKPLACE_INCIDENT: 'Not a Workplace Incident',
    OTHER: 'Other',
  };
  return labels[reason] ?? reason;
}
