// Check-In Service - Business Logic
import { Prisma, type CheckIn } from '@prisma/client';
import { CheckInRepository } from './check-in.repository';
import { AppError } from '../../shared/errors';
import type { CheckInInput, ReadinessScore, ReadinessLevel } from '../../types/domain.types';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';
import { prisma } from '../../config/database';
import {
  getTodayInTimezone,
  getCurrentTimeInTimezone,
  getDayOfWeekInTimezone,
  parseDateInTimezone,
  formatTime12h,
} from '../../shared/utils';
import { checkHolidayForDate } from '../../shared/holiday.utils';
import { getEffectiveSchedule } from '../../shared/schedule.utils';
import { buildEventData, emitEvent } from '../event/event.service';
import { logger } from '../../config/logger';

// Check-in status for worker
export interface CheckInStatus {
  isWorkDay: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isWithinWindow: boolean;
  canCheckIn: boolean;
  hasCheckedInToday: boolean;
  schedule: {
    checkInStart: string;
    checkInEnd: string;
    workDays: string[];
  } | null;
  team: {
    id: string;
    name: string;
  } | null;
  message: string;
}

export class CheckInService {
  constructor(
    private readonly repository: CheckInRepository,
    private readonly timezone: string = 'Asia/Manila'
  ) {}

