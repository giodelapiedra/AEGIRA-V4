// Person Controller - Request Handling
import type { Context } from 'hono';
import { PersonRepository } from './person.repository';
import { TeamRepository } from '../team/team.repository';
import { NotificationRepository } from '../notification/notification.repository';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { hashPassword } from '../../shared/password';
import { parsePagination } from '../../shared/utils';
import { validateImageFile, uploadFile, deleteFile, buildAvatarKey, extractKeyFromUrl } from '../../shared/storage';
import { logger } from '../../config/logger';
import { logAudit } from '../../shared/audit';
import type { AuthenticatedUser } from '../../types/api.types';

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

    const team = await teamRepo.findById(teamId);
    if (!team) return;

    // Get team leader name
    let leaderName = 'your team lead';
    if (team.leader_id) {
      const leader = await personRepo.findById(team.leader_id);
      if (leader) {
        leaderName = `${leader.first_name} ${leader.last_name}`;
      }
    }

    // Determine when first check-in is required
    const checkInStart = team.check_in_start || '06:00';
    const checkInEnd = team.check_in_end || '10:00';
    const workDays = team.work_days?.split(',') || ['1', '2', '3', '4', '5'];

    // Get current time in company timezone
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit' });
    const currentDayOfWeek = now.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' });
    const dayMap: Record<string, string> = { 'Sun': '0', 'Mon': '1', 'Tue': '2', 'Wed': '3', 'Thu': '4', 'Fri': '5', 'Sat': '6' };
    const currentDayNum = dayMap[currentDayOfWeek] || '1';

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

export async function listPersons(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'));
  const includeInactive = c.req.query('includeInactive') === 'true';
  const availableOnly = c.req.query('availableOnly') === 'true';
  const excludeTeamId = c.req.query('excludeTeamId') as string | undefined;
  const role = c.req.query('role') as 'ADMIN' | 'SUPERVISOR' | 'TEAM_LEAD' | 'WORKER' | undefined;
  const search = c.req.query('search')?.trim();

  const repository = getRepository(companyId);
  const result = await repository.findAll({ page, limit, includeInactive, role, availableOnly, excludeTeamId, search });

  return c.json({ success: true, data: result });
}

export async function createPerson(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = await c.req.json();

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

  try {
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
  } catch (error) {
    // Repository now throws AppError directly for FK violations
    if (error instanceof AppError) throw error;
    throw error;
  }
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
  const data = await c.req.json();

  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Person ID is required', 400);
  }

  const repository = getRepository(companyId);

  // Check if person exists
  const existing = await repository.findById(id);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Person not found', 404);
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

  const result = await repository.update(id, updateData);

  // Send notification if worker was assigned to a new team (non-blocking)
  if (teamChanged && data.teamId) {
    notifyWorkerTeamAssignment(companyId, id, data.teamId, isNewAssignment, c.get('companyTimezone') as string);
  }

  // Audit person update (non-blocking)
  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_PERSON',
    entityType: 'PERSON',
    entityId: id,
    details: data,
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
  const data = await c.req.json();

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
