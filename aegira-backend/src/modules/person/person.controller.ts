// Person Controller - Request Handling
import type { Context } from 'hono';
import { PersonRepository } from './person.repository';
import { TeamRepository } from '../team/team.repository';
import { NotificationRepository } from '../notification/notification.repository';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { hashPassword } from '../../shared/password';
import { parsePagination, getCurrentTimeInTimezone, getDayOfWeekInTimezone } from '../../shared/utils';
import { getEffectiveSchedule } from '../../shared/schedule.utils';
import { validateImageFile, uploadFile, deleteFile, buildAvatarKey, extractKeyFromUrl } from '../../shared/storage';
import { logger } from '../../config/logger';
import { logAudit } from '../../shared/audit';
import type { AuthenticatedUser } from '../../types/api.types';
import type { CreatePersonInput, UpdatePersonInput, UpdateProfileInput } from './person.validator';

function getRepository(companyId: string): PersonRepository {
  return new PersonRepository(prisma, companyId);
}

/**
 * Send notification when worker is assigned to a team
 * Includes info about when their first check-in is required
 * Non-blocking - errors are logged but don't break the main operation
 */
async function notifyWorkerTeamAssignment(
  companyId: string,
  personId: string,
  teamId: string,
  isNewAssignment: boolean,
  timezone: string
): Promise<void> {
  try {
    const teamRepo = new TeamRepository(prisma, companyId);
    const personRepo = new PersonRepository(prisma, companyId);
    const notificationRepo = new NotificationRepository(prisma, companyId);

    const [team, person] = await Promise.all([
      teamRepo.findById(teamId),
      personRepo.findById(personId),
    ]);
    if (!team) return;

    // Get team leader name
    let leaderName = 'your team lead';
    if (team.leader_id) {
      const leader = await personRepo.findById(team.leader_id);
      if (leader) {
        leaderName = `${leader.first_name} ${leader.last_name}`;
      }
    }

    // Resolve effective schedule (person override → team default)
    const schedule = getEffectiveSchedule(
      { work_days: person?.work_days, check_in_start: person?.check_in_start, check_in_end: person?.check_in_end },
      { work_days: team.work_days ?? '1,2,3,4,5', check_in_start: team.check_in_start ?? '06:00', check_in_end: team.check_in_end ?? '10:00' }
    );
    const checkInStart = schedule.checkInStart;
    const checkInEnd = schedule.checkInEnd;
    const workDays = schedule.workDays;

    // Get current time and day in company timezone (using centralized Luxon utilities)
    const currentTime = getCurrentTimeInTimezone(timezone);
    const currentDayNum = getDayOfWeekInTimezone(timezone).toString();

    // Check if today is a work day and check-in window is still open
    const isTodayWorkDay = workDays.includes(currentDayNum);
    const isWindowOpen = currentTime < checkInEnd;

    let firstCheckInInfo: string;
    if (isTodayWorkDay && isWindowOpen) {
      firstCheckInInfo = `Your check-in window is open now until ${checkInEnd}.`;
    } else {
      // Find next work day
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      let nextDayNum = parseInt(currentDayNum);
      for (let i = 1; i <= 7; i++) {
        nextDayNum = (nextDayNum + 1) % 7;
        if (workDays.includes(nextDayNum.toString())) {
          const nextDayName = dayNames[nextDayNum];
          firstCheckInInfo = `Your first check-in is on ${nextDayName} from ${checkInStart} to ${checkInEnd}.`;
          break;
        }
      }
      firstCheckInInfo = firstCheckInInfo! || `Check-in window: ${checkInStart} to ${checkInEnd}.`;
    }

    await notificationRepo.create({
      personId,
      type: 'TEAM_ALERT',
      title: isNewAssignment ? 'Welcome to Your Team!' : 'Team Assignment Changed',
      message: `You have been assigned to ${team.name}. Your team lead is ${leaderName}. ${firstCheckInInfo}`,
    });
  } catch (error) {
    // Log error but don't throw - notification failure shouldn't break main operation
    logger.error({ error, personId, teamId }, 'Failed to send team assignment notification');
  }
}

