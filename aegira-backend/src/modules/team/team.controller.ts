// Team Controller - Request Handling
import type { Context } from 'hono';
import { TeamRepository } from './team.repository';
import { TeamService } from './team.service';
import { PersonRepository } from '../person/person.repository';
import { CheckInRepository } from '../check-in/check-in.repository';
import { sendNotification, sendNotifications } from '../notification/notification.service';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { logger } from '../../config/logger';
import { logAudit } from '../../shared/audit';
import { getTeamContext } from '../../shared/team-context';
import {
  parsePagination,
} from '../../shared/utils';
import type { CreateTeamInput, UpdateTeamInput } from './team.validator';

/** Non-blocking notification when team lead is assigned to a team. */
function notifyTeamLeadAssignment(
  companyId: string,
  leaderId: string,
  teamName: string
): void {
  sendNotification(prisma, companyId, {
    personId: leaderId,
    type: 'TEAM_ALERT',
    title: 'Team Leadership Assignment',
    message: `You have been assigned as the team lead of ${teamName}.`,
  });
}

/** Non-blocking notification to workers unassigned due to team deactivation. */
function notifyOrphanedWorkers(
  companyId: string,
  workerIds: string[],
  teamName: string
): void {
  if (workerIds.length === 0) return;
  sendNotifications(
    prisma,
    companyId,
    workerIds.map((id) => ({
      personId: id,
      type: 'TEAM_ALERT' as const,
      title: 'Team Deactivated',
      message: `Your team "${teamName}" has been deactivated. You are currently unassigned. Please contact your administrator for reassignment.`,
    }))
  );
}

function getRepository(companyId: string): TeamRepository {
  return new TeamRepository(prisma, companyId);
}

export async function listTeams(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const includeInactive = c.req.query('includeInactive') === 'true';
  const search = c.req.query('search')?.trim();

  const repository = getRepository(companyId);
  const result = await repository.findAll({ page, limit, includeInactive, search });

  return c.json({ success: true, data: result });
}

export async function createTeam(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = c.req.valid('json' as never) as CreateTeamInput;

  const repository = getRepository(companyId);

  // Validate leader (required) — check before queries
  if (!data.leaderId) {
    throw new AppError('LEADER_REQUIRED', 'Team leader is required', 400);
  }

  // Run all independent validation queries in parallel (Pattern 1)
  const [existing, leader, existingLeadTeam, supervisor] = await Promise.all([
    repository.findByName(data.name),
    repository.findPersonById(data.leaderId),
    repository.findByLeaderId(data.leaderId),
    data.supervisorId ? repository.findPersonById(data.supervisorId) : null,
  ]);

  // Validate results
  if (existing) {
    throw new AppError('DUPLICATE_TEAM', 'Team with this name already exists', 409);
  }
  if (!leader) {
    throw new AppError('INVALID_LEADER', 'Leader not found or inactive', 400);
  }
  if (leader.role !== 'TEAM_LEAD') {
    throw new AppError('INVALID_LEADER_ROLE', 'Team leader must have TEAM_LEAD role', 400);
  }
  if (existingLeadTeam) {
    throw new AppError('LEADER_ALREADY_ASSIGNED', `This team lead is already assigned to team "${existingLeadTeam.name}". A team lead can only lead one team.`, 409);
  }
  if (data.supervisorId) {
    if (!supervisor) {
      throw new AppError('INVALID_SUPERVISOR', 'Supervisor not found or inactive', 400);
    }
    if (supervisor.role !== 'SUPERVISOR') {
      throw new AppError('INVALID_SUPERVISOR_ROLE', 'Assigned person must have SUPERVISOR role', 400);
    }
  }

  const result = await repository.create(data);

  // Notify the team lead about their assignment (non-blocking)
  notifyTeamLeadAssignment(companyId, data.leaderId, result.name);

  // Audit team creation (non-blocking)
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_TEAM',
    entityType: 'TEAM',
    entityId: result.id,
    details: { name: data.name, leaderId: data.leaderId },
  });

  return c.json({ success: true, data: result }, 201);
}