  async submit(
    input: CheckInInput,
    personId: string,
    companyId: string
  ): Promise<CheckIn> {
    // Get today's date in company timezone
    const todayStr = getTodayInTimezone(this.timezone);
    const today = parseDateInTimezone(todayStr, this.timezone);

    // NOTE: No pre-check for duplicate here. The DB unique constraint
    // @@unique([person_id, check_in_date]) enforced inside the transaction
    // is the single source of truth. A pre-check would create a TOCTOU
    // race window between the SELECT and INSERT.

    // Holiday check and person+team fetch are independent — run in parallel
    const [holidayCheck, person] = await Promise.all([
      checkHolidayForDate(prisma, companyId, todayStr),
      this.repository.getPersonWithTeam(personId),
    ]);

    if (holidayCheck.isHoliday) {
      throw new AppError(
        'HOLIDAY',
        `Today is a company holiday: ${holidayCheck.holidayName}. Check-in is not required.`,
        400
      );
    }

    // Guard: worker must be active (getPersonWithTeam filters by is_active)
    if (!person) {
      throw new AppError(
        'ACCOUNT_INACTIVE',
        'Your account is inactive. Contact your administrator.',
        403
      );
    }

    // Guard: worker must be assigned to an active team
    if (!person.team) {
      throw new AppError(
        'NO_TEAM_ASSIGNED',
        'You are not assigned to a team. Contact your administrator.',
        400
      );
    }

    if (!person.team.is_active) {
      throw new AppError(
        'TEAM_INACTIVE',
        'Your team has been deactivated. Contact your administrator.',
        400
      );
    }

    // Validate against worker's CURRENT team schedule (or personal override).
    // DESIGN: If a transfer is effective today but the transfer-processor hasn't run yet,
    // the worker still validates against their current team's schedule. This is intentional —
    // the worker remains on their current team until the processor executes the transfer.
    // The transfer-processor runs every 15 minutes, so this race window is brief.
    let scheduleWindow: { start: string; end: string } | undefined;
    {
      const team = person.team;

      // Get effective schedule (worker override OR team default)
      const schedule = getEffectiveSchedule(
        {
          work_days: person.work_days,
          check_in_start: person.check_in_start,
          check_in_end: person.check_in_end,
        },
        {
          work_days: team.work_days,
          check_in_start: team.check_in_start,
          check_in_end: team.check_in_end,
        }
      );

      // Capture schedule window for late detection in EventService
      scheduleWindow = { start: schedule.checkInStart, end: schedule.checkInEnd };

      // Check if today is a work day (using company timezone)
      const dayOfWeek = getDayOfWeekInTimezone(this.timezone).toString();
      if (!schedule.workDays.includes(dayOfWeek)) {
        throw new AppError(
          'NOT_WORK_DAY',
          'Today is not a scheduled work day for you',
          400
        );
      }

      // Check if before check-in window opens (using company timezone).
      // DESIGN: Late submissions (after window closes) are intentionally allowed at any time
      // of day. They are flagged as late via EventService with late_by_minutes, and can
      // auto-resolve missed check-in records. No upper-bound cutoff is enforced — if a
      // business requirement for maximum lateness arises, add a configurable deadline here.
      const currentTime = getCurrentTimeInTimezone(this.timezone);
      if (currentTime < schedule.checkInStart) {
        throw new AppError(
          'OUTSIDE_CHECK_IN_WINDOW',
          `Check-in window opens at ${schedule.checkInStart}`,
          400
        );
      }
    }

    // Calculate readiness score
    const readiness = this.calculateReadiness(input);

    // Create event + check-in atomically in a transaction.
    // The transaction returns both the check-in and any resolved miss metadata
    // so we can emit events AFTER the transaction commits (preventing orphan events).
    // Catch P2002 (unique constraint) to return friendly error on race condition.
    try {
      const { checkIn, resolvedMiss } = await prisma.$transaction(async (tx) => {
        // Create event first (event sourcing) with time tracking
        const eventData = buildEventData({
          companyId,
          personId,
          eventType: 'CHECK_IN_SUBMITTED',
          entityType: 'check_in',
          payload: {
            hoursSlept: input.hoursSlept,
            sleepQuality: input.sleepQuality,
            stressLevel: input.stressLevel,
            physicalCondition: input.physicalCondition,
            painLevel: input.painLevel ?? null,
            painLocation: input.painLocation ?? null,
            physicalConditionNotes: input.physicalConditionNotes ?? null,
            notes: input.notes ?? null,
            readiness: {
              overall: readiness.overall,
              level: readiness.level,
              factors: readiness.factors,
            },
          },
          timezone: this.timezone,
          scheduleWindow,
        });
        const event = await tx.event.create({ data: eventData });

        // Create check-in record
        const newCheckIn = await tx.checkIn.create({
          data: {
            company_id: companyId,
            person_id: personId,
            event_id: event.id,
            check_in_date: today,
            hours_slept: input.hoursSlept,
            sleep_quality: input.sleepQuality,
            stress_level: input.stressLevel,
            physical_condition: input.physicalCondition,
            pain_level: input.painLevel ?? null,
            pain_location: input.painLocation ?? null,
            physical_condition_notes: input.physicalConditionNotes ?? null,
            notes: input.notes ?? null,
            readiness_score: readiness.overall,
            readiness_level: readiness.level,
            sleep_score: readiness.factors.sleep,
            stress_score: readiness.factors.stress,
            physical_score: readiness.factors.physical,
            pain_score: readiness.factors.pain ?? null,
          },
          include: {
            person: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
        });

        // Phase 2: If late submission, resolve existing missed check-in record
        // Resolution is part of the transaction to ensure atomicity.
        // Event emission happens AFTER commit to prevent orphan events on rollback.
        let resolvedMissData: { missedCheckInId: string; lateByMinutes: number | null } | null = null;

        if (event.is_late) {
          const existingMiss = await tx.missedCheckIn.findFirst({
            where: {
              company_id: companyId,
              person_id: personId,
              missed_date: today,
              resolved_at: null,
            },
          });

          if (existingMiss) {
            // Scenario 2: Cron already ran → resolve the existing record
            await tx.missedCheckIn.update({
              where: { id: existingMiss.id },
              data: {
                resolved_by_check_in_id: newCheckIn.id,
                resolved_at: new Date(),
              },
            });

            resolvedMissData = {
              missedCheckInId: existingMiss.id,
              lateByMinutes: event.late_by_minutes,
            };

            logger.info(
              { personId, missedCheckInId: existingMiss.id, checkInId: newCheckIn.id },
              'Resolved missed check-in via late submission'
            );
          } else {
            // Scenario 3: Late check-in submitted BEFORE cron ran.
            // Create a MissedCheckIn record already resolved so the miss is tracked
            // in stats/dashboard. Without this, the cron would later see the check-in
            // exists and skip the worker — leaving no record of the miss.
            // Uses upsert to handle the rare race where cron inserts between our
            // findFirst and this write (unique constraint: [person_id, missed_date]).
            const windowLabel = scheduleWindow
              ? `${formatTime12h(scheduleWindow.start)} - ${formatTime12h(scheduleWindow.end)}`
              : 'Unknown';

            const createdMiss = await tx.missedCheckIn.upsert({
              where: {
                person_id_missed_date: {
                  person_id: personId,
                  missed_date: today,
                },
              },
              create: {
                company_id: companyId,
                person_id: personId,
                team_id: person.team!.id,
                missed_date: today,
                schedule_window: windowLabel,
                resolved_by_check_in_id: newCheckIn.id,
                resolved_at: new Date(),
                reminder_sent: false,
                reminder_failed: false,
              },
              update: {
                // Cron raced us — resolve the record it just created
                resolved_by_check_in_id: newCheckIn.id,
                resolved_at: new Date(),
              },
            });

            resolvedMissData = {
              missedCheckInId: createdMiss.id,
              lateByMinutes: event.late_by_minutes,
            };

            logger.info(
              { personId, missedCheckInId: createdMiss.id, checkInId: newCheckIn.id },
              'Created and resolved missed check-in for late submission (pre-cron)'
            );
          }
        }

        return { checkIn: newCheckIn, resolvedMiss: resolvedMissData };
      });

      // Post-commit: emit MISSED_CHECK_IN_RESOLVED event (fire-and-forget).
      // Placed outside the transaction so orphan events are never created on rollback.
      if (resolvedMiss) {
        emitEvent(prisma, {
          companyId,
          personId,
          eventType: 'MISSED_CHECK_IN_RESOLVED',
          entityType: 'missed_check_in',
          entityId: resolvedMiss.missedCheckInId,
          payload: {
            missedCheckInId: resolvedMiss.missedCheckInId,
            checkInId: checkIn.id,
            lateByMinutes: resolvedMiss.lateByMinutes,
            missedDate: todayStr,
          },
          timezone: this.timezone,
        });
      }

      return checkIn;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError('DUPLICATE_CHECK_IN', 'Check-in already submitted for today', 409);
      }
      throw error;
    }
  }

