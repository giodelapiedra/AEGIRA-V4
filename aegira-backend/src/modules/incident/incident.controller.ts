import type { Context } from 'hono';
import { IncidentRepository, type IncidentWithRelations, type IncidentListItem } from './incident.repository';
import { IncidentService } from './incident.service';
import type {
  CreateIncidentInput,
  GetIncidentsQuery,
  GetMyIncidentsQuery,
  RejectIncidentInput,
} from './incident.validator';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { parsePagination, calculateAge } from '../../shared/utils';

function getRepository(companyId: string): IncidentRepository {
  return new IncidentRepository(prisma, companyId);
}

function getService(timezone: string): IncidentService {
  return new IncidentService(prisma, timezone);
}

interface IncidentListItemResponse {
  id: string;
  incidentNumber: number;
  incidentType: string;
  severity: string;
  title: string;
  status: string;
  reporterName: string;
  teamName: string;
  reviewerName: string | null;
  createdAt: string;
}

interface IncidentDetailResponse {
  id: string;
  incidentNumber: number;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reporterGender: string | null;
  reporterAge: number | null;
  teamName: string;
  incidentType: string;
  severity: string;
  title: string;
  location: string | null;
  description: string;
  status: string;
  reviewedBy: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  rejectionExplanation: string | null;
  caseId: string | null;
  caseNumber: number | null;
  caseStatus: string | null;
  caseNotes: string | null;
  createdAt: string;
}

/** Lean mapper for list views — only fields the table renders */
function mapIncidentToListItem(incident: IncidentListItem): IncidentListItemResponse {
  return {
    id: incident.id,
    incidentNumber: incident.incident_number,
    incidentType: incident.incident_type,
    severity: incident.severity,
    title: incident.title,
    status: incident.status,
    reporterName: `${incident.reporter.first_name} ${incident.reporter.last_name}`,
    teamName: incident.reporter.team?.name ?? 'Unassigned',
    reviewerName: incident.reviewer
      ? `${incident.reviewer.first_name} ${incident.reviewer.last_name}`
      : null,
    createdAt: incident.created_at.toISOString(),
  };
}

/** Full mapper for detail views — includes all fields + computed values */
function mapIncidentToResponse(incident: IncidentWithRelations, timezone: string): IncidentDetailResponse {
  return {
    id: incident.id,
    incidentNumber: incident.incident_number,
    reporterId: incident.reporter_id,
    reporterName: `${incident.reporter.first_name} ${incident.reporter.last_name}`,
    reporterEmail: incident.reporter.email,
    reporterGender: incident.reporter.gender,
    reporterAge: calculateAge(incident.reporter.date_of_birth, timezone),
    teamName: incident.reporter.team?.name ?? 'Unassigned',
    incidentType: incident.incident_type,
    severity: incident.severity,
    title: incident.title,
    location: incident.location,
    description: incident.description,
    status: incident.status,
    reviewedBy: incident.reviewed_by,
    reviewerName: incident.reviewer
      ? `${incident.reviewer.first_name} ${incident.reviewer.last_name}`
      : null,
    reviewedAt: incident.reviewed_at?.toISOString() ?? null,
    rejectionReason: incident.rejection_reason,
    rejectionExplanation: incident.rejection_explanation,
    caseId: incident.incident_case?.id ?? null,
    caseNumber: incident.incident_case?.case_number ?? null,
    caseStatus: incident.incident_case?.status ?? null,
    caseNotes: incident.incident_case?.notes ?? null,
    createdAt: incident.created_at.toISOString(),
  };
}

/**
 * POST /api/v1/incidents
 * Create a new incident report.
 */
export async function createIncident(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const timezone = c.get('companyTimezone') as string;
  const data = c.req.valid('json' as never) as CreateIncidentInput;

  const service = getService(timezone);
  const incident = await service.createIncident(data, companyId, userId);

  return c.json(
    { success: true, data: mapIncidentToResponse(incident, timezone) },
    201
  );
}