export async function getTeamById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const id = c.req.param('id');

  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Team ID is required', 400);
  }

  const repository = getRepository(companyId);
  const result = await repository.findById(id);

  if (!result) {
    throw new AppError('NOT_FOUND', 'Team not found', 404);
  }

  return c.json({ success: true, data: result });
}

export async function updateTeam(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const data = c.req.valid('json' as never) as UpdateTeamInput;

  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Team ID is required', 400);
  }

  const repository = getRepository(companyId);

  // Check if team exists (slim — no members needed for validation)
  const existing = await repository.findByIdSlim(id);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Team not found', 404);
  }

  // Check if leader is changing
  const leaderChanged = data.leaderId !== undefined && data.leaderId !== existing.leader_id;

  // Run independent validations in parallel after existence check (Pattern 2)
  const [leader, existingLeadTeam, supervisor, nameConflict] = await Promise.all([
    data.leaderId !== undefined ? repository.findPersonById(data.leaderId) : null,
    data.leaderId !== undefined && leaderChanged ? repository.findByLeaderId(data.leaderId, id) : null,
    data.supervisorId !== undefined && data.supervisorId !== null
      ? repository.findPersonById(data.supervisorId) : null,
    data.name !== undefined && data.name !== existing.name
      ? repository.findByName(data.name, id) : null,
  ]);

  // Validate name uniqueness
  if (nameConflict) {
    throw new AppError('DUPLICATE_TEAM', 'Team with this name already exists', 409);
  }

  // Validate leader if changing
  if (data.leaderId !== undefined) {
    if (!leader) {
      throw new AppError('INVALID_LEADER', 'Leader not found or inactive', 400);
    }
    if (leader.role !== 'TEAM_LEAD') {
      throw new AppError('INVALID_LEADER_ROLE', 'Team leader must have TEAM_LEAD role', 400);
    }
    if (leaderChanged && existingLeadTeam) {
      throw new AppError('LEADER_ALREADY_ASSIGNED', `This team lead is already assigned to team "${existingLeadTeam.name}". A team lead can only lead one team.`, 409);
    }
  }

  // Validate supervisor if changing (can be null to remove)
  if (data.supervisorId !== undefined && data.supervisorId !== null) {
    if (!supervisor) {
      throw new AppError('INVALID_SUPERVISOR', 'Supervisor not found or inactive', 400);
    }
    if (supervisor.role !== 'SUPERVISOR') {
      throw new AppError('INVALID_SUPERVISOR_ROLE', 'Assigned person must have SUPERVISOR role', 400);
    }
  }

  // Reactivation guard: re-validate the existing leader hasn't been reassigned.
  // Triggers when leader isn't changing (undefined OR same ID) — the regular
  // validation above only checks conflicts when leaderChanged is true.
  const isReactivation = data.isActive === true && !existing.is_active;
  if (isReactivation && !leaderChanged) {
    const [currentLeader, leaderConflict] = await Promise.all([
      repository.findPersonById(existing.leader_id),
      repository.findByLeaderId(existing.leader_id, id),
    ]);
    if (!currentLeader) {
      throw new AppError('INVALID_LEADER', 'The assigned team leader is no longer active. Please assign a new leader before reactivating.', 400);
    }
    if (currentLeader.role !== 'TEAM_LEAD') {
      throw new AppError('INVALID_LEADER_ROLE', 'The assigned team leader no longer has the TEAM_LEAD role. Please assign a new leader before reactivating.', 400);
    }
    if (leaderConflict) {
      throw new AppError('LEADER_ALREADY_ASSIGNED', `The assigned team lead now leads "${leaderConflict.name}". Please assign a new leader before reactivating.`, 409);
    }
  }

  // Deactivation path: unassign members + apply all updates atomically
  let unassignedCount = 0;
  const isDeactivation = data.isActive === false && existing.is_active;

  // Capture member IDs before transaction (for transfer cleanup + notifications)
  let allMemberIds: string[] = [];
  let orphanedWorkerIds: string[] = [];
  if (isDeactivation) {
    const members = await prisma.person.findMany({
      where: { company_id: companyId, team_id: id, is_active: true },
      select: { id: true, role: true },
    });
    allMemberIds = members.map((m) => m.id);
    orphanedWorkerIds = members.filter((m) => m.role === 'WORKER').map((m) => m.id);
  }

  let result: Awaited<ReturnType<typeof repository.update>>;

  if (isDeactivation) {
    result = await prisma.$transaction(async (tx) => {
      // Unassign all active members from this team
      const unassignResult = await tx.person.updateMany({
        where: { company_id: companyId, team_id: id, is_active: true },
        data: { team_id: null, team_assigned_at: null },
      });
      unassignedCount = unassignResult.count;

      // Cancel pending transfers TO this team (workers on other teams transferring here)
      await tx.person.updateMany({
        where: { company_id: companyId, effective_team_id: id },
        data: { effective_team_id: null, effective_transfer_date: null, transfer_initiated_by: null },
      });

      // Cancel pending transfers FROM this team's now-unassigned members.
      // Scoped to only the members who were just unassigned (not all teamless persons company-wide).
      if (allMemberIds.length > 0) {
        await tx.person.updateMany({
          where: {
            company_id: companyId,
            id: { in: allMemberIds },
            effective_team_id: { not: null },
          },
          data: { effective_team_id: null, effective_transfer_date: null, transfer_initiated_by: null },
        });
      }

      // Apply ALL update fields (including is_active + any other changes like name)
      return tx.team.update({
        where: { id, company_id: companyId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.leaderId !== undefined && { leader_id: data.leaderId }),
          ...(data.supervisorId !== undefined && { supervisor_id: data.supervisorId }),
          ...(data.checkInStart !== undefined && { check_in_start: data.checkInStart }),
          ...(data.checkInEnd !== undefined && { check_in_end: data.checkInEnd }),
          ...(data.workDays !== undefined && { work_days: data.workDays }),
          is_active: false,
        },
      });
    });

    if (unassignedCount > 0) {
      logger.info(
        { teamId: id, unassignedCount, companyId },
        'Auto-unassigned members on team deactivation'
      );

      // Notify orphaned workers (fire-and-forget)
      notifyOrphanedWorkers(companyId, orphanedWorkerIds, existing.name);
    }
  } else {
    result = await repository.update(id, data);
  }

  // Notify the new team lead if leader changed (non-blocking)
  if (leaderChanged && data.leaderId) {
    notifyTeamLeadAssignment(companyId, data.leaderId, result.name);
  }

  // Audit team update (non-blocking) — only log provided fields
  const auditDetails: Record<string, unknown> = {};
  if (data.name !== undefined) auditDetails.name = data.name;
  if (data.leaderId !== undefined) auditDetails.leaderId = data.leaderId;
  if (data.supervisorId !== undefined) auditDetails.supervisorId = data.supervisorId;
  if (data.isActive !== undefined) auditDetails.isActive = data.isActive;
  if (unassignedCount > 0) auditDetails.unassignedMembers = unassignedCount;
  if (data.checkInStart !== undefined) auditDetails.checkInStart = data.checkInStart;
  if (data.checkInEnd !== undefined) auditDetails.checkInEnd = data.checkInEnd;
  if (data.workDays !== undefined) auditDetails.workDays = data.workDays;

  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_TEAM',
    entityType: 'TEAM',
    entityId: id,
    details: auditDetails,
  });

  return c.json({ success: true, data: result });
}

