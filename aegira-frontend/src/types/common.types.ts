/**
 * Common Types - Shared across all features
 */

// Standard paginated response from backend
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Notification Types - Must match backend Notification model
 */
export type NotificationType =
  | 'CHECK_IN_REMINDER'   // Daily check-in reminder
  | 'MISSED_CHECK_IN'     // Missed check-in alert
  | 'TEAM_ALERT'          // Team status alerts (for leaders)
  | 'SYSTEM'              // System notifications
  | 'INCIDENT_SUBMITTED'  // Incident report submitted
  | 'INCIDENT_APPROVED'   // Incident approved, case created
  | 'INCIDENT_REJECTED';  // Incident not approved

export interface Notification {
  id: string;
  person_id: string;
  company_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read_at: string | null;      // null if unread
  archived_at: string | null;  // null if active
  created_at: string;
}

export interface NotificationUnreadCount {
  count: number;
}

