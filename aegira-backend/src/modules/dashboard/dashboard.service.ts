// Dashboard Service - Business Logic
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import type { AdminDashboardSummary, TeamSummary, ReadinessTrend } from '../../types/domain.types';
import {
  getTodayInTimezone,
  formatDateInTimezone,
  parseDateInTimezone,
  getCurrentTimeInTimezone,
  getDayOfWeekInTimezone,
} from '../../shared/utils';
import { checkHolidayForDate, buildHolidayDateSet } from '../../shared/holiday.utils';

// Helper to convert readiness level to category
function levelToCategory(level: string): 'ready' | 'modified_duty' | 'needs_attention' | 'not_ready' {
  switch (level) {
    case 'GREEN': return 'ready';
    case 'YELLOW': return 'modified_duty';
    case 'RED': return 'not_ready';
    default: return 'needs_attention';
  }
}

export class DashboardService {
  constructor(
    private readonly companyId: string,
    private readonly timezone: string = 'Asia/Manila'
  ) {}

  /**
   * Get worker-specific dashboard stats
   */
  async getWorkerDashboard(personId: string) {
    const timezone = this.timezone;

    // Get today's date in company timezone
    const todayStr = getTodayInTimezone(timezone);
    const today = parseDateInTimezone(todayStr, timezone);

    // Get worker's assignment date and team schedule
    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: {
        team_assigned_at: true,
        team: { select: { work_days: true, check_in_start: true, check_in_end: true } },
      },
    });

    const teamAssignedAt = person?.team_assigned_at
      ? parseDateInTimezone(formatDateInTimezone(new Date(person.team_assigned_at), timezone), timezone)
      : null;
    const workDays = person?.team?.work_days
      ? person.team.work_days.split(',').map(Number)
      : [1, 2, 3, 4, 5]; // Default Mon-Fri
    const checkInStart = person?.team?.check_in_start || '06:00';
    const checkInEnd = person?.team?.check_in_end || '10:00';

    // Determine today's schedule context
    const currentTime = getCurrentTimeInTimezone(timezone);
    const dayOfWeek = getDayOfWeekInTimezone(timezone);
    const isWorkDay = workDays.includes(dayOfWeek);
    const isAssignedToday = teamAssignedAt
      ? formatDateInTimezone(teamAssignedAt, timezone) === todayStr
      : false;
    // Window open/closed are independent of assignment date
    // If assigned today and window is still open, worker CAN check in
    // If assigned today and window already closed, worker is NOT penalized (not counted as missed)
    const windowOpen = isWorkDay && currentTime >= checkInStart && currentTime <= checkInEnd;
    const windowClosed = isWorkDay && currentTime > checkInEnd;

    // Get all check-ins for last 30 days in one query (for streak + weekly trend)
    const recentCheckIns = await prisma.checkIn.findMany({
      where: {
        company_id: this.companyId,
        person_id: personId,
        check_in_date: {
          gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { check_in_date: 'desc' },
    });

    // Check if today is a holiday + build holiday set for last 30 days (streak & completion rate)
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [holidayCheck, holidayDateSet] = await Promise.all([
      checkHolidayForDate(prisma, this.companyId, todayStr),
      buildHolidayDateSet(prisma, this.companyId, thirtyDaysAgo, today, timezone),
    ]);

    // Schedule context for frontend
    const schedule = {
      isWorkDay: isWorkDay && !holidayCheck.isHoliday,
      isHoliday: holidayCheck.isHoliday,
      holidayName: holidayCheck.holidayName,
      isAssignedToday,
      windowOpen: windowOpen && !holidayCheck.isHoliday,
      windowClosed: windowClosed && !holidayCheck.isHoliday,
      checkInStart,
      checkInEnd,
    };

    // No data - return empty dashboard
    if (recentCheckIns.length === 0) {
      return {
        streak: 0,
        avgReadiness: 0,
        completionRate: 0,
        completedDays: 0,
        requiredDays: 0,
        todayCheckIn: null,
        weeklyTrend: [],
        memberSince: teamAssignedAt?.toISOString() || null,
        schedule,
      };
    }

    // Build a set of dates with check-ins for quick lookup
    const checkInDates = new Set(
      recentCheckIns.map(c => formatDateInTimezone(c.check_in_date, timezone))
    );

    // Get today's check-in
    const todayCheckIn = recentCheckIns.find(
      c => formatDateInTimezone(c.check_in_date, timezone) === todayStr
    );

    // Calculate streak - count consecutive days backwards from today
    // Holidays and non-work days don't break the streak (they are skipped)
    let streak = 0;
    let streakStarted = false;
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = formatDateInTimezone(checkDate, timezone);
      const dow = getDayOfWeekInTimezone(timezone, dateStr);
      const isHolidayDay = holidayDateSet.has(dateStr);
      const isScheduledWorkDay = workDays.includes(dow);

      // Skip holidays and non-work days (they don't break or contribute to streak)
      if (isHolidayDay || !isScheduledWorkDay) continue;

      if (checkInDates.has(dateStr)) {
        streak++;
        streakStarted = true;
      } else if (streakStarted) {
        break; // Streak broken on a required day with no check-in
      }
    }

    // Weekly trend - only show days from assignment date onwards
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      // Skip days before team assignment
      if (teamAssignedAt && date < teamAssignedAt) continue;

      const dateStr = formatDateInTimezone(date, timezone);
      const checkIn = recentCheckIns.find(
        c => formatDateInTimezone(c.check_in_date, timezone) === dateStr
      );

      if (checkIn) {
        weeklyTrend.push({
          date: dateStr,
          score: checkIn.readiness_score,
          category: levelToCategory(checkIn.readiness_level),
        });
      }
    }

    // Average readiness - based on all check-ins since assignment (up to 30 days)
    const avgReadiness = recentCheckIns.length > 0
      ? Math.round(recentCheckIns.reduce((sum, c) => sum + c.readiness_score, 0) / recentCheckIns.length)
      : 0;

    // Calculate completion rate accounting for team assignment date
    // Only count work days from max(assignment date, start of week) to today
    const { DateTime } = await import('luxon');
    const nowInTz = DateTime.now().setZone(timezone);
    const startOfWeekDt = nowInTz.startOf('week'); // Monday in Luxon
    const startOfWeek = new Date(Date.UTC(startOfWeekDt.year, startOfWeekDt.month - 1, startOfWeekDt.day));

    // Effective start: the later of (start of week, assignment date)
    // Workers assigned during the check-in window are required to check in that day
    let effectiveStart = startOfWeek;
    if (teamAssignedAt && teamAssignedAt > startOfWeek) {
      effectiveStart = teamAssignedAt;
    }

    // Count required work days from effective start to today (excluding holidays)
    let requiredDays = 0;
    for (let d = new Date(effectiveStart); d <= today; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
      const dateStr = formatDateInTimezone(d, timezone);
      const dayOfWeek = getDayOfWeekInTimezone(timezone, dateStr);
      if (workDays.includes(dayOfWeek) && !holidayDateSet.has(dateStr)) {
        requiredDays++;
      }
    }

    const checkInsThisWeek = recentCheckIns.filter(
      c => c.check_in_date >= effectiveStart
    ).length;
    const completionRate = requiredDays > 0 ? Math.round((checkInsThisWeek / requiredDays) * 100) : 0;

    // Transform today's check-in to expected format
    let transformedTodayCheckIn = null;
    if (todayCheckIn) {
      transformedTodayCheckIn = {
        id: todayCheckIn.id,
        sleepHours: todayCheckIn.hours_slept,
        sleepQuality: todayCheckIn.sleep_quality,
        fatigueLevel: 10 - todayCheckIn.physical_condition, // Invert
        stressLevel: todayCheckIn.stress_level,
        readinessResult: {
          score: todayCheckIn.readiness_score,
          level: todayCheckIn.readiness_level,
          category: levelToCategory(todayCheckIn.readiness_level),
        },
      };
    }

    return {
      streak,
      avgReadiness,
      completionRate,
      completedDays: checkInsThisWeek,
      requiredDays,
      todayCheckIn: transformedTodayCheckIn,
      weeklyTrend,
      memberSince: teamAssignedAt?.toISOString() || null,
      schedule,
    };
  }

  /**
   * Get team lead dashboard stats
   * Finds the team where this person is the leader (via leader_id)
   * TEAM_LEAD role monitors workers in their assigned team
   */
  async getTeamLeadDashboard(personId: string) {
    const timezone = this.timezone;

    // Get today's date in company timezone
    const todayStr = getTodayInTimezone(timezone);
    const today = parseDateInTimezone(todayStr, timezone);

    // Find team(s) where this person is the leader
    const ledTeam = await prisma.team.findFirst({
      where: {
        company_id: this.companyId,
        leader_id: personId,
        is_active: true,
      },
      select: { id: true, name: true, check_in_end: true, work_days: true },
    });

    // Base response for leaders without teams
    if (!ledTeam) {
      return {
        teamId: null,
        teamName: null,
        teamSize: 0,
        todaySubmissions: 0,
        expectedCheckIns: 0,
        pendingCheckIns: 0,
        missedCheckIns: 0,
        complianceRate: 0,
        newlyAssigned: 0,
        teamAvgReadiness: 0,
        memberStatuses: [],
      };
    }

    // Get WORKER members of the team (supervisors don't check-in)
    // Include team_assigned_at to check if newly assigned
    const teamMembers = await prisma.person.findMany({
      where: {
        company_id: this.companyId,
        team_id: ledTeam.id,
        role: 'WORKER',
        is_active: true,
      },
      select: { id: true, first_name: true, last_name: true, email: true, team_assigned_at: true },
    });

    // Get today's check-ins for team workers
    const teamCheckIns = await prisma.checkIn.findMany({
      where: {
        company_id: this.companyId,
        check_in_date: today,
        person: { team_id: ledTeam.id, role: 'WORKER' },
      },
      include: { person: { select: { id: true, first_name: true, last_name: true } } },
    });

    const checkInMap = new Map(teamCheckIns.map(c => [c.person_id, c]));

    // Helper to check if worker was assigned today
    // Uses company timezone for proper date comparison
    const isAssignedToday = (assignedAt: Date | null): boolean => {
      if (!assignedAt) return false;
      const assignedStr = formatDateInTimezone(new Date(assignedAt), timezone);
      return assignedStr === todayStr;
    };

    // Check if today is a company holiday
    const holidayCheck = await checkHolidayForDate(prisma, this.companyId, todayStr);

    // Determine if check-in window is closed (for missed status)
    const currentTime = getCurrentTimeInTimezone(timezone);
    const checkInEnd = ledTeam.check_in_end || '10:00';
    const workDays = ledTeam.work_days ? ledTeam.work_days.split(',') : ['1', '2', '3', '4', '5'];
    const dayOfWeek = getDayOfWeekInTimezone(timezone).toString();
    const isWorkDay = workDays.includes(dayOfWeek) && !holidayCheck.isHoliday;
    const windowClosed = currentTime > checkInEnd;

    // Build member statuses with proper status handling
    let newlyAssignedCount = 0;
    let actualPending = 0;
    let missedCount = 0;

    const memberStatuses = teamMembers.map(member => {
      const checkIn = checkInMap.get(member.id);
      const assignedToday = isAssignedToday(member.team_assigned_at);

      // Determine status: submitted > not_required (holiday/new/day off) > missed (window closed) > pending
      let status: 'submitted' | 'pending' | 'not_required' | 'missed';
      if (checkIn) {
        status = 'submitted';
      } else if (holidayCheck.isHoliday) {
        status = 'not_required';
      } else if (assignedToday && windowClosed) {
        // Assigned today but window already closed - not penalized
        status = 'not_required';
        newlyAssignedCount++;
      } else if (!isWorkDay) {
        status = 'not_required';
      } else if (windowClosed) {
        status = 'missed';
        missedCount++;
      } else {
        status = 'pending';
        actualPending++;
      }

      return {
        personId: member.id,
        fullName: `${member.first_name} ${member.last_name}`,
        email: member.email,
        submitted: !!checkIn,
        status,
        assignedToday,
        checkInTime: checkIn?.created_at.toISOString(),
        readinessCategory: checkIn ? levelToCategory(checkIn.readiness_level) : undefined,
        readinessScore: checkIn?.readiness_score,
      };
    });

    const teamAvgReadiness = teamCheckIns.length > 0
      ? Math.round(teamCheckIns.reduce((sum, c) => sum + c.readiness_score, 0) / teamCheckIns.length)
      : 0;

    // Expected check-ins = team size minus newly assigned (who aren't required today)
    const expectedCheckIns = teamMembers.length - newlyAssignedCount;

    // Compliance rate: submitted / expected (avoid division by zero)
    const complianceRate = expectedCheckIns > 0
      ? Math.round((teamCheckIns.length / expectedCheckIns) * 100)
      : 0;

    return {
      teamId: ledTeam.id,
      teamName: ledTeam.name,
      teamSize: teamMembers.length,
      todaySubmissions: teamCheckIns.length,
      expectedCheckIns, // Workers who should check-in today
      pendingCheckIns: actualPending, // Only count workers who should have checked in
      missedCheckIns: missedCount, // Workers who missed (window closed, no check-in)
      complianceRate, // Percentage of expected who submitted
      newlyAssigned: newlyAssignedCount, // Workers assigned today (not required)
      teamAvgReadiness,
      memberStatuses,
    };
  }

  /**
   * Get supervisor dashboard stats
   * SUPERVISOR role monitors all teams and team leads in the company
   */
  async getSupervisorDashboard(supervisorId?: string) {
    const timezone = this.timezone;

    // Get today's date in company timezone
    const todayStr = getTodayInTimezone(timezone);
    const today = parseDateInTimezone(todayStr, timezone);

    // Get active teams (filtered by supervisor if provided)
    const supervisorFilter = supervisorId ? { supervisor_id: supervisorId } : {};
    const teams = await prisma.team.findMany({
      where: {
        company_id: this.companyId,
        is_active: true,
        ...supervisorFilter,
      },
      select: {
        id: true,
        name: true,
        leader_id: true,
      },
    });

    // Get team summaries
    const teamSummaries = await Promise.all(
      teams.map(async (team) => {
        // Get team leader info
        const leader = await prisma.person.findFirst({
          where: { id: team.leader_id, company_id: this.companyId },
          select: { id: true, first_name: true, last_name: true },
        });

        // Get worker count for this team
        const workerCount = await prisma.person.count({
          where: {
            company_id: this.companyId,
            team_id: team.id,
            role: 'WORKER',
            is_active: true,
          },
        });

        // Get today's check-ins for this team
        const checkInCount = await prisma.checkIn.count({
          where: {
            company_id: this.companyId,
            check_in_date: today,
            person: { team_id: team.id, role: 'WORKER' },
          },
        });

        // Get average readiness for this team today
        const avgResult = await prisma.checkIn.aggregate({
          where: {
            company_id: this.companyId,
            check_in_date: today,
            person: { team_id: team.id, role: 'WORKER' },
          },
          _avg: { readiness_score: true },
        });

        return {
          teamId: team.id,
          teamName: team.name,
          leaderId: leader?.id || null,
          leaderName: leader ? `${leader.first_name} ${leader.last_name}` : null,
          workerCount,
          todayCheckIns: checkInCount,
          pendingCheckIns: workerCount - checkInCount,
          avgReadiness: Math.round(avgResult._avg.readiness_score ?? 0),
          complianceRate: workerCount > 0 ? Math.round((checkInCount / workerCount) * 100) : 0,
        };
      })
    );

    // Calculate totals
    const totalWorkers = teamSummaries.reduce((sum, t) => sum + t.workerCount, 0);
    const totalCheckIns = teamSummaries.reduce((sum, t) => sum + t.todayCheckIns, 0);
    const totalPending = teamSummaries.reduce((sum, t) => sum + t.pendingCheckIns, 0);
    const overallAvgReadiness = teamSummaries.length > 0
      ? Math.round(teamSummaries.reduce((sum, t) => sum + t.avgReadiness, 0) / teamSummaries.length)
      : 0;

    return {
      totalTeams: teams.length,
      totalWorkers,
      totalCheckIns,
      totalPending,
      overallAvgReadiness,
      overallComplianceRate: totalWorkers > 0 ? Math.round((totalCheckIns / totalWorkers) * 100) : 0,
      teams: teamSummaries,
    };
  }

  async getSummary(): Promise<AdminDashboardSummary> {
    const companyFilter = { company_id: this.companyId };

    const [
      activeTeams,
      inactiveTeams,
      totalWorkers,
      totalTeamLeads,
      totalSupervisors,
      unassignedWorkers,
    ] = await Promise.all([
      prisma.team.count({
        where: { ...companyFilter, is_active: true },
      }),
      prisma.team.count({
        where: { ...companyFilter, is_active: false },
      }),
      prisma.person.count({
        where: { ...companyFilter, role: 'WORKER', is_active: true },
      }),
      prisma.person.count({
        where: { ...companyFilter, role: 'TEAM_LEAD', is_active: true },
      }),
      prisma.person.count({
        where: { ...companyFilter, role: 'SUPERVISOR', is_active: true },
      }),
      prisma.person.count({
        where: { ...companyFilter, role: 'WORKER', is_active: true, team_id: null },
      }),
    ]);

    return {
      totalTeams: activeTeams + inactiveTeams,
      activeTeams,
      inactiveTeams,
      totalWorkers,
      totalTeamLeads,
      totalSupervisors,
      unassignedWorkers,
    };
  }

  async getTeamSummary(teamId: string): Promise<TeamSummary> {
    const timezone = this.timezone;

    // Get today's date in company timezone
    const todayStr = getTodayInTimezone(timezone);
    const today = parseDateInTimezone(todayStr, timezone);

    const team = await prisma.team.findFirst({
      where: { id: teamId, company_id: this.companyId },
      select: { id: true, name: true },
    });

    if (!team) {
      throw new AppError('NOT_FOUND', 'Team not found', 404);
    }

    const [
      memberCount,
      checkedInCount,
      greenCount,
      yellowCount,
      redCount,
    ] = await Promise.all([
      prisma.person.count({
        where: { company_id: this.companyId, team_id: teamId, is_active: true },
      }),
      prisma.checkIn.count({
        where: {
          company_id: this.companyId,
          check_in_date: today,
          person: { team_id: teamId },
        },
      }),
      prisma.checkIn.count({
        where: {
          company_id: this.companyId,
          check_in_date: today,
          person: { team_id: teamId },
          readiness_level: 'GREEN',
        },
      }),
      prisma.checkIn.count({
        where: {
          company_id: this.companyId,
          check_in_date: today,
          person: { team_id: teamId },
          readiness_level: 'YELLOW',
        },
      }),
      prisma.checkIn.count({
        where: {
          company_id: this.companyId,
          check_in_date: today,
          person: { team_id: teamId },
          readiness_level: 'RED',
        },
      }),
    ]);

    const avgResult = await prisma.checkIn.aggregate({
      where: {
        company_id: this.companyId,
        check_in_date: today,
        person: { team_id: teamId },
      },
      _avg: { readiness_score: true },
    });

    return {
      teamId: team.id,
      teamName: team.name,
      memberCount,
      checkedInCount,
      averageReadiness: Math.round(avgResult._avg.readiness_score ?? 0),
      readinessDistribution: {
        green: greenCount,
        yellow: yellowCount,
        red: redCount,
      },
    };
  }

  async getTrends(days: number = 7): Promise<ReadinessTrend[]> {
    const timezone = this.timezone;

    // Get today's date in company timezone
    const todayStr = getTodayInTimezone(timezone);
    const today = parseDateInTimezone(todayStr, timezone);
    const startDate = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    // Single query: group by check_in_date for the entire range
    const grouped = await prisma.checkIn.groupBy({
      by: ['check_in_date'],
      where: {
        company_id: this.companyId,
        check_in_date: { gte: startDate, lte: today },
      },
      _count: { id: true },
      _avg: { readiness_score: true },
    });

    // Build a lookup map: dateStr → { count, avg }
    const statsMap = new Map<string, { count: number; avg: number }>();
    for (const row of grouped) {
      const dateStr = formatDateInTimezone(row.check_in_date, timezone);
      statsMap.set(dateStr, {
        count: row._count.id,
        avg: Math.round(row._avg.readiness_score ?? 0),
      });
    }

    // Build trends array for each day in the range
    const trends: ReadinessTrend[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = formatDateInTimezone(date, timezone);
      const stats = statsMap.get(dateStr);

      trends.push({
        date: dateStr,
        averageScore: stats?.avg ?? 0,
        checkInCount: stats?.count ?? 0,
      });
    }

    return trends;
  }
}