export async function getTeamMembers(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const id = c.req.param('id');
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));

  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Team ID is required', 400);
  }

  const personRepository = new PersonRepository(prisma, companyId);
  const result = await personRepository.findByTeam(id, { page, limit });

  return c.json({ success: true, data: result });
}

/**
 * Get members of the current user's team
 * - TEAM_LEAD: Returns only their team's members
 * - SUPERVISOR: Returns members from assigned teams only
 * - ADMIN: Returns all workers
 */
export async function getMyTeamMembers(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'), 100);

  // Get team context
  const { teamIds } = await getTeamContext(companyId, userId, userRole, c.get('companyTimezone') as string);

  // No teams assigned (TEAM_LEAD with no team, or SUPERVISOR with no assignments)
  if (teamIds !== null && teamIds.length === 0) {
    return c.json({
      success: true,
      data: {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      },
    });
  }

  // Build filter
  // Get workers using PersonRepository (filtered by team for TEAM_LEAD/SUPERVISOR)
  const personRepository = new PersonRepository(prisma, companyId);
  const result = await personRepository.findWorkers({ page, limit }, teamIds);

  return c.json({
    success: true,
    data: result,
  });
}

/**
 * Get check-in history for team lead's workers
 * - TEAM_LEAD: Returns only their team's worker check-ins
 * - SUPERVISOR: Returns check-ins from assigned teams only
 * - ADMIN: Returns all worker check-ins
 * Supports pagination and optional worker filter
 */
