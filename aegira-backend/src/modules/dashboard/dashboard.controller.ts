// Dashboard Controller - Request Handling
import type { Context } from 'hono';
import { DashboardService } from './dashboard.service';
import { AppError } from '../../shared/errors';

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

export async function getTrends(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const days = Number(c.req.query('days') ?? 7);

  const service = new DashboardService(companyId, c.get('companyTimezone') as string);
  const result = await service.getTrends(days);

  return c.json({ success: true, data: result });
}
