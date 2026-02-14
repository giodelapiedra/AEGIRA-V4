// Dashboard Controller - Request Handling
import type { Context } from 'hono';
import { DashboardService } from './dashboard.service';
import { WhsDashboardService } from './whs-dashboard.service';
import { WhsAnalyticsService } from './whs-analytics.service';
import { AppError } from '../../shared/errors';
import { getTeamContext } from '../../shared/team-context';

export async function getSummary(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;

  const service = new DashboardService(companyId, c.get('companyTimezone') as string);
  const result = await service.getSummary();

  return c.json({ success: true, data: result });
}

export async function getWorkerDashboard(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const personId = c.get('userId') as string;

  const service = new DashboardService(companyId, c.get('companyTimezone') as string);
  const result = await service.getWorkerDashboard(personId);

  return c.json({ success: true, data: result });
}

export async function getTeamLeadDashboard(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const personId = c.get('userId') as string;

  const service = new DashboardService(companyId, c.get('companyTimezone') as string);
  const result = await service.getTeamLeadDashboard(personId);

  return c.json({ success: true, data: result });
}

export async function getSupervisorDashboard(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;

  const service = new DashboardService(companyId, c.get('companyTimezone') as string);
  // SUPERVISOR: filter by assigned teams; ADMIN: see all teams
  const supervisorId = userRole === 'SUPERVISOR' ? userId : undefined;
  const result = await service.getSupervisorDashboard(supervisorId);

  return c.json({ success: true, data: result });
}

export async function getTeamDashboard(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const teamId = c.req.param('id');

  if (!teamId) {
    throw new AppError('VALIDATION_ERROR', 'Team ID is required', 400);
  }

  const service = new DashboardService(companyId, c.get('companyTimezone') as string);
  const result = await service.getTeamSummary(teamId);

  return c.json({ success: true, data: result });
}

export async function getWhsDashboard(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const personId = c.get('userId') as string;

  const service = new WhsDashboardService(companyId, c.get('companyTimezone') as string);
  const result = await service.getWhsDashboard(personId);

  return c.json({ success: true, data: result });
}

export async function getWhsAnalytics(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const raw = c.req.query('period') ?? '30d';

  const validPeriods = ['7d', '30d', '90d'] as const;
  if (!validPeriods.includes(raw as (typeof validPeriods)[number])) {
    throw new AppError('VALIDATION_ERROR', 'Invalid period. Must be 7d, 30d, or 90d', 400);
  }
  const period = raw as (typeof validPeriods)[number];

  const service = new WhsAnalyticsService(companyId, c.get('companyTimezone') as string);
  const result = await service.getAnalytics(period);

  return c.json({ success: true, data: result });
}

export async function getTrends(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const userRole = c.get('userRole') as string;
  const timezone = c.get('companyTimezone') as string;
  const days = Number(c.req.query('days') ?? 7);

  // Validate days parameter to prevent DoS via huge date ranges
  if (isNaN(days) || days < 1 || days > 90) {
    throw new AppError('VALIDATION_ERROR', 'Days must be between 1 and 90', 400);
  }

  // Get team context for filtering (SUPERVISOR sees assigned teams, ADMIN sees all)
  const { teamIds } = await getTeamContext(companyId, userId, userRole, timezone);

  const service = new DashboardService(companyId, timezone);
  const result = await service.getTrends(days, teamIds);

  return c.json({ success: true, data: result });
}