export async function getCheckInHistory(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const workerIdParam = c.req.query('workerId');
  const search = c.req.query('search')?.trim();

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

  // Get check-ins using CheckInRepository (filtered by team for TEAM_LEAD/SUPERVISOR)
  const checkInRepository = new CheckInRepository(prisma, companyId);
  const result = await checkInRepository.findCheckInsWithPerson(
    { page, limit },
    {
      teamIds,
      personId: workerIdParam,
      search,
    }
  );

  // Transform to match frontend expected format
  const items = result.items.map((ci) => ({
    id: ci.id,
    personId: ci.person_id,
    workerName: `${ci.person.first_name} ${ci.person.last_name}`,
    workerEmail: ci.person.email,
    eventId: ci.event_id,
    checkInDate: ci.check_in_date,
    hoursSlept: ci.hours_slept,
    sleepQuality: ci.sleep_quality,
    stressLevel: ci.stress_level,
    physicalCondition: ci.physical_condition,
    painLevel: ci.pain_level,
    painLocation: ci.pain_location,
    physicalConditionNotes: ci.physical_condition_notes,
    notes: ci.notes,
    readinessScore: ci.readiness_score,
    readinessLevel: ci.readiness_level,
    sleepScore: ci.sleep_score,
    stressScore: ci.stress_score,
    physicalScore: ci.physical_score,
    painScore: ci.pain_score,
    createdAt: ci.created_at,
    eventTime: ci.event?.event_time ?? ci.created_at,
    isLate: ci.event?.is_late ?? false,
    lateByMinutes: ci.event?.late_by_minutes ?? null,
  }));

  return c.json({
    success: true,
    data: {
      items,
      pagination: result.pagination,
    },
  });
}

export async function getTeamAnalytics(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const period = c.req.query('period') || '7d';

  // Get team context (timezone from middleware + team filter)
  const { timezone, teamIds } = await getTeamContext(companyId, userId, userRole, c.get('companyTimezone') as string);

  // No teams assigned - return empty analytics
  if (teamIds !== null && teamIds.length === 0) {
    return c.json({
      success: true,
      data: {
        period,
        summary: {
          totalCheckIns: 0,
          avgReadiness: 0,
          workerCount: 0,
          avgComplianceRate: 0,
          readinessDistribution: { green: 0, yellow: 0, red: 0 },
        },
        trends: [],
        records: [],
      },
    });
  }

  // Get team analytics using TeamService
  const teamService = new TeamService(prisma, companyId);
  const analytics = await teamService.getTeamAnalytics(period, timezone, teamIds);

  return c.json({
    success: true,
    data: analytics,
  });
}
