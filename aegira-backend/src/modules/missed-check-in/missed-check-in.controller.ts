// MissedCheckIn Controller - Request Handling
import type { Context } from 'hono';
import { MissedCheckInRepository } from './missed-check-in.repository';
import { MissedCheckInService } from './missed-check-in.service';
import type { GetMissedCheckInsQuery, UpdateMissedCheckInInput } from './missed-check-in.validator';
import { prisma } from '../../config/database';
import { getTeamContext } from '../../shared/team-context';
import { parsePagination } from '../../shared/utils';

function getRepository(companyId: string): MissedCheckInRepository {
  return new MissedCheckInRepository(prisma, companyId);
}

/**
 * GET /api/v1/teams/missed-check-ins
 * Returns missed check-ins from the database (persistent records).
 * Supports pagination and status filter.
 * TEAM_LEAD sees own team; SUPERVISOR sees assigned teams; ADMIN sees all.
 */
export async function getMissedCheckIns(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const { status: statusFilter, workerId: workerIdParam } = c.req.valid('query') as GetMissedCheckInsQuery;

  const { teamIds } = await getTeamContext(companyId, userId, userRole, c.get('companyTimezone') as string);

  // No teams assigned
  if (teamIds !== null && teamIds.length === 0) {
    return c.json({
      success: true,
      data: {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        statusCounts: { OPEN: 0, INVESTIGATING: 0, EXCUSED: 0, RESOLVED: 0 },
      },
    });
  }

  const repository = getRepository(companyId);

  // Fetch paginated records and status counts in parallel
  const [result, statusCounts] = await Promise.all([
    repository.findByFilters({
      page,
      limit,
      status: statusFilter,
      teamIds: teamIds || undefined,
      personId: workerIdParam || undefined,
    }),
    repository.countByStatus(teamIds || undefined),
  ]);

  // Transform to API response shape (backward-compatible)
  const items = result.items.map((record) => ({
    id: record.id,
    workerId: record.person_id,
    workerName: `${record.person.first_name} ${record.person.last_name}`,
    workerEmail: record.person.email,
    teamName: record.team.name,
    date: record.missed_date,
    scheduleWindow: record.schedule_window,
    status: record.status,
    notes: record.notes,
    resolvedBy: record.resolved_by,
    resolvedAt: record.resolved_at,
    reason: 'No check-in submitted',
    createdAt: record.created_at,
  }));

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
 * PATCH /api/v1/teams/missed-check-ins/:id
 * Update the status of a missed check-in record.
 * Valid transitions: OPEN → INVESTIGATING|EXCUSED|RESOLVED, INVESTIGATING → EXCUSED|RESOLVED
 */
export async function updateMissedCheckInStatus(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const { status, notes } = c.req.valid('json') as UpdateMissedCheckInInput;

  const repository = getRepository(companyId);
  const service = new MissedCheckInService(repository);

  const updated = await service.updateStatus(
    id,
    status,
    userId,
    notes
  );

  return c.json({ success: true, data: updated });
}
