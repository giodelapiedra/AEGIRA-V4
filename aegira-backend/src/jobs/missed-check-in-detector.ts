// Missed Check-In Detector Job
// Runs every 15 minutes. Detects workers who missed their check-in
// after the team's check-in window has closed for the day.
import { prisma } from '../config/database';
import { MissedCheckInRepository } from '../modules/missed-check-in/missed-check-in.repository';
import { MissedCheckInSnapshotService } from '../modules/missed-check-in/missed-check-in-snapshot.service';
import { NotificationRepository } from '../modules/notification/notification.repository';
import { logger } from '../config/logger';
import {
  getTodayInTimezone,
  getCurrentTimeInTimezone,
  getDayOfWeekInTimezone,
  formatDateInTimezone,
  parseDateInTimezone,
  formatTime12h,
} from '../shared/utils';
import { isHoliday, buildHolidayDateSet } from '../shared/holiday.utils';
import { isWorkDay, getEffectiveSchedule } from '../shared/schedule.utils';

/**
 * Add minutes to a time string (HH:mm).
 * Handles hour overflow (e.g., 10:59 + 2 = 11:01).
 */
function addMinutesToTime(time: string, minutes: number): string {
  const parts = time.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const mins = parts[1] ?? 0;
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

/**
 * Buffer time (in minutes) after check-in window closes before detecting misses.
 * Prevents false positives from in-flight check-in submissions at window boundary.
 */
const WINDOW_BUFFER_MINUTES = 2;

/**
 * In-memory lock to prevent overlapping job runs.
 * For multi-instance deployments, use Redis or database-based locking.
 */
let isRunning = false;

/**
 * Core detection logic:
 *
 * For each active company:
 *   1. Get current time in company timezone
 *   2. Check if today is a company holiday → skip if yes
 *   3. Get today's day-of-week in company timezone
 *   4. Find active workers on active teams who were assigned before today
 *   5. Filter workers whose effective schedule (override → team fallback)
 *      has today as a work day AND check_in_end + buffer <= current time
 *   6. Insert MissedCheckIn records (skipDuplicates for idempotency)
 *   7. Send notifications for newly detected records
 */
export async function detectMissedCheckIns(): Promise<void> {
  // Prevent overlapping runs
  if (isRunning) {
    logger.info('Skipping missed check-in detection: previous run still in progress');
    return;
  }

  isRunning = true;
  logger.info('Running missed check-in detection');

  try {
    // Get all active companies
    const companies = await prisma.company.findMany({
      where: { is_active: true },
      select: { id: true, timezone: true },
    });

    let totalDetected = 0;

    // Process companies sequentially to control connection pool usage
    for (const company of companies) {
      try {
        const detected = await processCompany(company.id, company.timezone);
        totalDetected += detected;
      } catch (companyError) {
        // Log error but continue processing other companies
        logger.error(
          { error: companyError, companyId: company.id },
          'Failed to process company for missed check-ins'
        );
      }
    }

    logger.info({ totalDetected }, 'Missed check-in detection completed');
  } catch (error) {
    logger.error({ error }, 'Failed to run missed check-in detection');
    throw error;
  } finally {
    isRunning = false;
  }
}

async function processCompany(companyId: string, timezone: string): Promise<number> {
  const currentTime = getCurrentTimeInTimezone(timezone);
  const todayStr = getTodayInTimezone(timezone);
  const todayDow = getDayOfWeekInTimezone(timezone).toString();
  const todayDate = parseDateInTimezone(todayStr, timezone);

  // Skip holidays - no missed check-ins should be created on company holidays
  const holiday = await isHoliday(prisma, companyId, todayStr);
  if (holiday) {
    logger.info({ companyId, date: todayStr }, 'Skipping missed check-in detection: today is a holiday');
    return 0;
  }

  // Find active teams whose check-in window has already closed today
  const teams = await prisma.team.findMany({
    where: {
      company_id: companyId,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      check_in_start: true,
      check_in_end: true,
      work_days: true,
      leader: {
        select: { id: true, first_name: true, last_name: true },
      },
    },
  });

  // Pre-filter teams that have ANY chance of being past their window.
  // We still need all teams for lookup, but skip teams whose window
  // hasn't closed even without overrides (optimization: earliest possible end is team end).
  // The actual per-worker window check happens below using getEffectiveSchedule().
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const activeTeamIds = teams.map((t) => t.id);

  if (activeTeamIds.length === 0) return 0;

  // Find active workers on active teams who were assigned BEFORE today
  const workers = await prisma.person.findMany({
    where: {
      company_id: companyId,
      role: 'WORKER',
      is_active: true,
      team_id: { in: activeTeamIds },
      team_assigned_at: { not: null },
    },
    select: {
      id: true,
      team_id: true,
      team_assigned_at: true,
      role: true, // Needed for state snapshot
      // Worker schedule override fields
      work_days: true,
      check_in_start: true,
      check_in_end: true,
      // Team schedule for fallback
      team: {
        select: {
          work_days: true,
          check_in_start: true,
          check_in_end: true,
        },
      },
    },
  });

  // Filter workers by: assigned before today, today is their work day,
  // AND their effective check-in window has closed (with buffer).
  // This uses the worker's override schedule if set, otherwise team defaults.
  const eligibleWorkers = workers.filter((w) => {
    if (!w.team_assigned_at || !w.team) return false;

    // Check if assigned before today (same day = just assigned, not required)
    const assignedDateStr = formatDateInTimezone(new Date(w.team_assigned_at), timezone);
    if (assignedDateStr >= todayStr) return false;

    const personSchedule = { work_days: w.work_days, check_in_start: w.check_in_start, check_in_end: w.check_in_end };
    const teamSchedule = { work_days: w.team.work_days, check_in_start: w.team.check_in_start, check_in_end: w.team.check_in_end };

    // Check if today is a work day for this worker (uses override OR team default)
    if (!isWorkDay(todayDow, personSchedule, teamSchedule)) return false;

    // Check if the worker's effective check-in window has closed + buffer
    const effective = getEffectiveSchedule(personSchedule, teamSchedule);
    const endWithBuffer = addMinutesToTime(effective.checkInEnd, WINDOW_BUFFER_MINUTES);
    return currentTime >= endWithBuffer;
  });

  if (eligibleWorkers.length === 0) return 0;

  const workerIds = eligibleWorkers.map((w) => w.id);

  // Find workers who already checked in today
  const checkIns = await prisma.checkIn.findMany({
    where: {
      company_id: companyId,
      person_id: { in: workerIds },
      check_in_date: todayDate,
    },
    select: { person_id: true },
  });

  const checkedInSet = new Set(checkIns.map((ci) => ci.person_id));

  // Workers who missed their check-in
  const missingWorkers = eligibleWorkers.filter((w) => !checkedInSet.has(w.id));

  if (missingWorkers.length === 0) return 0;

  // Check which workers already have a MissedCheckIn record for today
  // (to know which ones are truly new for notifications)
  const missedRepo = new MissedCheckInRepository(prisma, companyId);
  const existingPersonIds = await missedRepo.findExistingForDate(
    todayDate,
    missingWorkers.map((w) => w.id)
  );

  // Only insert and notify for truly new records
  const newMissing = missingWorkers.filter((w) => !existingPersonIds.has(w.id));

  if (newMissing.length === 0) return 0;

  // Build holiday date set for snapshot calculations (last 90 days)
  const ninetyDaysAgo = new Date(todayDate.getTime() - 90 * 24 * 60 * 60 * 1000);
  const holidayDateSet = await buildHolidayDateSet(prisma, companyId, ninetyDaysAgo, todayDate, timezone);

  // Calculate state snapshots for all workers in batch
  const snapshotService = new MissedCheckInSnapshotService(prisma, companyId, timezone);

  const workerContexts = newMissing.map((w) => {
    return {
      personId: w.id,
      teamId: w.team_id!,
      role: w.role,
      teamAssignedAt: w.team_assigned_at,
      // Worker schedule override fields
      workDays: w.work_days,
      checkInStart: w.check_in_start,
      checkInEnd: w.check_in_end,
      // Team schedule for fallback
      team: {
        work_days: w.team!.work_days,
        check_in_start: w.team!.check_in_start,
        check_in_end: w.team!.check_in_end,
      },
    };
  });

  const snapshots = await snapshotService.calculateBatch(workerContexts, todayDate, holidayDateSet);

  // Build records for insertion with state snapshots
  const records = newMissing.map((w) => {
    const team = teamMap.get(w.team_id!);
    // Use worker's effective schedule (override → team fallback) for accurate window
    const effective = getEffectiveSchedule(
      { work_days: w.work_days, check_in_start: w.check_in_start, check_in_end: w.check_in_end },
      { work_days: w.team!.work_days, check_in_start: w.team!.check_in_start, check_in_end: w.team!.check_in_end }
    );
    const snapshot = snapshots.get(w.id);

    // Capture team leader snapshot at time of miss
    const teamLeaderIdAtMiss = team?.leader?.id ?? null;
    const teamLeaderNameAtMiss = team?.leader
      ? `${team.leader.first_name} ${team.leader.last_name}`
      : null;

    return {
      personId: w.id,
      teamId: w.team_id!,
      missedDate: todayDate,
      scheduleWindow: `${formatTime12h(effective.checkInStart)} - ${formatTime12h(effective.checkInEnd)}`,
      // Team leader snapshot
      teamLeaderIdAtMiss,
      teamLeaderNameAtMiss,
      // Include state snapshot
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
    };
  });

  // Insert records (skipDuplicates as safety net)
  const inserted = await missedRepo.createMany(records);

  // Send notifications for newly detected missed check-ins
  if (inserted > 0) {
    try {
      const notifRepo = new NotificationRepository(prisma, companyId);
      await notifRepo.createMany(
        newMissing.map((w) => ({
          personId: w.id,
          type: 'MISSED_CHECK_IN' as const,
          title: 'Missed Check-in',
          message: `You missed your check-in for ${todayStr}. Please contact your team lead if needed.`,
        }))
      );
    } catch (error) {
      // Notification failure shouldn't break detection
      logger.error({ error, companyId }, 'Failed to send missed check-in notifications');
    }
  }

  logger.info(
    { companyId, detected: inserted, teams: teams.length },
    'Detected missed check-ins for company'
  );

  return inserted;
}