/**
 * GET /api/v1/incidents/my
 * List the current user's own incidents (paginated, filterable by status).
 */
export async function getMyIncidents(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const { status } = c.req.valid('query' as never) as GetMyIncidentsQuery;

  const repository = getRepository(companyId);

  const [result, statusCounts] = await Promise.all([
    repository.findForList({ page, limit, status, reporterId: userId }),
    repository.countByStatus({ reporterId: userId }),
  ]);

  const items = result.items.map(mapIncidentToListItem);

  return c.json({
    success: true,
    data: {
      items,
      pagination: result.pagination,
      statusCounts,
    },
  });
}

/**
 * GET /api/v1/incidents
 * List all incidents for the company (WHS only).
 */
export async function getIncidents(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const { status, severity, type, search } = c.req.valid('query' as never) as GetIncidentsQuery;

  const repository = getRepository(companyId);

  const [result, statusCounts] = await Promise.all([
    repository.findForList({ page, limit, status, severity, type, search }),
    repository.countByStatus({ severity, type, search }),
  ]);

  const items = result.items.map(mapIncidentToListItem);

  return c.json({
    success: true,
    data: {
      items,
      pagination: result.pagination,
      statusCounts,
    },
  });
}

/**
 * GET /api/v1/incidents/:id
 * Get a single incident by ID.
 * Workers can only view their own; WHS can view all.
 */
export async function getIncidentById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const timezone = c.get('companyTimezone') as string;
  const id = c.req.param('id');

  const repository = getRepository(companyId);
  const incident = await repository.findById(id);

  if (!incident) {
    throw new AppError('NOT_FOUND', 'Incident not found', 404);
  }

  // Only WHS can view any incident; others can only view their own
  const isWhs = userRole.toUpperCase() === 'WHS';
  if (!isWhs && incident.reporter_id !== userId) {
    throw new AppError('FORBIDDEN', 'You do not have permission to view this incident', 403);
  }

  return c.json({
    success: true,
    data: mapIncidentToResponse(incident, timezone),
  });
}

/**
 * GET /api/v1/incidents/:id/timeline
 * Get incident event timeline.
 */
export async function getIncidentTimeline(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const id = c.req.param('id');

  const repository = getRepository(companyId);

  // Lean access check (avoids loading full incident relations)
  const incident = await repository.findForAccessCheck(id);
  if (!incident) {
    throw new AppError('NOT_FOUND', 'Incident not found', 404);
  }

  const isWhs = userRole.toUpperCase() === 'WHS';
  if (!isWhs && incident.reporter_id !== userId) {
    throw new AppError('FORBIDDEN', 'You do not have permission to view this timeline', 403);
  }

  const events = await repository.getTimeline(id);

  const mappedEvents = events.map((event) => ({
    id: event.id,
    eventType: event.event_type,
    personId: event.person_id,
    personName: event.person
      ? `${event.person.first_name} ${event.person.last_name}`
      : null,
    payload: event.payload as Record<string, unknown>,
    createdAt: event.created_at.toISOString(),
  }));

  return c.json({ success: true, data: mappedEvents });
}

/**
 * PATCH /api/v1/incidents/:id/approve
 * Approve an incident and create a case (WHS only).
 */
export async function approveIncident(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const timezone = c.get('companyTimezone') as string;
  const service = getService(timezone);
  const incident = await service.approveIncident(id, companyId, userId);

  return c.json({
    success: true,
    data: mapIncidentToResponse(incident, timezone),
  });
}

/**
 * PATCH /api/v1/incidents/:id/reject
 * Reject an incident with reason and explanation (WHS only).
 */
export async function rejectIncident(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const data = c.req.valid('json' as never) as RejectIncidentInput;

  const timezone = c.get('companyTimezone') as string;
  const service = getService(timezone);
  const incident = await service.rejectIncident(id, companyId, userId, data);

  return c.json({
    success: true,
    data: mapIncidentToResponse(incident, timezone),
  });
}
