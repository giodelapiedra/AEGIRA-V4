// Team Controller - Request Handling
import type { Context } from 'hono';
import { TeamRepository } from './team.repository';
import { PersonRepository } from '../person/person.repository';
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
  const data = await c.req.json();

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
  const data = await c.req.json();

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

  // Audit team update (non-blocking)
  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_TEAM',
    entityType: 'TEAM',
    entityId: id,
    details: data,
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
  const teamFilter = teamIds ? { team_id: { in: teamIds } } : {};

  // Get workers (filtered by team for TEAM_LEAD/SUPERVISOR)
  const [members, total] = await Promise.all([
    prisma.person.findMany({
      where: {
        company_id: companyId,
        role: 'WORKER',
        is_active: true,
        ...teamFilter,
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        is_active: true,
        profile_picture_url: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { last_name: 'asc' },
    }),
    prisma.person.count({
      where: {
        company_id: companyId,
        role: 'WORKER',
        is_active: true,
        ...teamFilter,
      },
    }),
  ]);

  return c.json({
    success: true,
    data: {
      items: members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
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

  // Build person filter (team + search) - use AND to combine properly
  const personConditions: Record<string, unknown>[] = [];
  if (teamIds) personConditions.push({ team_id: { in: teamIds } });
  if (search) {
    personConditions.push({
      OR: [
        { first_name: { startsWith: search, mode: 'insensitive' } },
        { last_name: { startsWith: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const workerFilter = workerIdParam ? { person_id: workerIdParam } : {};
  const hasPersonFilter = personConditions.length > 0;

  const where = {
    company_id: companyId,
    ...(hasPersonFilter ? { person: { AND: personConditions } } : {}),
    ...workerFilter,
  };

  const [checkIns, total] = await Promise.all([
    prisma.checkIn.findMany({
      where,
      select: {
        id: true,
        person_id: true,
        event_id: true,
        check_in_date: true,
        hours_slept: true,
        sleep_quality: true,
        stress_level: true,
        physical_condition: true,
        pain_level: true,
        pain_location: true,
        physical_condition_notes: true,
        notes: true,
        readiness_score: true,
        readiness_level: true,
        sleep_score: true,
        stress_score: true,
        physical_score: true,
        pain_score: true,
        created_at: true,
        person: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
      orderBy: { check_in_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.checkIn.count({ where }),
  ]);

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
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
}

export async function getTeamAnalytics(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const period = c.req.query('period') || '7d';
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;

  // Get team context (timezone from middleware + team filter)
  const { timezone, teamIds } = await getTeamContext(companyId, userId, userRole, c.get('companyTimezone') as string);

  // No teams assigned
  if (teamIds !== null && teamIds.length === 0) {
    return c.json({
      success: true,
      data: {
        period,
        summary: {
          totalCheckIns: 0, avgReadiness: 0, workerCount: 0, avgComplianceRate: 0,
          readinessDistribution: { green: 0, yellow: 0, red: 0 },
        },
        trends: [],
      },
    });
  }

  // Get team creation date to cap the analytics range (only for single team)
  let teamCreatedAt: Date | null = null;
  if (teamIds && teamIds.length === 1) {
    const team = await prisma.team.findUnique({
      where: { id: teamIds[0] },
      select: { created_at: true },
    });
    teamCreatedAt = team?.created_at || null;
  }

  // Get date range in company timezone
  const todayStr = getTodayInTimezone(timezone);
  const endDate = parseDateInTimezone(todayStr, timezone);
  endDate.setHours(23, 59, 59, 999);
  let startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  startDate.setHours(0, 0, 0, 0);

  // Cap start date to team creation date - don't show data before team existed
  if (teamCreatedAt && teamCreatedAt > startDate) {
    startDate = new Date(teamCreatedAt);
    startDate.setHours(0, 0, 0, 0);
  }

  // Build filters based on team context
  const checkInTeamFilter = teamIds ? { person: { team_id: { in: teamIds } } } : {};
  const workerTeamFilter = teamIds ? { team_id: { in: teamIds } } : {};

  // Get workers with their assignment dates (needed for per-day compliance)
  const [checkIns, workers] = await Promise.all([
    prisma.checkIn.findMany({
      where: {
        company_id: companyId,
        check_in_date: { gte: startDate, lte: endDate },
        ...checkInTeamFilter,
      },
      select: {
        check_in_date: true,
        readiness_score: true,
        readiness_level: true,
        created_at: true,
        person: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: [{ check_in_date: 'desc' }, { created_at: 'desc' }],
    }),
    prisma.person.findMany({
      where: {
        company_id: companyId,
        role: 'WORKER',
        is_active: true,
        ...workerTeamFilter,
      },
      select: {
        team_assigned_at: true,
        team: {
          select: { work_days: true },
        },
      },
    }),
  ]);

  const workerCount = workers.length;

  // Calculate daily stats (including submit times for average)
  const dailyStats: Record<string, { count: number; totalScore: number; green: number; yellow: number; red: number; submitMinutes: number[] }> = {};

  for (const checkIn of checkIns) {
    const dateKey = formatDateInTimezone(checkIn.check_in_date, timezone);
    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = { count: 0, totalScore: 0, green: 0, yellow: 0, red: 0, submitMinutes: [] };
    }
    dailyStats[dateKey].count++;
    dailyStats[dateKey].totalScore += checkIn.readiness_score;
    if (checkIn.readiness_level === 'GREEN') dailyStats[dateKey].green++;
    else if (checkIn.readiness_level === 'YELLOW') dailyStats[dateKey].yellow++;
    else dailyStats[dateKey].red++;

    // Track submit time in minutes since midnight (in company timezone)
    const submitDate = new Date(checkIn.created_at);
    const submitTimeStr = submitDate.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit' });
    const parts = submitTimeStr.split(':').map(Number);
    dailyStats[dateKey].submitMinutes.push((parts[0] ?? 0) * 60 + (parts[1] ?? 0));
  }

  // Build trends array - iterate from startDate to endDate (capped to team creation)
  const trends = [];
  let totalExpected = 0;
  const actualDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  for (let i = 0; i < actualDays; i++) {
    const trendDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateKey = formatDateInTimezone(trendDate, timezone);
    const dayOfWeek = getDayOfWeekInTimezone(timezone, dateKey).toString();
    const stats = dailyStats[dateKey] || { count: 0, totalScore: 0, green: 0, yellow: 0, red: 0, submitMinutes: [] as number[] };

    // Count workers who were assigned BEFORE this date and it's their work day
    // (Same-day assignments are not expected to check-in)
    const expectedWorkers = workers.filter((w) => {
      if (!w.team_assigned_at) return false;
      const assignedDateStr = formatDateInTimezone(new Date(w.team_assigned_at), timezone);
      if (assignedDateStr >= dateKey) return false; // Must be assigned BEFORE (not same day)
      const workDays = w.team?.work_days?.split(',') || ['1', '2', '3', '4', '5'];
      return workDays.includes(dayOfWeek);
    }).length;

    // Skip days where no workers were expected (no work day / not yet assigned)
    if (expectedWorkers === 0 && stats.count === 0) continue;

    totalExpected += expectedWorkers;

    // Calculate average submit time (HH:MM format)
    let submitTime: string | null = null;
    if (stats.submitMinutes.length > 0) {
      const avgMinutes = Math.round(stats.submitMinutes.reduce((a: number, b: number) => a + b, 0) / stats.submitMinutes.length);
      const h = Math.floor(avgMinutes / 60).toString().padStart(2, '0');
      const m = (avgMinutes % 60).toString().padStart(2, '0');
      submitTime = `${h}:${m}`;
    }

    trends.push({
      date: dateKey,
      checkIns: stats.count,
      expectedWorkers,
      avgReadiness: stats.count > 0 ? Math.round(stats.totalScore / stats.count) : 0,
      complianceRate: expectedWorkers > 0 ? Math.round((stats.count / expectedWorkers) * 100) : 0,
      submitTime,
      green: stats.green,
      yellow: stats.yellow,
      red: stats.red,
    });
  }

  // Calculate overall stats
  const totalCheckIns = checkIns.length;
  const avgReadiness = totalCheckIns > 0
    ? Math.round(checkIns.reduce((sum, c) => sum + c.readiness_score, 0) / totalCheckIns)
    : 0;
  const greenCount = checkIns.filter(c => c.readiness_level === 'GREEN').length;
  const yellowCount = checkIns.filter(c => c.readiness_level === 'YELLOW').length;
  const redCount = checkIns.filter(c => c.readiness_level === 'RED').length;

  // Build individual check-in records with person names
  const records = checkIns.map((checkIn) => {
    const dateKey = formatDateInTimezone(checkIn.check_in_date, timezone);
    const submitDate = new Date(checkIn.created_at);
    const submitTimeStr = submitDate.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit' });

    return {
      name: `${checkIn.person.first_name} ${checkIn.person.last_name}`,
      date: dateKey,
      readinessScore: checkIn.readiness_score,
      readinessLevel: checkIn.readiness_level,
      submitTime: submitTimeStr,
    };
  });

  return c.json({
    success: true,
    data: {
      period,
      summary: {
        totalCheckIns,
        avgReadiness,
        workerCount,
        avgComplianceRate: totalExpected > 0
          ? Math.round((totalCheckIns / totalExpected) * 100)
          : 0,
        readinessDistribution: { green: greenCount, yellow: yellowCount, red: redCount },
      },
      trends,
      records,
    },
  });
}
