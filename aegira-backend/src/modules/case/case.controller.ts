import type { Context } from 'hono';
import { CaseRepository } from './case.repository';
import { CaseService } from './case.service';
import type { GetCasesQuery, UpdateCaseInput } from './case.validator';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { parsePagination } from '../../shared/utils';

function getRepository(companyId: string): CaseRepository {
  return new CaseRepository(prisma, companyId);
}

function getService(companyId: string): CaseService {
  const repository = getRepository(companyId);
  return new CaseService(prisma, repository);
}

function mapCaseToResponse(caseRecord: {
  id: string;
  case_number: number;
  incident_id: string;
  incident: {
    id: string;
    incident_number: number;
    incident_type: string;
    severity: string;
    title: string;
    location: string | null;
    description: string;
    status: string;
    reporter: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      team: { id: string; name: string } | null;
    };
  };
  assigned_to: string | null;
  assignee: { id: string; first_name: string; last_name: string } | null;
  status: string;
  notes: string | null;
  resolved_at: Date | null;
  created_at: Date;
}): Record<string, unknown> {
  return {
    id: caseRecord.id,
    caseNumber: caseRecord.case_number,
    incidentId: caseRecord.incident_id,
    incident: {
      id: caseRecord.incident.id,
      incidentNumber: caseRecord.incident.incident_number,
      incidentType: caseRecord.incident.incident_type,
      severity: caseRecord.incident.severity,
      title: caseRecord.incident.title,
      location: caseRecord.incident.location,
      description: caseRecord.incident.description,
      status: caseRecord.incident.status,
      reporterId: caseRecord.incident.reporter.id,
      reporterName: `${caseRecord.incident.reporter.first_name} ${caseRecord.incident.reporter.last_name}`,
      reporterEmail: caseRecord.incident.reporter.email,
      teamName: caseRecord.incident.reporter.team?.name ?? 'Unassigned',
    },
    assignedTo: caseRecord.assigned_to,
    assigneeName: caseRecord.assignee
      ? `${caseRecord.assignee.first_name} ${caseRecord.assignee.last_name}`
      : null,
    status: caseRecord.status,
    notes: caseRecord.notes,
    resolvedAt: caseRecord.resolved_at?.toISOString() ?? null,
    createdAt: caseRecord.created_at.toISOString(),
  };
}

/**
 * GET /api/v1/cases
 * List all cases for the company (WHS/ADMIN only).
 */
export async function getCases(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const { status, search } = c.req.valid('query') as GetCasesQuery;

  const repository = getRepository(companyId);

  const [result, statusCounts] = await Promise.all([
    repository.findByFilters({ page, limit, status, search }),
    repository.countByStatus(),
  ]);

  const items = result.items.map((caseRecord) =>
    mapCaseToResponse(caseRecord as Parameters<typeof mapCaseToResponse>[0])
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
 * GET /api/v1/cases/:id
 * Get a single case by ID.
 * Workers can view if they are the incident reporter; WHS/ADMIN can view all.
 */
export async function getCaseById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const id = c.req.param('id');

  const repository = getRepository(companyId);
  const caseRecord = await repository.findById(id);

  if (!caseRecord) {
    throw new AppError('NOT_FOUND', 'Case not found', 404);
  }

  // Non-WHS/ADMIN users can only view cases linked to their own incidents
  const whsOrAdmin = ['ADMIN', 'WHS'].includes(userRole.toUpperCase());
  if (!whsOrAdmin && caseRecord.incident.reporter.id !== userId) {
    throw new AppError('FORBIDDEN', 'You do not have permission to view this case', 403);
  }

  return c.json({
    success: true,
    data: mapCaseToResponse(caseRecord as Parameters<typeof mapCaseToResponse>[0]),
  });
}

/**
 * PATCH /api/v1/cases/:id
 * Update case (status, assignment, notes). WHS/ADMIN only.
 */
export async function updateCase(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const data = c.req.valid('json') as UpdateCaseInput;

  const service = getService(companyId);
  const updated = await service.updateCase(id, companyId, userId, data);

  return c.json({
    success: true,
    data: mapCaseToResponse(updated as Parameters<typeof mapCaseToResponse>[0]),
  });
}
