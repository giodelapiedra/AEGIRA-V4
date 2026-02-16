// Admin Controller - Request Handling
import type { Context } from 'hono';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/errors';
import { parsePagination } from '../../shared/utils';
import { logAudit } from '../../shared/audit';
import type { CreateHolidayData, UpdateSettingsData, UpdateHolidayData, UpdateUserRoleData } from './admin.validator';
import type { Role, Company } from '@prisma/client';
import { AdminRepository } from './admin.repository';
import { TeamRepository } from '../team/team.repository';
import { invalidateCompanyCache } from '../../middleware/tenant';
import { invalidateHolidayCache } from '../../shared/holiday.utils';
import { DateTime } from 'luxon';

/** Map Company entity to frontend-expected camelCase format */
function toCompanySettingsResponse(company: Company) {
  return {
    id: company.id,
    companyName: company.name,
    companyCode: company.slug,
    timezone: company.timezone,
    industry: company.industry || '',
    businessRegistrationType: company.business_registration_type || '',
    businessRegistrationNumber: company.business_registration_number || '',
    businessType: company.business_type || '',
    addressStreet: company.address_street || '',
    addressCity: company.address_city || '',
    addressPostalCode: company.address_postal_code || '',
    addressState: company.address_state || '',
    addressCountry: company.address_country || '',
  };
}

// Company Settings
export async function getCompanySettings(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const repository = new AdminRepository(prisma, companyId);

  const company = await repository.findCompanyById();

  if (!company) {
    throw new AppError('NOT_FOUND', 'Company not found', 404);
  }

  return c.json({ success: true, data: toCompanySettingsResponse(company) });
}

export async function updateCompanySettings(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const data = c.req.valid('json' as never) as UpdateSettingsData;
  const repository = new AdminRepository(prisma, companyId);

  const company = await repository.updateCompany({
    name: data.companyName,
    timezone: data.timezone,
    industry: data.industry,
    businessRegistrationType: data.businessRegistrationType,
    businessRegistrationNumber: data.businessRegistrationNumber,
    businessType: data.businessType,
    addressStreet: data.addressStreet,
    addressCity: data.addressCity,
    addressPostalCode: data.addressPostalCode,
    addressState: data.addressState,
    addressCountry: data.addressCountry,
  });

  // Bust cached company data (timezone, is_active may have changed)
  invalidateCompanyCache(companyId);

  // Audit settings update (non-blocking)
  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_SETTINGS',
    entityType: 'COMPANY',
    entityId: companyId,
    details: data as Record<string, unknown>,
  });

  return c.json({ success: true, data: toCompanySettingsResponse(company) });
}

// Holidays
export async function listHolidays(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const repository = new AdminRepository(prisma, companyId);
  const timezone = c.get('companyTimezone') as string;
  const year = c.req.query('year') || DateTime.now().setZone(timezone).toFormat('yyyy');

  const holidays = await repository.listHolidays(year);

  // Transform to match frontend expected format
  const transformedHolidays = holidays.map((h) => ({
    id: h.id,
    name: h.name,
    date: h.date.toISOString().split('T')[0],
    recurring: h.is_recurring,
    createdAt: h.created_at.toISOString(),
  }));

  return c.json({ success: true, data: { items: transformedHolidays, total: holidays.length } });
}

export async function createHoliday(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const repository = new AdminRepository(prisma, companyId);
  const data = c.req.valid('json' as never) as CreateHolidayData;

  const holiday = await repository.createHoliday({
    name: data.name,
    date: new Date(data.date),
    isRecurring: data.recurring ?? data.is_recurring ?? false,
  });

  invalidateHolidayCache(companyId);

  // Audit holiday creation (non-blocking)
  logAudit({
    companyId,
    personId: userId,
    action: 'CREATE_HOLIDAY',
    entityType: 'HOLIDAY',
    entityId: holiday.id,
    details: { name: data.name, date: data.date },
  });

  return c.json({
    success: true,
    data: {
      id: holiday.id,
      name: holiday.name,
      date: holiday.date.toISOString().split('T')[0],
      recurring: holiday.is_recurring,
      createdAt: holiday.created_at.toISOString(),
    },
  }, 201);
}

export async function updateHoliday(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const repository = new AdminRepository(prisma, companyId);
  const id = c.req.param('id');
  const data = c.req.valid('json' as never) as UpdateHolidayData;

  // Update holiday with company_id filtering (returns null if not found or not owned)
  const holiday = await repository.updateHoliday(id, {
    name: data.name,
    date: data.date ? new Date(data.date) : undefined,
    isRecurring: data.recurring ?? data.is_recurring,
  });

  if (!holiday) {
    throw new AppError('NOT_FOUND', 'Holiday not found', 404);
  }

  invalidateHolidayCache(companyId);

  // Audit holiday update (non-blocking)
  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_HOLIDAY',
    entityType: 'HOLIDAY',
    entityId: id,
    details: data as Record<string, unknown>,
  });

  return c.json({
    success: true,
    data: {
      id: holiday.id,
      name: holiday.name,
      date: holiday.date.toISOString().split('T')[0],
      recurring: holiday.is_recurring,
      createdAt: holiday.created_at.toISOString(),
    },
  });
}