  async getById(id: string): Promise<CheckIn> {
    const checkIn = await this.repository.findById(id);
    if (!checkIn) {
      throw new AppError('NOT_FOUND', 'Check-in not found', 404);
    }
    return checkIn;
  }

  async getHistory(
    personId: string,
    params: PaginationParams
  ): Promise<PaginatedResponse<Omit<CheckIn, 'company_id'>>> {
    return this.repository.findByPerson(personId, params);
  }

  async getToday(personId: string): Promise<CheckIn | null> {
    const todayStr = getTodayInTimezone(this.timezone);
    const today = parseDateInTimezone(todayStr, this.timezone);
    return this.repository.findByDate(personId, today);
  }

  /**
   * Get check-in status for a worker
   * Returns whether they can check in based on team schedule
   * All times are in company timezone
   */
  async getCheckInStatus(personId: string): Promise<CheckInStatus> {
    const todayStr = getTodayInTimezone(this.timezone);
    const today = parseDateInTimezone(todayStr, this.timezone);

    // All three queries are independent — run in parallel
    const [hasCheckedInToday, person, holidayCheck] = await Promise.all([
      this.repository.existsForDate(personId, today),
      this.repository.getPersonWithTeam(personId),
      checkHolidayForDate(prisma, this.repository.getCompanyId(), todayStr),
    ]);

    // Inactive account — cannot check in (getPersonWithTeam filters by is_active)
    if (!person) {
      return {
        isWorkDay: false,
        isHoliday: holidayCheck.isHoliday,
        holidayName: holidayCheck.holidayName,
        isWithinWindow: false,
        canCheckIn: false,
        hasCheckedInToday,
        schedule: null,
        team: null,
        message: 'Your account is inactive. Contact your administrator.',
      };
    }

    // No team assigned — cannot check in
    if (!person.team) {
      return {
        isWorkDay: false,
        isHoliday: holidayCheck.isHoliday,
        holidayName: holidayCheck.holidayName,
        isWithinWindow: false,
        canCheckIn: false,
        hasCheckedInToday,
        schedule: null,
        team: null,
        message: 'You are not assigned to a team. Contact your administrator.',
      };
    }

    // Inactive team — cannot check in
    if (!person.team.is_active) {
      return {
        isWorkDay: false,
        isHoliday: holidayCheck.isHoliday,
        holidayName: holidayCheck.holidayName,
        isWithinWindow: false,
        canCheckIn: false,
        hasCheckedInToday,
        schedule: null,
        team: { id: person.team.id, name: person.team.name },
        message: 'Your team has been deactivated. Contact your administrator.',
      };
    }

    const team = person.team;

    // Get effective schedule (worker override OR team default)
    const schedule = getEffectiveSchedule(
      {
        work_days: person.work_days,
        check_in_start: person.check_in_start,
        check_in_end: person.check_in_end,
      },
      {
        work_days: team.work_days,
        check_in_start: team.check_in_start,
        check_in_end: team.check_in_end,
      }
    );

    // Get current day and time in company timezone
    const dayOfWeek = getDayOfWeekInTimezone(this.timezone).toString();
    const currentTime = getCurrentTimeInTimezone(this.timezone);

    // Check if today is a work day
    const isWorkDay = schedule.workDays.includes(dayOfWeek);

    // Check time window
    const isWithinWindow = currentTime >= schedule.checkInStart && currentTime <= schedule.checkInEnd;
    const isAfterWindow = currentTime > schedule.checkInEnd;
    const isBeforeWindow = currentTime < schedule.checkInStart;

    // Workers can check in if within window OR after window (late submission allowed)
    // Only reject if before window opens
    const canCheckIn = isWorkDay && !holidayCheck.isHoliday && !isBeforeWindow && !hasCheckedInToday;

    // Build message (holiday takes priority)
    let message: string;
    if (hasCheckedInToday) {
      message = 'You have already checked in today';
    } else if (holidayCheck.isHoliday) {
      message = `Today is a holiday: ${holidayCheck.holidayName}`;
    } else if (!isWorkDay) {
      message = 'Today is not a scheduled work day for you';
    } else if (isBeforeWindow) {
      message = `Check-in window opens at ${schedule.checkInStart}`;
    } else if (isAfterWindow) {
      message = `Check-in window closed at ${schedule.checkInEnd}. You can still submit a late check-in.`;
    } else {
      message = 'You can check in now';
    }

    return {
      isWorkDay,
      isHoliday: holidayCheck.isHoliday,
      holidayName: holidayCheck.holidayName,
      isWithinWindow,
      canCheckIn,
      hasCheckedInToday,
      schedule: {
        checkInStart: schedule.checkInStart,
        checkInEnd: schedule.checkInEnd,
        workDays: schedule.workDays,
      },
      team: {
        id: team.id,
        name: team.name,
      },
      message,
    };
  }

