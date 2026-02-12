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
import { getEffectiveSchedule } from '../../shared/schedule.utils';

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

    // Get worker's assignment date, personal overrides, and team schedule
    const person = await prisma.person.findFirst({
      where: { id: personId, company_id: this.companyId },
      select: {
        team_assigned_at: true,
        work_days: true,
        check_in_start: true,
        check_in_end: true,
        team: { select: { work_days: true, check_in_start: true, check_in_end: true } },
      },
    });

    const teamAssignedAt = person?.team_assigned_at
      ? parseDateInTimezone(formatDateInTimezone(new Date(person.team_assigned_at), timezone), timezone)
      : null;
    // Resolve effective schedule: person override → team default → hardcoded fallback
    const effectiveSchedule = getEffectiveSchedule(
      { work_days: person?.work_days, check_in_start: person?.check_in_start, check_in_end: person?.check_in_end },
      { work_days: person?.team?.work_days ?? '1,2,3,4,5', check_in_start: person?.team?.check_in_start ?? '06:00', check_in_end: person?.team?.check_in_end ?? '10:00' }
    );
    const workDays = effectiveSchedule.workDays.map(Number);
    const checkInStart = effectiveSchedule.checkInStart;
    const checkInEnd = effectiveSchedule.checkInEnd;

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
    // Select only fields used downstream — skips 10 unused columns per row
    const recentCheckIns = await prisma.checkIn.findMany({
      where: {
        company_id: this.companyId,
        person_id: personId,
        check_in_date: {
          gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        check_in_date: true,
        readiness_score: true,
        readiness_level: true,
        hours_slept: true,
        sleep_quality: true,
        physical_condition: true,
        stress_level: true,
        created_at: true,
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

    // Calculate streak - count consecutive work days with check-ins backwards
    // Start from yesterday (i=1), then optionally add today if checked in.
    // This avoids the inconsistency where today counts only if already checked in.
    // Holidays and non-work days don't break the streak (they are skipped).
    let streak = 0;
    for (let i = 1; i <= 30; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = formatDateInTimezone(checkDate, timezone);
      const dow = getDayOfWeekInTimezone(timezone, dateStr);
      const isHolidayDay = holidayDateSet.has(dateStr);
      const isScheduledWorkDay = workDays.includes(dow);

      // Skip holidays and non-work days (they don't break or contribute to streak)
      if (isHolidayDay || !isScheduledWorkDay) continue;

      if (checkInDates.has(dateStr)) {
        streak++;
      } else {
        break; // Streak broken on a required day with no check-in
      }
    }

    // Add today to streak if worker already checked in today
    if (checkInDates.has(todayStr)) {
      streak++;
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
      select: { id: true, name: true, check_in_start: true, check_in_end: true, work_days: true },
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

    // Run independent queries in parallel for better performance
    const [teamMembers, teamCheckIns, holidayCheck] = await Promise.all([
      // Get WORKER members of the team (supervisors don't check-in)
      // Include schedule override fields to determine per-worker effective schedule
      prisma.person.findMany({
        where: {
          company_id: this.companyId,
          team_id: ledTeam.id,
          role: 'WORKER',
          is_active: true,
        },
        select: {
          id: true, first_name: true, last_name: true, email: true, team_assigned_at: true,
          work_days: true, check_in_start: true, check_in_end: true,
        },
      }),
      // Get today's check-ins for team workers
      // Member info comes from teamMembers query — no person include needed
      prisma.checkIn.findMany({
        where: {
          company_id: this.companyId,
          check_in_date: today,
          person: { team_id: ledTeam.id, role: 'WORKER' },
        },
        select: {
          person_id: true,
          readiness_score: true,
          readiness_level: true,
          created_at: true,
        },
      }),
      // Check if today is a company holiday
      checkHolidayForDate(prisma, this.companyId, todayStr),
    ]);

    const checkInMap = new Map(teamCheckIns.map(c => [c.person_id, c]));

    // Helper to check if worker was assigned today
    // Uses company timezone for proper date comparison
    const isAssignedToday = (assignedAt: Date | null): boolean => {
      if (!assignedAt) return false;
      const assignedStr = formatDateInTimezone(new Date(assignedAt), timezone);
      return assignedStr === todayStr;
    };

    // Current time context (shared across all workers)
    const currentTime = getCurrentTimeInTimezone(timezone);
    const dayOfWeek = getDayOfWeekInTimezone(timezone).toString();

    // Build member statuses with per-worker schedule overrides
    let newlyAssignedCount = 0;
    let notRequiredCount = 0;
    let actualPending = 0;
    let missedCount = 0;

    const memberStatuses = teamMembers.map(member => {
      const checkIn = checkInMap.get(member.id);
      const assignedToday = isAssignedToday(member.team_assigned_at);

      // Per-worker effective schedule (person override → team default)
      const memberSchedule = getEffectiveSchedule(
        { work_days: member.work_days, check_in_start: member.check_in_start, check_in_end: member.check_in_end },
        { work_days: ledTeam.work_days ?? '1,2,3,4,5', check_in_start: ledTeam.check_in_start ?? '06:00', check_in_end: ledTeam.check_in_end ?? '10:00' }
      );
      const memberIsWorkDay = memberSchedule.workDays.includes(dayOfWeek) && !holidayCheck.isHoliday;
      const memberWindowClosed = currentTime > memberSchedule.checkInEnd;

      // Determine status: submitted > not_required (holiday/new/day off) > missed (window closed) > pending
      let status: 'submitted' | 'pending' | 'not_required' | 'missed';
      if (checkIn) {
        status = 'submitted';
      } else if (holidayCheck.isHoliday) {
        status = 'not_required';
        notRequiredCount++;
      } else if (assignedToday && memberWindowClosed) {
        // Assigned today but window already closed - not penalized
        status = 'not_required';
        newlyAssignedCount++;
        notRequiredCount++;
      } else if (!memberIsWorkDay) {
        status = 'not_required';
        notRequiredCount++;
      } else if (memberWindowClosed) {
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

    // Expected check-ins = team size minus workers not required today (day off, holiday, newly assigned)
    const expectedCheckIns = teamMembers.length - notRequiredCount;

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
      // Team schedule info
      checkInStart: ledTeam.check_in_start || '06:00',
      checkInEnd: ledTeam.check_in_end || '10:00',
      workDays: ledTeam.work_days || '1,2,3,4,5',
    };
  }

  /**
   * Get supervisor dashboard stats
   * SUPERVISOR role monitors all teams and team leads in the company
   * Optimized: Uses batch queries instead of N+1 pattern
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

    if (teams.length === 0) {
      return {
        totalTeams: 0,
        totalWorkers: 0,
        totalCheckIns: 0,
        totalPending: 0,
        overallAvgReadiness: 0,
        overallComplianceRate: 0,
        teams: [],
      };
    }

    const teamIds = teams.map(t => t.id);
    const leaderIds = teams.map(t => t.leader_id).filter((id): id is string => id !== null);

    // Batch queries - run all in parallel (no nested queries inside Promise.all)
    const [leaders, workerCounts, checkInsByPerson] = await Promise.all([
      // Get all leaders in one query
      prisma.person.findMany({
        where: {
          id: { in: leaderIds },
          company_id: this.companyId,
        },
        select: { id: true, first_name: true, last_name: true },
      }),
      // Get worker counts grouped by team
      prisma.person.groupBy({
        by: ['team_id'],
        where: {
          company_id: this.companyId,
          team_id: { in: teamIds },
          role: 'WORKER',
          is_active: true,
        },
        _count: { id: true },
      }),
      // Get today's check-ins with person info (includes team_id via join)
      prisma.checkIn.findMany({
        where: {
          company_id: this.companyId,
          check_in_date: today,
          person: { team_id: { in: teamIds }, role: 'WORKER' },
        },
        select: {
          person_id: true,
          readiness_score: true,
          person: { select: { team_id: true } },
        },
      }),
    ]);

    // Group check-ins by team (computed in-memory, no extra query)
    const checkInStats = new Map<string, { count: number; avgSum: number }>();
    for (const ci of checkInsByPerson) {
      const teamId = ci.person.team_id;
      if (!teamId) continue;
      const existing = checkInStats.get(teamId) || { count: 0, avgSum: 0 };
      existing.count++;
      existing.avgSum += ci.readiness_score;
      checkInStats.set(teamId, existing);
    }

    // Build lookup maps
    const leaderMap = new Map(leaders.map(l => [l.id, l]));
    const workerCountMap = new Map(workerCounts.map(wc => [wc.team_id, wc._count.id]));

    // Build team summaries
    const teamSummaries = teams.map(team => {
      const leader = team.leader_id ? leaderMap.get(team.leader_id) : null;
      const workerCount = workerCountMap.get(team.id) || 0;
      const stats = checkInStats.get(team.id) || { count: 0, avgSum: 0 };
      const checkInCount = stats.count;
      const avgReadiness = checkInCount > 0 ? Math.round(stats.avgSum / checkInCount) : 0;

      return {
        teamId: team.id,
        teamName: team.name,
        leaderId: leader?.id || null,
        leaderName: leader ? `${leader.first_name} ${leader.last_name}` : null,
        workerCount,
        todayCheckIns: checkInCount,
        pendingCheckIns: workerCount - checkInCount,
        avgReadiness,
        complianceRate: workerCount > 0 ? Math.round((checkInCount / workerCount) * 100) : 0,
      };
    });

    // Calculate totals
    const totalWorkers = teamSummaries.reduce((sum, t) => sum + t.workerCount, 0);
    const totalCheckIns = teamSummaries.reduce((sum, t) => sum + t.todayCheckIns, 0);
    const totalPending = teamSummaries.reduce((sum, t) => sum + t.pendingCheckIns, 0);
    // Weighted average: use raw check-in scores (not average-of-averages)
    const overallAvgReadiness = checkInsByPerson.length > 0
      ? Math.round(checkInsByPerson.reduce((sum, ci) => sum + ci.readiness_score, 0) / checkInsByPerson.length)
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

    // 3 queries instead of 6 — groupBy consolidates teams by is_active and persons by role
    const [teamCounts, roleCounts, unassignedWorkers] = await Promise.all([
      prisma.team.groupBy({
        by: ['is_active'],
        where: companyFilter,
        _count: { id: true },
      }),
      prisma.person.groupBy({
        by: ['role'],
        where: { ...companyFilter, is_active: true },
        _count: { id: true },
      }),
      // Kept separate — unassigned has extra team_id IS NULL condition
      prisma.person.count({
        where: { ...companyFilter, role: 'WORKER', is_active: true, team_id: null },
      }),
    ]);

    const activeTeams = teamCounts.find(t => t.is_active)?._count.id ?? 0;
    const inactiveTeams = teamCounts.find(t => !t.is_active)?._count.id ?? 0;
    const totalWorkers = roleCounts.find(r => r.role === 'WORKER')?._count.id ?? 0;
    const totalTeamLeads = roleCounts.find(r => r.role === 'TEAM_LEAD')?._count.id ?? 0;
    const totalSupervisors = roleCounts.find(r => r.role === 'SUPERVISOR')?._count.id ?? 0;

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

    // 2 queries instead of 6 — groupBy consolidates counts + avg in one scan
    const [memberCount, readinessGroups] = await Promise.all([
      prisma.person.count({
        where: { company_id: this.companyId, team_id: teamId, is_active: true },
      }),
      prisma.checkIn.groupBy({
        by: ['readiness_level'],
        where: {
          company_id: this.companyId,
          check_in_date: today,
          person: { team_id: teamId },
        },
        _count: { id: true },
        _avg: { readiness_score: true },
      }),
    ]);

    // Derive totals from the single groupBy result
    let checkedInCount = 0;
    let weightedScoreSum = 0;
    const readinessDistribution = { green: 0, yellow: 0, red: 0 };

    for (const group of readinessGroups) {
      const count = group._count.id;
      checkedInCount += count;
      weightedScoreSum += (group._avg.readiness_score ?? 0) * count;

      if (group.readiness_level === 'GREEN') readinessDistribution.green = count;
      else if (group.readiness_level === 'YELLOW') readinessDistribution.yellow = count;
      else if (group.readiness_level === 'RED') readinessDistribution.red = count;
    }

    const averageReadiness = checkedInCount > 0
      ? Math.round(weightedScoreSum / checkedInCount)
      : 0;

    return {
      teamId: team.id,
      teamName: team.name,
      memberCount,
      checkedInCount,
      averageReadiness,
      readinessDistribution,
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
