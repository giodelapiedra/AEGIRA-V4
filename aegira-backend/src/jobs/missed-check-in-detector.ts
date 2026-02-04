// Missed Check-In Detector Job
// Runs every 15 minutes. Detects workers who missed their check-in
// after the team's check-in window has closed for the day.
import { prisma } from '../config/database';
import { MissedCheckInRepository } from '../modules/missed-check-in/missed-check-in.repository';
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
import { isHoliday } from '../shared/holiday.utils';

/**
 * Core detection logic:
 *
 * For each active company:
 *   1. Get current time in company timezone
 *   2. Check if today is a company holiday → skip if yes
 *   3. Get today's day-of-week in company timezone
 *   4. Find teams where today is a work day AND check_in_end <= current time
 *   5. Find active workers on those teams who were assigned before today
 *      and do NOT have a CheckIn record for today
 *   6. Insert MissedCheckIn records (skipDuplicates for idempotency)
 *   7. Send notifications for newly detected records
 */
export async function detectMissedCheckIns(): Promise<void> {
  logger.info('Running missed check-in detection');

  try {
    // Get all active companies
    const companies = await prisma.company.findMany({
      where: { is_active: true },
      select: { id: true, timezone: true },
    });

    let totalDetected = 0;

    for (const company of companies) {
      const detected = await processCompany(company.id, company.timezone);
      totalDetected += detected;
    }

    logger.info({ totalDetected }, 'Missed check-in detection completed');
  } catch (error) {
    logger.error({ error }, 'Failed to run missed check-in detection');
    throw error;
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

  // Filter to teams where today is a work day and window has closed
  const eligibleTeams = teams.filter((team) => {
    const workDays = team.work_days?.split(',') || ['1', '2', '3', '4', '5'];
    if (!workDays.includes(todayDow)) return false;
    // Only process teams whose check-in window has already closed
    const endTime = team.check_in_end || '10:00';
    return currentTime >= endTime;
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

  // Build records for insertion
  const records = newMissing.map((w) => {
    const team = teamMap.get(w.team_id!);
    const start = team?.check_in_start || '06:00';
    const end = team?.check_in_end || '10:00';
    return {
      personId: w.id,
      teamId: w.team_id!,
      missedDate: todayDate,
      scheduleWindow: `${formatTime12h(start)} - ${formatTime12h(end)}`,
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
