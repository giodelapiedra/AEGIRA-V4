import type { Context } from 'hono';
import { IncidentRepository } from './incident.repository';
import { IncidentService } from './incident.service';
import type {
  CreateIncidentInput,
  GetIncidentsQuery,
  GetMyIncidentsQuery,
  RejectIncidentInput,
} from './incident.validator';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { parsePagination } from '../../shared/utils';

function getRepository(companyId: string): IncidentRepository {
  return new IncidentRepository(prisma, companyId);
}

function getService(): IncidentService {
  return new IncidentService(prisma);
}

function mapIncidentToResponse(incident: {
  id: string;
  incident_number: number;
  reporter_id: string;
  reporter: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    team: { id: string; name: string } | null;
  };
  incident_type: string;
  severity: string;
  title: string;
  location: string | null;
  description: string;
  status: string;
  reviewed_by: string | null;
  reviewer: { id: string; first_name: string; last_name: string } | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  rejection_explanation: string | null;
  incident_case: { id: string; case_number: number; status: string; notes: string | null } | null;
  created_at: Date;
}): Record<string, unknown> {
  return {
    id: incident.id,
    incidentNumber: incident.incident_number,
    reporterId: incident.reporter_id,
    reporterName: `${incident.reporter.first_name} ${incident.reporter.last_name}`,
    reporterEmail: incident.reporter.email,
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
  const data = c.req.valid('json') as CreateIncidentInput;

  const service = getService();
  const incident = await service.createIncident(data, companyId, userId);

  return c.json(
    { success: true, data: mapIncidentToResponse(incident as Parameters<typeof mapIncidentToResponse>[0]) },
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
  const { status } = c.req.valid('query') as GetMyIncidentsQuery;

  const repository = getRepository(companyId);

  const [result, statusCounts] = await Promise.all([
    repository.findByFilters({ page, limit, status, reporterId: userId }),
    repository.countByStatus(userId),
  ]);

  const items = result.items.map((incident) =>
    mapIncidentToResponse(incident as Parameters<typeof mapIncidentToResponse>[0])
  );

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
 * List all incidents for the company (WHS/ADMIN only).
 */
export async function getIncidents(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const { status, severity, type, search } = c.req.valid('query') as GetIncidentsQuery;

  const repository = getRepository(companyId);

  const [result, statusCounts] = await Promise.all([
    repository.findByFilters({ page, limit, status, severity, type, search }),
    repository.countByStatus(),
  ]);

  const items = result.items.map((incident) =>
    mapIncidentToResponse(incident as Parameters<typeof mapIncidentToResponse>[0])
  );

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
 * Workers can only view their own; WHS/ADMIN can view all.
 */
export async function getIncidentById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const id = c.req.param('id');

  const repository = getRepository(companyId);
  const incident = await repository.findById(id);

  if (!incident) {
    throw new AppError('NOT_FOUND', 'Incident not found', 404);
  }

  // Non-WHS/ADMIN users can only view their own incidents
  const whsOrAdmin = ['ADMIN', 'WHS'].includes(userRole.toUpperCase());
  if (!whsOrAdmin && incident.reporter_id !== userId) {
    throw new AppError('FORBIDDEN', 'You do not have permission to view this incident', 403);
  }

  return c.json({
    success: true,
    data: mapIncidentToResponse(incident as Parameters<typeof mapIncidentToResponse>[0]),
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

  // Verify access
  const incident = await repository.findById(id);
  if (!incident) {
    throw new AppError('NOT_FOUND', 'Incident not found', 404);
  }

  const whsOrAdmin = ['ADMIN', 'WHS'].includes(userRole.toUpperCase());
  if (!whsOrAdmin && incident.reporter_id !== userId) {
    throw new AppError('FORBIDDEN', 'You do not have permission to view this timeline', 403);
  }

  const events = await repository.getTimeline(id);

  const mappedEvents = (events as Array<{
    id: string;
    event_type: string;
    person_id: string | null;
    person: { id: string; first_name: string; last_name: string } | null;
    payload: unknown;
    created_at: Date;
  }>).map((event) => ({
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
 * Approve an incident and create a case (WHS/ADMIN only).
 */
export async function approveIncident(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const service = getService();
  const incident = await service.approveIncident(id, companyId, userId);

  return c.json({
    success: true,
    data: mapIncidentToResponse(incident as Parameters<typeof mapIncidentToResponse>[0]),
  });
}

/**
 * PATCH /api/v1/incidents/:id/reject
 * Reject an incident with reason and explanation (WHS/ADMIN only).
 */
export async function rejectIncident(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const data = c.req.valid('json') as RejectIncidentInput;

  const service = getService();
  const incident = await service.rejectIncident(id, companyId, userId, data);

  return c.json({
    success: true,
    data: mapIncidentToResponse(incident as Parameters<typeof mapIncidentToResponse>[0]),
  });
}
