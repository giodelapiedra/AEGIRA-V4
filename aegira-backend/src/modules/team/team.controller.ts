// Team Controller - Request Handling
import type { Context } from 'hono';
import { TeamRepository } from './team.repository';
import { TeamService } from './team.service';
import { PersonRepository } from '../person/person.repository';
import { CheckInRepository } from '../check-in/check-in.repository';
import { NotificationRepository } from '../notification/notification.repository';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { logger } from '../../config/logger';
import { logAudit } from '../../shared/audit';
import { getTeamContext } from '../../shared/team-context';
import {
  getTodayInTimezone,
  getDayOfWeekInTimezone,
  parseDateInTimezone,
  formatDateInTimezone,
  parsePagination,
} from '../../shared/utils';
import type { CreateTeamInput, UpdateTeamInput } from './team.validator';

/**
 * Send notification when team lead is assigned to a team
 * Non-blocking - errors are logged but don't break the main operation
 */
async function notifyTeamLeadAssignment(
  companyId: string,
  leaderId: string,
  teamName: string
): Promise<void> {
  try {
    const notificationRepo = new NotificationRepository(prisma, companyId);
    await notificationRepo.create({
      personId: leaderId,
      type: 'TEAM_ALERT',
      title: 'Team Leadership Assignment',
      message: `You have been assigned as the team lead of ${teamName}.`,
    });
  } catch (error) {
    // Log error but don't throw - notification failure shouldn't break main operation
    logger.error({ error, leaderId, teamName }, 'Failed to send team lead assignment notification');
  }
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

  // Check if team name already exists
  const existing = await repository.findByName(data.name);
  if (existing) {
    throw new AppError('DUPLICATE_TEAM', 'Team with this name already exists', 409);
  }

  // Validate leader (required)
  if (!data.leaderId) {
    throw new AppError('LEADER_REQUIRED', 'Team leader is required', 400);
  }

  const leader = await repository.findPersonById(data.leaderId);
  if (!leader) {
    throw new AppError('INVALID_LEADER', 'Leader not found or inactive', 400);
  }
  if (leader.role !== 'TEAM_LEAD') {
    throw new AppError('INVALID_LEADER_ROLE', 'Team leader must have TEAM_LEAD role', 400);
  }

  // Check if leader already leads another team
  const existingLeadTeam = await repository.findByLeaderId(data.leaderId);
  if (existingLeadTeam) {
    throw new AppError('LEADER_ALREADY_ASSIGNED', `This team lead is already assigned to team "${existingLeadTeam.name}". A team lead can only lead one team.`, 409);
  }

  // Validate supervisor (optional)
  if (data.supervisorId) {
    const supervisor = await repository.findPersonById(data.supervisorId);
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

  // Check if team exists
  const existing = await repository.findById(id);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Team not found', 404);
  }

  // Check if leader is changing
  const leaderChanged = data.leaderId !== undefined && data.leaderId !== existing.leader_id;

  // Validate leader if changing (cannot remove leader, can only change)
  if (data.leaderId !== undefined) {
    const leader = await repository.findPersonById(data.leaderId);
    if (!leader) {
      throw new AppError('INVALID_LEADER', 'Leader not found or inactive', 400);
    }
    if (leader.role !== 'TEAM_LEAD') {
      throw new AppError('INVALID_LEADER_ROLE', 'Team leader must have TEAM_LEAD role', 400);
    }

    // Check if leader already leads another team (exclude current team)
    if (leaderChanged) {
      const existingLeadTeam = await repository.findByLeaderId(data.leaderId, id);
      if (existingLeadTeam) {
        throw new AppError('LEADER_ALREADY_ASSIGNED', `This team lead is already assigned to team "${existingLeadTeam.name}". A team lead can only lead one team.`, 409);
      }
    }
  }

  // Validate supervisor if changing (can be null to remove)
  if (data.supervisorId !== undefined && data.supervisorId !== null) {
    const supervisor = await repository.findPersonById(data.supervisorId);
    if (!supervisor) {
      throw new AppError('INVALID_SUPERVISOR', 'Supervisor not found or inactive', 400);
    }
    if (supervisor.role !== 'SUPERVISOR') {
      throw new AppError('INVALID_SUPERVISOR_ROLE', 'Assigned person must have SUPERVISOR role', 400);
    }
  }

  const result = await repository.update(id, data);

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
  const { items: checkIns, total, params } = await checkInRepository.findCheckInsWithPerson(
    { page, limit },
    {
      teamIds,
      personId: workerIdParam,
      search,
    }
  );

  // Transform to match frontend expected format
  const items = checkIns.map((ci) => ({
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
  }));

  return c.json({
    success: true,
    data: {
      items,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
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
