import type { Context } from 'hono';
import { CaseRepository, type CaseWithRelations } from './case.repository';
import { CaseService } from './case.service';
import type { GetCasesQuery, UpdateCaseInput } from './case.validator';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { parsePagination } from '../../shared/utils';
import { DateTime } from 'luxon';

function getRepository(companyId: string): CaseRepository {
  return new CaseRepository(prisma, companyId);
}

function getService(companyId: string, timezone: string): CaseService {
  const repository = getRepository(companyId);
  return new CaseService(prisma, repository, timezone);
}

function calculateAge(dateOfBirth: Date | null, timezone: string): number | null {
  if (!dateOfBirth) return null;
  const now = DateTime.now().setZone(timezone);
  let age = now.year - dateOfBirth.getUTCFullYear();
  const monthDiff = now.month - (dateOfBirth.getUTCMonth() + 1);
  if (monthDiff < 0 || (monthDiff === 0 && now.day < dateOfBirth.getUTCDate())) {
    age--;
  }
  return age;
}

function mapCaseToResponse(caseRecord: CaseWithRelations, timezone: string): Record<string, unknown> {
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
  const timezone = c.get('companyTimezone') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const { status, search } = c.req.valid('query' as never) as GetCasesQuery;

  const repository = getRepository(companyId);

  const [result, statusCounts] = await Promise.all([
    repository.findByFilters({ page, limit, status, search }),
    repository.countByStatus(),
  ]);

  const items = result.items.map((caseRecord) =>
    mapCaseToResponse(caseRecord, timezone)
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
  const timezone = c.get('companyTimezone') as string;
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
    data: mapCaseToResponse(caseRecord, timezone),
  });
}

/**
 * PATCH /api/v1/cases/:id
 * Update case (status, assignment, notes). WHS/ADMIN only.
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
