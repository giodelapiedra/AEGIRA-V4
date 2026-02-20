// Person Controller - Request Handling
import type { Context } from 'hono';
import { PersonRepository } from './person.repository';
import { TeamRepository } from '../team/team.repository';
import { sendNotification, sendNotifications, type CreateNotificationData } from '../notification/notification.service';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { hashPassword } from '../../shared/password';
import { DateTime } from 'luxon';
import { parsePagination, getTodayInTimezone, parseDateInTimezone, getCurrentTimeInTimezone, getDayOfWeekInTimezone, formatTime12h } from '../../shared/utils';
import { getEffectiveSchedule } from '../../shared/schedule.utils';
import { isHoliday, buildHolidayDateSet } from '../../shared/holiday.utils';
import { validateImageFile, uploadFile, deleteFile, buildAvatarKey, extractKeyFromUrl } from '../../shared/storage';
import { emitEvent } from '../event/event.service';
import { MissedCheckInSnapshotService } from '../missed-check-in/missed-check-in-snapshot.service';
import { MissedCheckInRepository } from '../missed-check-in/missed-check-in.repository';
import { logger } from '../../config/logger';
import { logAudit } from '../../shared/audit';
import type { AuthenticatedUser } from '../../types/api.types';
import type { SafePersonWithTeam, UpdatePersonData } from './person.repository';
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
    const personRepo = new PersonRepository(prisma, companyId);

    // Fetch team with leader included (Pattern 5 — 1 query instead of 2)
    const [team, person] = await Promise.all([
      prisma.team.findFirst({
        where: { id: teamId, company_id: companyId },
        select: {
          id: true, name: true, leader_id: true, work_days: true, check_in_start: true, check_in_end: true,
          leader: { select: { id: true, first_name: true, last_name: true } },
        },
      }),
      personRepo.findById(personId),
    ]);
    if (!team) return;

    const leaderName = team.leader
      ? `${team.leader.first_name} ${team.leader.last_name}`
      : 'your team lead';

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
    const isWindowOpen = currentTime >= checkInStart && currentTime < checkInEnd;

    let firstCheckInInfo = `Check-in window: ${checkInStart} to ${checkInEnd}.`;
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
    }

    sendNotification(prisma, companyId, {
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

  // Validate team exists and is active if teamId is provided
  if (data.teamId) {
    const teamRepository = new TeamRepository(prisma, companyId);
    const team = await teamRepository.findByIdSlim(data.teamId);
    if (!team) {
      throw new AppError('INVALID_TEAM', 'Team not found', 400);
    }
    if (!team.is_active) {
      throw new AppError('TEAM_INACTIVE_ASSIGNMENT', 'Cannot assign worker to an inactive team', 400);
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
    workDays: data.workDays,
    checkInStart: data.checkInStart,
    checkInEnd: data.checkInEnd,
    contactNumber: data.contactNumber,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    emergencyContactRelationship: data.emergencyContactRelationship,
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

/** Info collected when a pending transfer is cancelled during updatePerson. */
interface PendingTransferCancellation {
  cancelledTransferTo: string;
  cancelledBy: string;
  reason: string;
}

/**
 * Mark pending transfer fields for clearing (data-only, no side effects).
 * Side effects (event + notification) are fired AFTER repository.update() succeeds
 * to prevent orphan events if a later guard throws.
 */
function markTransferCancelled(updateData: UpdatePersonData): void {
  updateData.effectiveTeamId = null;
  updateData.effectiveTransferDate = null;
  updateData.transferInitiatedBy = null;
}

/**
 * Emit cancel event + notification AFTER DB write.
 * Called once after repository.update() when a pending transfer was cancelled.
 */
function emitTransferCancellation(
  companyId: string,
  personId: string,
  cancellation: PendingTransferCancellation,
  timezone: string
): void {
  emitEvent(prisma, {
    companyId,
    personId,
    eventType: 'TEAM_TRANSFER_CANCELLED',
    entityType: 'person',
    entityId: personId,
    payload: {
      cancelledTransferTo: cancellation.cancelledTransferTo,
      reason: cancellation.reason,
      cancelledBy: cancellation.cancelledBy,
    },
    timezone,
  });

  sendNotification(prisma, companyId, {
    personId,
    type: 'TEAM_ALERT',
    title: 'Transfer Cancelled',
    message: 'Your scheduled team transfer has been cancelled. You will stay on your current team.',
  });
}

export async function updatePerson(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const timezone = c.get('companyTimezone') as string;
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
  // Check the FINAL state: if team is being removed, the worker must still have a team
  if (effectiveRole === 'WORKER') {
    const finalTeamId = data.teamId !== undefined ? data.teamId : existing.team_id;
    if (!finalTeamId) {
      throw new AppError('TEAM_REQUIRED', 'Team is required for workers. Assign a new team instead of removing the current one.', 400);
    }
  }

  // Determine what validations are needed before running them
  const needsTeamCheck = data.teamId !== undefined && data.teamId !== null && data.teamId !== existing.team_id;
  const needsLeaderCheck = data.role !== undefined && data.role !== 'TEAM_LEAD' && existing.role === 'TEAM_LEAD';
  const needsDeactivationCheck = data.isActive === false && existing.is_active;
  const needsLedTeam = needsLeaderCheck || needsDeactivationCheck;

  // Run independent validations in parallel after existence check (Pattern 2)
  const teamRepository = new TeamRepository(prisma, companyId);
  const [team, ledTeam] = await Promise.all([
    needsTeamCheck ? teamRepository.findByIdSlim(data.teamId!) : null,
    needsLedTeam ? teamRepository.findByLeaderId(id) : null,
  ]);

  // Validate team exists and is active if teamId is being changed
  if (needsTeamCheck) {
    if (!team) {
      throw new AppError('INVALID_TEAM', 'Team not found', 400);
    }
    if (!team.is_active) {
      throw new AppError('TEAM_INACTIVE_ASSIGNMENT', 'Cannot assign worker to an inactive team', 400);
    }
  }

  // Check if team is being changed
  const teamChanged = data.teamId !== undefined && data.teamId !== existing.team_id;
  const isNewAssignment = !existing.team_id;

  // Only include teamId in update data if it actually changed
  // This prevents resetting team_assigned_at when saving with the same team
  const updateData: UpdatePersonData = { ...data };
  // Track pending transfer cancellation — side effects fired AFTER DB write
  let transferCancellation: PendingTransferCancellation | null = null;

  if (!teamChanged) {
    delete updateData.teamId;

    // Same-team save with pending transfer: auto-cancel
    // e.g. Worker on Team A → pending to Team B → admin saves with Team A again
    // Note: current frontend doesn't trigger this (buildUpdates skips unchanged teamId),
    // but the explicit cancel button (DELETE /pending-transfer) handles the UI flow.
    // This guards against direct API consumers sending teamId === current team.
    if (data.teamId !== undefined && existing.effective_team_id) {
      markTransferCancelled(updateData);
      transferCancellation = { cancelledTransferTo: existing.effective_team_id, cancelledBy: userId, reason: 'same_team_reassignment' };
    }
  }

  // Guard: cannot demote a TEAM_LEAD who currently leads a team
  if (needsLeaderCheck && ledTeam) {
    throw new AppError('LEADER_HAS_TEAM', `Cannot change role — this person leads team "${ledTeam.name}". Reassign the team leader first.`, 400);
  }

  // Guard: cannot deactivate a person who leads an active team
  // (placed before transfer logic to prevent fire-and-forget side effects on rejection)
  if (needsDeactivationCheck && ledTeam && ledTeam.is_active) {
    throw new AppError(
      'LEADER_HAS_ACTIVE_TEAM',
      `Cannot deactivate — this person leads team "${ledTeam.name}". Reassign the team leader or deactivate the team first.`,
      400
    );
  }

  // Clear schedule overrides and pending transfers when role changes away from WORKER
  if (data.role !== undefined && data.role !== 'WORKER' && existing.role === 'WORKER') {
    updateData.workDays = null;
    updateData.checkInStart = null;
    updateData.checkInEnd = null;
    // Pending transfer is worker-specific — clear it on role change
    if (existing.effective_team_id) {
      markTransferCancelled(updateData);
      transferCancellation = { cancelledTransferTo: existing.effective_team_id, cancelledBy: userId, reason: 'role_change' };
    }
  }

  // ===== EFFECTIVE NEXT-DAY TRANSFER LOGIC =====

  // Guard: block new transfer if one is already pending (admin must cancel first)
  // Skip if a prior block (role change) already cancelled the pending transfer
  if (teamChanged && data.teamId && !isNewAssignment && existing.effective_team_id && !transferCancellation) {
    const pendingTeamName = existing.effective_team?.name ?? existing.effective_team_id;
    throw new AppError(
      'PENDING_TRANSFER_EXISTS',
      `This worker already has a pending transfer to "${pendingTeamName}". Cancel it first before scheduling a new transfer.`,
      409
    );
  }

  if (teamChanged && data.teamId) {
    if (isNewAssignment) {
      // FIRST ASSIGNMENT — immediate (no old team to protect)
      // updateData.teamId stays in payload → repository sets team_id + team_assigned_at
    } else {
      // TRANSFER — effective next day
      // Do NOT change team_id now — set effective fields instead
      delete updateData.teamId;

      // Calculate tomorrow's date using timezone-aware Luxon math.
      // Avoids unsafe .setUTCDate() mutation which can drift near midnight boundaries.
      const todayStr = getTodayInTimezone(timezone);
      const tomorrowDt = DateTime.fromISO(todayStr, { zone: timezone }).plus({ days: 1 });
      const tomorrowDate = new Date(Date.UTC(tomorrowDt.year, tomorrowDt.month - 1, tomorrowDt.day));

      updateData.effectiveTeamId = data.teamId;
      updateData.effectiveTransferDate = tomorrowDate;
      updateData.transferInitiatedBy = userId;

      // Create immediate MissedCheckIn if window already closed and worker didn't check in (non-blocking)
      createImmediateMissedCheckIn(companyId, id, existing, timezone, todayStr);

      // Emit transfer initiated event (fire-and-forget)
      emitEvent(prisma, {
        companyId,
        personId: id,
        eventType: 'TEAM_TRANSFER_INITIATED',
        entityType: 'person',
        entityId: id,
        payload: {
          fromTeamId: existing.team_id,
          toTeamId: data.teamId,
          effectiveDate: tomorrowDate.toISOString(),
          initiatedBy: userId,
        },
        timezone,
      });
    }
  } else if (teamChanged && !data.teamId) {
    // REMOVING from team — clear any pending transfer too
    updateData.effectiveTeamId = null;
    updateData.effectiveTransferDate = null;
    updateData.transferInitiatedBy = null;
  }

  // If worker is deactivated, clear pending transfer (skip if a prior block already handled it)
  if (data.isActive === false && existing.is_active && existing.effective_team_id && !transferCancellation) {
    markTransferCancelled(updateData);
    transferCancellation = { cancelledTransferTo: existing.effective_team_id, cancelledBy: userId, reason: 'deactivation' };
  }

  const result = await repository.update(id, updateData);

  // Fire transfer cancellation side effects AFTER DB write succeeded
  if (transferCancellation) {
    emitTransferCancellation(companyId, id, transferCancellation, timezone);
  }

  // Send notification if worker was assigned to a new team (non-blocking)
  if (teamChanged && data.teamId) {
    if (isNewAssignment) {
      notifyWorkerTeamAssignment(companyId, id, data.teamId, true, timezone);
    } else {
      // Transfer notification — tell worker about scheduled transfer
      notifyWorkerTransferScheduled(companyId, id, existing.team?.name ?? 'current team', data.teamId, timezone);
    }
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

/**
 * Cancel a pending team transfer.
 * DELETE /persons/:id/pending-transfer
 */
export async function cancelPendingTransfer(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Person ID is required', 400);
  }

  const repository = getRepository(companyId);
  const existing = await repository.findById(id);

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Person not found', 404);
  }

  if (!existing.effective_team_id) {
    throw new AppError('NO_PENDING_TRANSFER', 'No pending transfer to cancel', 400);
  }

  const timezone = c.get('companyTimezone') as string;

  await repository.cancelTransfer(id);

  // Emit cancel event (fire-and-forget)
  emitEvent(prisma, {
    companyId,
    personId: id,
    eventType: 'TEAM_TRANSFER_CANCELLED',
    entityType: 'person',
    entityId: id,
    payload: {
      cancelledTransferTo: existing.effective_team_id,
      cancelledBy: userId,
    },
    timezone,
  });

  // Notify worker (fire-and-forget)
  sendNotification(prisma, companyId, {
    personId: id,
    type: 'TEAM_ALERT',
    title: 'Transfer Cancelled',
    message: 'Your scheduled team transfer has been cancelled. You will stay on your current team.',
  });

  // Audit (non-blocking)
  logAudit({
    companyId,
    personId: userId,
    action: 'CANCEL_TRANSFER',
    entityType: 'PERSON',
    entityId: id,
    details: { cancelledTransferTo: existing.effective_team_id },
  });

  return c.json({ success: true, data: { message: 'Transfer cancelled' } });
}

/**
 * Send notification when a team transfer is scheduled (not immediate).
 * Non-blocking - errors are logged but don't break the main operation.
 */
async function notifyWorkerTransferScheduled(
  companyId: string,
  personId: string,
  currentTeamName: string,
  newTeamId: string,
  timezone: string
): Promise<void> {
  try {
    const teamRepo = new TeamRepository(prisma, companyId);
    const newTeam = await teamRepo.findByIdSlim(newTeamId);
    const newTeamName = newTeam?.name ?? 'your new team';

    const todayStr = getTodayInTimezone(timezone);
    const tomorrowDt = DateTime.fromISO(todayStr, { zone: timezone }).plus({ days: 1 });
    const effectiveDateStr = tomorrowDt.toFormat('yyyy-MM-dd');

    sendNotification(prisma, companyId, {
      personId,
      type: 'TEAM_ALERT',
      title: 'Team Transfer Scheduled',
      message: `You will be transferred to ${newTeamName} starting ${effectiveDateStr}. Please complete your check-in for ${currentTeamName} as usual today.`,
    });
  } catch (error) {
    logger.error({ error, personId, newTeamId }, 'Failed to send transfer scheduled notification');
  }
}

/**
 * Create an immediate MissedCheckIn record when a transfer is initiated
 * and the check-in window has already closed without a check-in.
 * Non-blocking - errors are logged but don't fail the transfer.
 *
 * Uses the same MissedCheckInSnapshotService as the cron detector for
 * consistent snapshot data, and sends notifications + emits events
 * matching the cron detector pattern.
 */
async function createImmediateMissedCheckIn(
  companyId: string,
  personId: string,
  person: SafePersonWithTeam,
  timezone: string,
  todayStr: string
): Promise<void> {
  try {
    if (!person.team_id || !person.team) return;

    const currentTime = getCurrentTimeInTimezone(timezone);
    const todayDow = getDayOfWeekInTimezone(timezone).toString();
    const todayDate = parseDateInTimezone(todayStr, timezone);

    // Get effective schedule
    const personSchedule = { work_days: person.work_days, check_in_start: person.check_in_start, check_in_end: person.check_in_end };
    const teamSchedule = { work_days: person.team.work_days, check_in_start: person.team.check_in_start, check_in_end: person.team.check_in_end };
    const schedule = getEffectiveSchedule(personSchedule, teamSchedule);

    // Only create if: today is work day AND window already closed AND no check-in today
    if (!schedule.workDays.includes(todayDow)) return;
    if (currentTime <= schedule.checkInEnd) return;

    // Run independent checks in parallel
    const missedRepo = new MissedCheckInRepository(prisma, companyId);
    const ninetyDaysAgo = new Date(todayDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [holidayToday, existingCheckIn, existingMissed, holidayDateSet, teamLeader] = await Promise.all([
      isHoliday(prisma, companyId, todayStr),
      prisma.checkIn.findFirst({
        where: { company_id: companyId, person_id: personId, check_in_date: todayDate },
        select: { id: true },
      }),
      missedRepo.findExistingForDate(todayDate, [personId]),
      buildHolidayDateSet(prisma, companyId, ninetyDaysAgo, todayDate, timezone),
      person.team_id
        ? prisma.person.findFirst({
            where: { company_id: companyId, led_teams: { some: { id: person.team_id } } },
            select: { id: true, first_name: true, last_name: true },
          })
        : null,
    ]);
    if (holidayToday || existingCheckIn || existingMissed.has(personId)) return;

    // Use MissedCheckInSnapshotService for consistent snapshots (matches cron detector)
    const snapshotService = new MissedCheckInSnapshotService(prisma, companyId, timezone);
    const snapshots = await snapshotService.calculateBatch(
      [{
        personId,
        teamId: person.team_id,
        role: person.role,
        teamAssignedAt: person.team_assigned_at,
        workDays: person.work_days,
        checkInStart: person.check_in_start,
        checkInEnd: person.check_in_end,
        team: teamSchedule,
      }],
      todayDate,
      holidayDateSet
    );
    const snapshot = snapshots.get(personId);

    // Team leader snapshot
    const teamLeaderIdAtMiss = teamLeader?.id ?? null;
    const teamLeaderNameAtMiss = teamLeader
      ? `${teamLeader.first_name} ${teamLeader.last_name}`
      : null;

    const inserted = await missedRepo.createMany([{
      personId,
      teamId: person.team_id,
      missedDate: todayDate,
      scheduleWindow: `${formatTime12h(schedule.checkInStart)} - ${formatTime12h(schedule.checkInEnd)}`,
      teamLeaderIdAtMiss,
      teamLeaderNameAtMiss,
      ...(snapshot && {
        workerRoleAtMiss: snapshot.workerRoleAtMiss,
        dayOfWeek: snapshot.dayOfWeek,
        weekOfMonth: snapshot.weekOfMonth,
        daysSinceLastCheckIn: snapshot.daysSinceLastCheckIn,
        daysSinceLastMiss: snapshot.daysSinceLastMiss,
        checkInStreakBefore: snapshot.checkInStreakBefore,
        recentReadinessAvg: snapshot.recentReadinessAvg,
        missesInLast30d: snapshot.missesInLast30d,
        missesInLast60d: snapshot.missesInLast60d,
        missesInLast90d: snapshot.missesInLast90d,
        baselineCompletionRate: snapshot.baselineCompletionRate,
        isFirstMissIn30d: snapshot.isFirstMissIn30d,
        isIncreasingFrequency: snapshot.isIncreasingFrequency,
      }),
      reminderSent: true,
      reminderFailed: false,
    }]);

    // Send notifications (matches cron detector pattern)
    if (inserted > 0) {
      const notifications: CreateNotificationData[] = [
        {
          personId,
          type: 'MISSED_CHECK_IN',
          title: 'Missed Check-in',
          message: `You missed your check-in for ${todayStr}. Please contact your team lead if needed.`,
        },
      ];

      if (teamLeaderIdAtMiss) {
        notifications.push({
          personId: teamLeaderIdAtMiss,
          type: 'MISSED_CHECK_IN',
          title: 'Team Missed Check-in',
          message: `1 worker missed their check-in for ${todayStr}.`,
        });
      }

      sendNotifications(prisma, companyId, notifications);
    }

    // Emit MISSED_CHECK_IN_DETECTED event (fire-and-forget, matches cron detector)
    emitEvent(prisma, {
      companyId,
      personId,
      eventType: 'MISSED_CHECK_IN_DETECTED',
      entityType: 'missed_check_in',
      payload: {
        missedDate: todayStr,
        scheduleWindow: `${schedule.checkInStart} - ${schedule.checkInEnd}`,
        teamId: person.team_id,
        source: 'transfer',
      },
      timezone,
    });

    logger.info({ personId, companyId, date: todayStr }, 'Created immediate missed check-in on transfer');
  } catch (error) {
    logger.error({ error, personId }, 'Failed to create immediate missed check-in on transfer');
  }
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
    contactNumber: data.contactNumber,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    emergencyContactRelationship: data.emergencyContactRelationship,
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