export async function deleteHoliday(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const repository = new AdminRepository(prisma, companyId);
  const id = c.req.param('id');

  // Delete holiday with company_id filtering (returns false if not found or not owned)
  const deleted = await repository.deleteHoliday(id);

  if (!deleted) {
    throw new AppError('NOT_FOUND', 'Holiday not found', 404);
  }

  invalidateHolidayCache(companyId);

  // Audit holiday deletion (non-blocking)
  logAudit({
    companyId,
    personId: userId,
    action: 'DELETE_HOLIDAY',
    entityType: 'HOLIDAY',
    entityId: id,
  });

  return c.json({ success: true, data: { message: 'Holiday deleted' } });
}

// Audit Logs
export async function listAuditLogs(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const repository = new AdminRepository(prisma, companyId);
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'), 50);
  const type = c.req.query('type');
  const search = c.req.query('search');
  const dateFilter = c.req.query('date');

  const paginatedData = await repository.listAuditLogs(
    { page, limit },
    { type, search, dateFilter }
  );

  const items = paginatedData.items;

  // Transform to match frontend expected format
  const transformedItems = items.map((item) => ({
    id: item.id,
    action: item.action,
    entityType: item.entity_type,
    entityId: item.entity_id,
    userId: item.person_id,
    userEmail: item.person?.email || 'system',
    userRole: item.person?.role || null,
    details: typeof item.details === 'object' ? JSON.stringify(item.details) : String(item.details || ''),
    createdAt: item.created_at.toISOString(),
  }));

  return c.json({
    success: true,
    data: {
      items: transformedItems,
      pagination: paginatedData.pagination,
    },
  });
}

// User Roles
export async function listUserRoles(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const repository = new AdminRepository(prisma, companyId);
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'), 50);
  const search = c.req.query('search')?.trim();

  const paginatedData = await repository.listPersons(
    { page, limit },
    { search }
  );

  return c.json({ success: true, data: paginatedData });
}

export async function updateUserRole(c: Context): Promise<Response> {
  const companyId = c.get('companyId') as string;
  const userId = c.get('userId') as string;
  const repository = new AdminRepository(prisma, companyId);
  const id = c.req.param('id');
  const data = c.req.valid('json' as never) as UpdateUserRoleData;
  const newRole = data.role as Role;

  // Prevent self-demotion
  if (id === userId) {
    throw new AppError('FORBIDDEN', 'You cannot change your own role', 403);
  }

  // Fetch current person to check constraints
  const existing = await repository.findPersonById(id);
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Person not found', 404);
  }

  // No-op if role isn't changing
  if (existing.role === newRole) {
    return c.json({
      success: true,
      data: {
        id: existing.id,
        email: existing.email,
        firstName: existing.first_name,
        lastName: existing.last_name,
        role: existing.role,
        isActive: existing.is_active,
      },
    });
  }

  // Guard: cannot change to WORKER if person has no team
  if (newRole === 'WORKER' && !existing.team_id) {
    throw new AppError('TEAM_REQUIRED', 'Cannot assign WORKER role — this person has no team. Assign them to a team first.', 400);
  }

  // Guard: cannot demote a TEAM_LEAD who currently leads a team
  if (existing.role === 'TEAM_LEAD' && newRole !== 'TEAM_LEAD') {
    const teamRepo = new TeamRepository(prisma, companyId);
    const ledTeam = await teamRepo.findByLeaderId(id);
    if (ledTeam) {
      throw new AppError('LEADER_HAS_TEAM', `Cannot change role — this person leads team "${ledTeam.name}". Reassign the team leader first.`, 400);
    }
  }

  // Update person role with company_id filtering
  const person = await repository.updatePersonRole(id, newRole);

  if (!person) {
    throw new AppError('NOT_FOUND', 'Person not found', 404);
  }

  // Audit role update (non-blocking)
  logAudit({
    companyId,
    personId: userId,
    action: 'UPDATE_ROLE',
    entityType: 'PERSON',
    entityId: id,
    details: { previousRole: existing.role, newRole: data.role },
  });

  return c.json({
    success: true,
    data: {
      id: person.id,
      email: person.email,
      firstName: person.first_name,
      lastName: person.last_name,
      role: person.role,
      isActive: person.is_active,
    },
  });
}
