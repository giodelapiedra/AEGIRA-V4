// Multi-Tenant Context Middleware
// Validates company exists and is active, and caches company timezone on the context.
// This eliminates per-request timezone queries in controllers and services.
import { Context, Next } from 'hono';
import { AppError } from '../shared/errors';
import { prisma } from '../config/database';

const DEFAULT_TIMEZONE = 'Asia/Manila';

export async function tenantMiddleware(c: Context, next: Next): Promise<void> {
  const companyId = c.get('companyId') as string | undefined;

  if (!companyId) {
    throw new AppError('FORBIDDEN', 'Company context not found', 403);
  }

  // Validate company exists and is active, and fetch timezone in the same query
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, is_active: true, timezone: true }
  });

  if (!company) {
    throw new AppError('FORBIDDEN', 'Company not found', 403);
  }

  if (!company.is_active) {
    throw new AppError('FORBIDDEN', 'Company is inactive', 403);
  }

  // Cache timezone on context — controllers/services use c.get('companyTimezone')
  c.set('companyTimezone', company.timezone || DEFAULT_TIMEZONE);

  await next();
}
