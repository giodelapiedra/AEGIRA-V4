// Check-In Service - Business Logic
import { Prisma, type CheckIn } from '@prisma/client';
import { CheckInRepository, CreateCheckInData } from './check-in.repository';
import { AppError } from '../../shared/errors';
import type { CheckInInput, ReadinessScore, ReadinessLevel } from '../../types/domain.types';
import type { PaginationParams, PaginatedResponse } from '../../types/api.types';
import { prisma } from '../../config/database';
import {
  getTodayInTimezone,
  getCurrentTimeInTimezone,
  getDayOfWeekInTimezone,
  isTimeWithinWindow,
  parseDateInTimezone,
} from '../../shared/utils';
import { checkHolidayForDate } from '../../shared/holiday.utils';

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

    // Check if today is a company holiday
    const holidayCheck = await checkHolidayForDate(prisma, companyId, todayStr);
    if (holidayCheck.isHoliday) {
      throw new AppError(
        'HOLIDAY',
        `Today is a company holiday: ${holidayCheck.holidayName}. Check-in is not required.`,
        400
      );
    }

    // Validate against team schedule
    // If the worker is assigned today but the check-in window is still open,
    // they are allowed to submit. The time window check below handles eligibility.
    const person = await this.repository.getPersonWithTeam(personId);
    if (person?.team) {
      const team = person.team;

      // Check if today is a work day (using company timezone)
      if (team.work_days) {
        const dayOfWeek = getDayOfWeekInTimezone(this.timezone).toString();
        const workDays = team.work_days.split(',');
        if (!workDays.includes(dayOfWeek)) {
          throw new AppError(
            'NOT_WORK_DAY',
            'Today is not a scheduled work day for your team',
            400
          );
        }
      }

      // Check if within check-in window (using company timezone)
      if (team.check_in_start && team.check_in_end) {
        const currentTime = getCurrentTimeInTimezone(this.timezone);

        if (!isTimeWithinWindow(currentTime, team.check_in_start, team.check_in_end)) {
          throw new AppError(
            'OUTSIDE_CHECK_IN_WINDOW',
            `Check-in is only allowed between ${team.check_in_start} and ${team.check_in_end}`,
            400
          );
        }
      }
    }

    // Calculate readiness score
    const readiness = this.calculateReadiness(input);

    // Create event + check-in atomically in a transaction
    // Catch P2002 (unique constraint) to return friendly error on race condition
    try {
      const checkIn = await prisma.$transaction(async (tx) => {
        // Create event first (event sourcing)
        const event = await tx.event.create({
          data: {
            company_id: companyId,
            person_id: personId,
            event_type: 'CHECK_IN_SUBMITTED',
            entity_type: 'check_in',
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
          },
        });

        // Create check-in record
        return tx.checkIn.create({
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
            notes: input.notes,
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
      });

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
  ): Promise<PaginatedResponse<CheckIn>> {
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

    // Check if already checked in today
    const existingCheckIn = await this.repository.findByDate(personId, today);
    const hasCheckedInToday = !!existingCheckIn;

    // Check if today is a company holiday
    const person = await this.repository.getPersonWithTeam(personId);
    const companyId = person?.company_id;
    const holidayCheck = companyId
      ? await checkHolidayForDate(prisma, companyId, todayStr)
      : { isHoliday: false, holidayName: null };

    // No team assigned
    if (!person?.team) {
      return {
        isWorkDay: true,
        isHoliday: holidayCheck.isHoliday,
        holidayName: holidayCheck.holidayName,
        isWithinWindow: true,
        canCheckIn: !hasCheckedInToday && !holidayCheck.isHoliday,
        hasCheckedInToday,
        schedule: null,
        team: null,
        message: hasCheckedInToday
          ? 'You have already checked in today'
          : holidayCheck.isHoliday
            ? `Today is a holiday: ${holidayCheck.holidayName}`
            : 'No team assigned - you can check in anytime',
      };
    }

    const team = person.team;

    // Get current day and time in company timezone
    const dayOfWeek = getDayOfWeekInTimezone(this.timezone).toString();
    const currentTime = getCurrentTimeInTimezone(this.timezone);

    // Parse work days
    const workDays = team.work_days ? team.work_days.split(',') : ['1', '2', '3', '4', '5']; // Default Mon-Fri
    const isWorkDay = workDays.includes(dayOfWeek);

    // Check time window
    const checkInStart = team.check_in_start || '06:00';
    const checkInEnd = team.check_in_end || '10:00';
    const isWithinWindow = isTimeWithinWindow(currentTime, checkInStart, checkInEnd);

    // Workers assigned today CAN check in if the window is still open
    const canCheckIn = isWorkDay && !holidayCheck.isHoliday && isWithinWindow && !hasCheckedInToday;

    // Build message (holiday takes priority)
    let message: string;
    if (hasCheckedInToday) {
      message = 'You have already checked in today';
    } else if (holidayCheck.isHoliday) {
      message = `Today is a holiday: ${holidayCheck.holidayName}`;
    } else if (!isWorkDay) {
      message = 'Today is not a scheduled work day for your team';
    } else if (!isWithinWindow) {
      if (currentTime < checkInStart) {
        message = `Check-in window opens at ${checkInStart}`;
      } else {
        message = `Check-in window closed at ${checkInEnd}`;
      }
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
        checkInStart,
        checkInEnd,
        workDays,
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

    // Stress score (inverse - lower stress = higher score)
    const stressScore = Math.round((10 - input.stressLevel + 1) * 10);

    // Physical condition score
    const physicalScore = input.physicalCondition * 10;

    // Pain score (inverse - lower pain = higher score, null if not reported)
    const hasPain = input.painLevel !== undefined && input.painLevel !== null;
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