const VALID_ROLES = ['ADMIN', 'WHS', 'SUPERVISOR', 'TEAM_LEAD', 'WORKER'] as const;
type ValidRole = typeof VALID_ROLES[number];

export async function listPersons(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const includeInactive = c.req.query('includeInactive') === 'true';
  const availableOnly = c.req.query('availableOnly') === 'true';
  const excludeTeamId = c.req.query('excludeTeamId') as string | undefined;
  const roleParam = c.req.query('role');
  const search = c.req.query('search')?.trim();

  // Validate role query param at runtime
  let role: ValidRole | undefined;
  if (roleParam) {
    if (!VALID_ROLES.includes(roleParam as ValidRole)) {
      throw new AppError('VALIDATION_ERROR', `Invalid role filter: ${roleParam}`, 400);
    }
    role = roleParam as ValidRole;
  }

  const repository = getRepository(companyId);
  const result = await repository.findAll({ page, limit, includeInactive, role, availableOnly, excludeTeamId, search });

  return c.json({ success: true, data: result });
}

export async function createPerson(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = c.req.valid('json' as never) as CreatePersonInput;

  const repository = getRepository(companyId);

  // Check if email already exists
  const existing = await repository.findByEmail(data.email);
  if (existing) {
    throw new AppError('DUPLICATE_EMAIL', 'Person with this email already exists', 409);
  }

  // Workers must be assigned to a team
  if ((!data.role || data.role === 'WORKER') && !data.teamId) {
    throw new AppError('TEAM_REQUIRED', 'Team is required for workers', 400);
  }

  // Validate team exists if teamId is provided
  if (data.teamId) {
    const teamRepository = new TeamRepository(prisma, companyId);
    const team = await teamRepository.findById(data.teamId);
    if (!team) {
      throw new AppError('INVALID_TEAM', 'Team not found', 400);
    }
  }

  // Hash the password before storing
  const personData = {
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    teamId: data.teamId,
    passwordHash: await hashPassword(data.password),
    gender: data.gender,
    dateOfBirth: data.dateOfBirth,
  };

  const result = await repository.create(personData);

  // Send notification if worker was assigned to a team (non-blocking)
  if (data.teamId && result.id) {
    notifyWorkerTeamAssignment(companyId, result.id, data.teamId, true, c.get('companyTimezone') as string);
  }

  // Audit person creation (non-blocking)
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_PERSON',
    entityType: 'PERSON',
    entityId: result.id,
    details: { email: data.email, role: data.role },
  });

  return c.json({ success: true, data: result }, 201);
}

export async function getPersonById(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const id = c.req.param('id');

  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Person ID is required', 400);
  }

  const repository = getRepository(companyId);
  const result = await repository.findById(id);

  if (!result) {
    throw new AppError('NOT_FOUND', 'Person not found', 404);
  }

  return c.json({ success: true, data: result });
}

