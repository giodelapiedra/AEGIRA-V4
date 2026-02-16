export type IncidentType =
  | 'PHYSICAL_INJURY'
  | 'ILLNESS_SICKNESS'
  | 'MENTAL_HEALTH'
  | 'MEDICAL_EMERGENCY'
  | 'HEALTH_SAFETY_CONCERN'
  | 'OTHER';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CaseStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export type RejectionReason =
  | 'DUPLICATE_REPORT'
  | 'INSUFFICIENT_INFORMATION'
  | 'NOT_WORKPLACE_INCIDENT'
  | 'OTHER';

export type Gender = 'MALE' | 'FEMALE';

/** Lean type for list/table views — only fields returned by list endpoints */
export interface IncidentListItem {
  id: string;
  incidentNumber: number;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  status: IncidentStatus;
  reporterName: string;
  teamName: string;
  reviewerName: string | null;
  createdAt: string;
}

/** Full type for detail views — all fields returned by GET /incidents/:id */
export interface Incident {
  id: string;
  incidentNumber: number;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reporterGender: Gender | null;
  reporterAge: number | null;
  teamName: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  location: string | null;
  description: string;
  status: IncidentStatus;
  reviewedBy: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  rejectionReason: RejectionReason | null;
  rejectionExplanation: string | null;
  caseId: string | null;
  caseNumber: number | null;
  caseStatus: CaseStatus | null;
  caseNotes: string | null;
  createdAt: string;
}

export interface Case {
  id: string;
  caseNumber: number;
  incidentId: string;
  incident: {
    id: string;
    incidentNumber: number;
    incidentType: IncidentType;
    severity: IncidentSeverity;
    title: string;
    location: string | null;
    description: string;
    status: IncidentStatus;
    reporterId: string;
    reporterName: string;
    reporterEmail: string;
    reporterGender: Gender | null;
    reporterAge: number | null;
    teamName: string;
  };
  assignedTo: string | null;
  assigneeName: string | null;
  status: CaseStatus;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface CreateIncidentData {
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  location?: string;
  description: string;
}

export interface RejectIncidentData {
  rejectionReason: RejectionReason;
  rejectionExplanation: string;
}

export interface UpdateCaseData {
  assignedTo?: string | null;
  status?: CaseStatus;
  notes?: string;
}

export interface IncidentEvent {
  id: string;
  eventType: string;
  personId: string | null;
  personName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface IncidentListResponse {
  items: IncidentListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statusCounts: Record<IncidentStatus, number>;
}

export interface CaseListResponse {
  items: Case[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statusCounts: Record<CaseStatus, number>;
}
