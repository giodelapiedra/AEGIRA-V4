// Check-In Controller - Request Handling
import type { Context } from 'hono';
import { CheckInService } from './check-in.service';
import { CheckInRepository } from './check-in.repository';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import type { AuthenticatedUser } from '../../types/api.types';
import type { SubmitCheckInInput } from './check-in.validator';

function getService(companyId: string, timezone: string): CheckInService {
  const repository = new CheckInRepository(prisma, companyId);
  return new CheckInService(repository, timezone);
}

export async function submitCheckIn(c: Context): Promise<Response> {
  const data = c.req.valid('json' as never) as SubmitCheckInInput;
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = getService(companyId, c.get('companyTimezone') as string);
  const result = await service.submit(data, user.id, companyId);

  return c.json({ success: true, data: result }, 201);
}

export async function getCheckInById(c: Context): Promise<Response> {
  const id = c.req.param('id');
  if (!id) {
    throw new AppError('VALIDATION_ERROR', 'Check-in ID is required', 400);
  }
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = getService(companyId, c.get('companyTimezone') as string);
  const result = await service.getById(id);

  // Validate access: owner, WHS/SUPERVISOR/ADMIN, or TEAM_LEAD of the worker's team
  let canAccess =
    result.person_id === user.id ||
    ['WHS', 'SUPERVISOR', 'ADMIN'].includes(user.role.toUpperCase());

  // TEAM_LEAD can view check-ins of workers in their team
  if (!canAccess && user.role.toUpperCase() === 'TEAM_LEAD') {
    const workerTeam = await prisma.person.findFirst({
      where: { id: result.person_id, company_id: companyId },
      select: { team: { select: { leader_id: true } } },
    });
    canAccess = workerTeam?.team?.leader_id === user.id;
  }

  if (!canAccess) {
    throw new AppError('FORBIDDEN', 'You do not have permission to view this check-in', 403);
  }

  return c.json({ success: true, data: result });
}

export async function getCheckInHistory(c: Context): Promise<Response> {
  const { page, limit } = c.req.valid('query' as never) as { page: number; limit: number };
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = getService(companyId, c.get('companyTimezone') as string);
  const result = await service.getHistory(user.id, { page, limit });

  return c.json({ success: true, data: result });
}

export async function getTodayCheckIn(c: Context): Promise<Response> {
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = getService(companyId, c.get('companyTimezone') as string);
  const result = await service.getToday(user.id);

  return c.json({ success: true, data: result });
}

export async function getCheckInStatus(c: Context): Promise<Response> {
  const user = c.get('user') as AuthenticatedUser;
  const companyId = c.get('companyId') as string;

  const service = getService(companyId, c.get('companyTimezone') as string);
  const result = await service.getCheckInStatus(user.id);

  return c.json({ success: true, data: result });
}