export async function updatePerson(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const data = c.req.valid('json' as never) as UpdatePersonInput;

  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Person ID is required', 400);
  }

  const repository = getRepository(companyId);

  // Check if person exists
  const existing = await repository.findById(id);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Person not found', 404);
  }

  // Prevent self-demotion or self-deactivation
  if (id === userId) {
    if (data.role !== undefined && data.role !== existing.role) {
      throw new AppError('FORBIDDEN', 'You cannot change your own role', 403);
    }
    if (data.isActive === false) {
      throw new AppError('FORBIDDEN', 'You cannot deactivate your own account', 403);
    }
  }

  // Determine the effective role after this update
  const effectiveRole = data.role ?? existing.role;

  // Workers must be assigned to a team
  if (effectiveRole === 'WORKER') {
    const effectiveTeamId = data.teamId !== undefined ? data.teamId : existing.team_id;
    if (!effectiveTeamId) {
      throw new AppError('TEAM_REQUIRED', 'Team is required for workers', 400);
    }
  }

  // Validate team exists if teamId is being changed
  if (data.teamId !== undefined && data.teamId !== null && data.teamId !== existing.team_id) {
    const teamRepository = new TeamRepository(prisma, companyId);
    const team = await teamRepository.findById(data.teamId);
    if (!team) {
      throw new AppError('INVALID_TEAM', 'Team not found', 400);
    }
  }

  // Check if team is being changed
  const teamChanged = data.teamId !== undefined && data.teamId !== existing.team_id;
  const isNewAssignment = !existing.team_id;

  // Only include teamId in update data if it actually changed
  // This prevents resetting team_assigned_at when saving with the same team
  const updateData = { ...data };
  if (!teamChanged) {
    delete updateData.teamId;
  }

  // Clear schedule overrides when role changes away from WORKER
  if (data.role !== undefined && data.role !== 'WORKER' && existing.role === 'WORKER') {
    updateData.workDays = null;
    updateData.checkInStart = null;
    updateData.checkInEnd = null;
  }

  const result = await repository.update(id, updateData);

  // Send notification if worker was assigned to a new team (non-blocking)
  if (teamChanged && data.teamId) {
    notifyWorkerTeamAssignment(companyId, id, data.teamId, isNewAssignment, c.get('companyTimezone') as string);
  }

  // Audit person update (non-blocking) — only log changed fields
  const auditDetails: Record<string, unknown> = {};
  if (data.firstName !== undefined) auditDetails.firstName = data.firstName;
  if (data.lastName !== undefined) auditDetails.lastName = data.lastName;
  if (data.role !== undefined) auditDetails.role = data.role;
  if (data.teamId !== undefined) auditDetails.teamId = data.teamId;
  if (data.isActive !== undefined) auditDetails.isActive = data.isActive;

  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_PERSON',
    entityType: 'PERSON',
    entityId: id,
    details: auditDetails,
  });

  return c.json({ success: true, data: result });
}

export async function getCurrentProfile(c: Context): Promise<Response> {
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const repository = getRepository(companyId);
  const result = await repository.findById(user.id);

  if (!result) {
    throw new AppError('NOT_FOUND', 'Profile not found', 404);
  }

  return c.json({ success: true, data: result });
}

export async function updateProfile(c: Context): Promise<Response> {
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;
  const data = c.req.valid('json' as never) as UpdateProfileInput;

  const repository = getRepository(companyId);

  // Verify profile exists
  const existing = await repository.findById(user.id);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Profile not found', 404);
  }

  const result = await repository.update(user.id, {
    firstName: data.firstName,
    lastName: data.lastName,
    gender: data.gender,
    dateOfBirth: data.dateOfBirth,
  });

  return c.json({ success: true, data: result });
}

export async function uploadAvatar(c: Context): Promise<Response> {
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const body = await c.req.parseBody();
  const file = body['avatar'];

  if (!file || !(file instanceof File)) {
    throw new AppError('VALIDATION_ERROR', 'Avatar file is required', 400);
  }

  validateImageFile(file);

  const repository = getRepository(companyId);

  // Get existing profile to check for old avatar
  const existing = await repository.findById(user.id);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Profile not found', 404);
  }

  // Delete old avatar from R2 if exists
  if (existing.profile_picture_url) {
    const oldKey = extractKeyFromUrl(existing.profile_picture_url);
    if (oldKey) {
      try {
        await deleteFile(oldKey);
      } catch (error) {
        logger.error({ error, key: oldKey }, 'Failed to delete old avatar from R2');
      }
    }
  }

  // Upload new avatar
  const key = buildAvatarKey(companyId, user.id, file.type);
  const buffer = await file.arrayBuffer();
  const publicUrl = await uploadFile(key, buffer, file.type);

  // Update DB
  await repository.update(user.id, { profilePictureUrl: publicUrl });

  // Audit avatar upload (non-blocking)
  logAudit({
    companyId,
    personId: user.id,
    action: 'UPLOAD_AVATAR',
    entityType: 'PERSON',
    entityId: user.id,
  });

  return c.json({
    success: true,
    data: { profilePictureUrl: publicUrl },
  });
}
