// MissedCheckIn Controller - Request Handling
import type { Context } from 'hono';
import { MissedCheckInRepository } from './missed-check-in.repository';
import type { GetMissedCheckInsQuery } from './missed-check-in.validator';
import { prisma } from '../../config/database';
import { getTeamContext } from '../../shared/team-context';
import { parsePagination } from '../../shared/utils';

function getRepository(companyId: string): MissedCheckInRepository {
  return new MissedCheckInRepository(prisma, companyId);
}

/**
 * GET /api/v1/teams/missed-check-ins
 * Returns missed check-ins from the database (persistent records).
 * Supports pagination and workerId filter.
 * TEAM_LEAD sees own team; SUPERVISOR sees assigned teams; ADMIN sees all.
 */
export async function getMissedCheckIns(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const { workerId: workerIdParam } = c.req.valid('query' as never) as GetMissedCheckInsQuery;

  const { teamIds } = await getTeamContext(companyId, userId, userRole, c.get('companyTimezone') as string);

  // No teams assigned
  if (teamIds !== null && teamIds.length === 0) {
    return c.json({
      success: true,
      data: {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      },
    });
  }

  const repository = getRepository(companyId);

  // Parse resolved filter: 'true' | 'false' | undefined (all)
  const resolvedParam = c.req.query('resolved');
  const resolved = resolvedParam === 'true' ? true : resolvedParam === 'false' ? false : undefined;

  const result = await repository.findByFilters({
    page,
    limit,
    teamIds: teamIds || undefined,
    personId: workerIdParam || undefined,
    resolved,
  });

  // Transform to API response shape (includes state snapshot for analytics)
  const items = result.items.map((record) => ({
    id: record.id,
    workerId: record.person_id,
    workerName: `${record.person.first_name} ${record.person.last_name}`,
    workerEmail: record.person.email,
    teamName: record.team.name,
    // Snapshot fields - saved to DB at detection time (immutable even if leader changes)
    teamLeaderId: record.team_leader_id_at_miss ?? null,
    teamLeaderName: record.team_leader_name_at_miss ?? null,
    date: record.missed_date,
    scheduleWindow: record.schedule_window,
    createdAt: record.created_at,
    // Resolution tracking (Phase 2)
    resolvedByCheckInId: record.resolved_by_check_in_id ?? null,
    resolvedAt: record.resolved_at ?? null,
    // State snapshot fields (for detail view)
    stateSnapshot: {
      dayOfWeek: record.day_of_week,
      checkInStreakBefore: record.check_in_streak_before,
      recentReadinessAvg: record.recent_readiness_avg,
      daysSinceLastCheckIn: record.days_since_last_check_in,
      daysSinceLastMiss: record.days_since_last_miss,
      missesInLast30d: record.misses_in_last_30d,
      missesInLast60d: record.misses_in_last_60d,
      missesInLast90d: record.misses_in_last_90d,
      baselineCompletionRate: record.baseline_completion_rate,
      isFirstMissIn30d: record.is_first_miss_in_30d,
      isIncreasingFrequency: record.is_increasing_frequency,
    },
  }));

  return c.json({
    success: true,
    data: {
      items,
      pagination: result.pagination,
    },
  });
}
