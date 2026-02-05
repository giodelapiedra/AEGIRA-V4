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

/**
 * Add minutes to a time string (HH:mm).
 * Handles hour overflow (e.g., 10:59 + 2 = 11:01).
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
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
 *   4. Find teams where today is a work day AND check_in_end + buffer <= current time
 *   5. Find active workers on those teams who were assigned before today
 *      and do NOT have a CheckIn record for today
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
    },
  });

  // Filter to teams where today is a work day and window has closed (with buffer)
  const eligibleTeams = teams.filter((team) => {
    const workDays = team.work_days?.split(',') || ['1', '2', '3', '4', '5'];
    if (!workDays.includes(todayDow)) return false;

    // Only process teams whose check-in window has closed + buffer time
    // Buffer prevents false positives from in-flight check-ins at window boundary
    const endTime = team.check_in_end || '10:00';
    const endWithBuffer = addMinutesToTime(endTime, WINDOW_BUFFER_MINUTES);
    return currentTime >= endWithBuffer;
  });

  if (eligibleTeams.length === 0) return 0;

  const eligibleTeamIds = eligibleTeams.map((t) => t.id);

  // Find active workers on eligible teams who were assigned BEFORE today
  const workers = await prisma.person.findMany({
    where: {
      company_id: companyId,
      role: 'WORKER',
      is_active: true,
      team_id: { in: eligibleTeamIds },
      team_assigned_at: { not: null },
    },
    select: {
      id: true,
      team_id: true,
      team_assigned_at: true,
      role: true, // Needed for state snapshot
    },
  });

  // Filter to workers assigned BEFORE today (same day = just assigned, not required)
  const eligibleWorkers = workers.filter((w) => {
    if (!w.team_assigned_at) return false;
    const assignedDateStr = formatDateInTimezone(new Date(w.team_assigned_at), timezone);
    return assignedDateStr < todayStr;
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

  // Build a map of team_id → team for schedule_window lookup
  const teamMap = new Map(eligibleTeams.map((t) => [t.id, t]));

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
    const team = teamMap.get(w.team_id!);
    return {
      personId: w.id,
      teamId: w.team_id!,
      role: w.role,
      teamAssignedAt: w.team_assigned_at,
      workDays: team?.work_days?.split(',') || ['1', '2', '3', '4', '5'],
    };
  });

  const snapshots = await snapshotService.calculateBatch(workerContexts, todayDate, holidayDateSet);

  // Build records for insertion with state snapshots
  const records = newMissing.map((w) => {
    const team = teamMap.get(w.team_id!);
    const start = team?.check_in_start || '06:00';
    const end = team?.check_in_end || '10:00';
    const snapshot = snapshots.get(w.id);

    return {
      personId: w.id,
      teamId: w.team_id!,
      missedDate: todayDate,
      scheduleWindow: `${formatTime12h(start)} - ${formatTime12h(end)}`,
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
    { companyId, detected: inserted, teams: eligibleTeams.length },
    'Detected missed check-ins for company'
  );

  return inserted;
}
