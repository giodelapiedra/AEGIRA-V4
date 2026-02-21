import type { Context } from 'hono';
import { CaseRepository, type CaseWithRelations, type CaseListItem } from './case.repository';
import { CaseService } from './case.service';
import type { GetCasesQuery, UpdateCaseInput } from './case.validator';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { parsePagination, calculateAge } from '../../shared/utils';

function getRepository(companyId: string): CaseRepository {
  return new CaseRepository(prisma, companyId);
}

function getService(companyId: string, timezone: string): CaseService {
  const repository = getRepository(companyId);
  return new CaseService(prisma, repository, timezone);
}

interface CaseListItemResponse {
  id: string;
  caseNumber: number;
  incident: { title: string; severity: string; reporterName: string };
  status: string;
  assigneeName: string | null;
  createdAt: string;
}

interface CaseDetailResponse {
  id: string;
  caseNumber: number;
  incidentId: string;
  incident: {
    id: string;
    incidentNumber: number;
    incidentType: string;
    severity: string;
    title: string;
    location: string | null;
    description: string;
    status: string;
    reporterId: string;
    reporterName: string;
    reporterEmail: string;
    reporterGender: string | null;
    reporterAge: number | null;
    teamName: string;
    createdAt: string;
  };
  assignedTo: string | null;
  assigneeName: string | null;
  status: string;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** Lean mapper for list views — only fields the table renders */
function mapCaseToListItem(caseRecord: CaseListItem): CaseListItemResponse {
  return {
    id: caseRecord.id,
    caseNumber: caseRecord.case_number,
    incident: {
      title: caseRecord.incident.title,
      severity: caseRecord.incident.severity,
      reporterName: `${caseRecord.incident.reporter.first_name} ${caseRecord.incident.reporter.last_name}`,
    },
    status: caseRecord.status,
    assigneeName: caseRecord.assignee
      ? `${caseRecord.assignee.first_name} ${caseRecord.assignee.last_name}`
      : null,
    createdAt: caseRecord.created_at.toISOString(),
  };
}

function mapCaseToResponse(caseRecord: CaseWithRelations, timezone: string): CaseDetailResponse {
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
      reporterGender: caseRecord.incident.reporter.gender,
      reporterAge: calculateAge(caseRecord.incident.reporter.date_of_birth, timezone),
      teamName: caseRecord.incident.reporter.team?.name ?? 'Unassigned',
      createdAt: caseRecord.incident.created_at.toISOString(),
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
 * List all cases for the company (WHS only).
 */
export async function getCases(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const { status, severity, search } = c.req.valid('query' as never) as GetCasesQuery;

  const repository = getRepository(companyId);

  const [result, statusCounts] = await Promise.all([
    repository.findForList({ page, limit, status, severity, search }),
    repository.countByStatus(),
  ]);

  const items = result.items.map(mapCaseToListItem);

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
 * Workers can view if they are the incident reporter; WHS can view all.
 */
export async function getCaseById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const timezone = c.get('companyTimezone') as string;
  const id = c.req.param('id');

  const repository = getRepository(companyId);
  const caseRecord = await repository.findById(id);

  if (!caseRecord) {
    throw new AppError('NOT_FOUND', 'Case not found', 404);
  }

  // Only WHS can view any case; others can only view cases linked to their own incidents
  const isWhs = userRole.toUpperCase() === 'WHS';
  if (!isWhs && caseRecord.incident.reporter.id !== userId) {
    throw new AppError('FORBIDDEN', 'You do not have permission to view this case', 403);
  }

  return c.json({
    success: true,
    data: mapCaseToResponse(caseRecord, timezone),
  });
}

/**
 * PATCH /api/v1/cases/:id
 * Update case (status, notes). WHS only.
 */
export async function updateCase(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const timezone = c.get('companyTimezone') as string;
  const id = c.req.param('id');
  const data = c.req.valid('json' as never) as UpdateCaseInput;

  const service = getService(companyId, timezone);
  const updated = await service.updateCase(id, companyId, userId, data);

  return c.json({
    success: true,
    data: mapCaseToResponse(updated, timezone),
  });
}