  private calculateReadiness(input: CheckInInput): ReadinessScore {
    // Sleep score (0-100)
    const sleepScore = this.calculateSleepScore(input.hoursSlept, input.sleepQuality);

    // Stress score (inverse - lower stress = higher score, 0-100 range)
    const stressScore = (10 - input.stressLevel) * 10;

    // Physical condition score
    const physicalScore = input.physicalCondition * 10;

    // Pain score (inverse - lower pain = higher score, null if no pain)
    // painLevel=0 means "no pain" — use the no-pain weight formula
    const hasPain = input.painLevel !== undefined && input.painLevel !== null && input.painLevel > 0;
    const painScore = hasPain ? Math.round((10 - input.painLevel!) * 10) : null;

    // Overall weighted score
    // With pain: Sleep 35%, Stress 25%, Physical 20%, Pain 20%
    // Without pain: Sleep 40%, Stress 30%, Physical 30% (original weights)
    let overall: number;
    if (painScore !== null) {
      overall = Math.round(
        sleepScore * 0.35 + stressScore * 0.25 + physicalScore * 0.20 + painScore * 0.20
      );
    } else {
      overall = Math.round(
        sleepScore * 0.4 + stressScore * 0.3 + physicalScore * 0.3
      );
    }

    const level = this.getReadinessLevel(overall);

    return {
      overall,
      level,
      factors: {
        sleep: sleepScore,
        stress: stressScore,
        physical: physicalScore,
        pain: painScore,
      },
    };
  }

  private calculateSleepScore(hours: number, quality: number): number {
    // Optimal sleep: 7-9 hours
    let hoursScore: number;
    if (hours >= 7 && hours <= 9) {
      hoursScore = 100;
    } else if (hours >= 6 && hours < 7) {
      hoursScore = 80;
    } else if (hours >= 5 && hours < 6) {
      hoursScore = 60;
    } else if (hours < 5) {
      hoursScore = 40;
    } else {
      hoursScore = 90; // > 9 hours
    }

    // Combine with quality (1-10 scale)
    const qualityScore = quality * 10;
    return Math.round((hoursScore + qualityScore) / 2);
  }

  private getReadinessLevel(score: number): ReadinessLevel {
    if (score >= 70) return 'GREEN';
    if (score >= 50) return 'YELLOW';
    return 'RED';
  }
}
