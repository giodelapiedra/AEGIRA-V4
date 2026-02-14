// Multi-Tenant Context Middleware
// Validates company exists and is active, and caches company timezone on the context.
// Uses in-memory cache (5-min TTL) to avoid hitting the DB on every authenticated request.
import { Context, Next } from 'hono';
import { AppError } from '../shared/errors';
import { prisma } from '../config/database';

const DEFAULT_TIMEZONE = 'Asia/Manila';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedCompany {
  is_active: boolean;
  timezone: string;
  expiresAt: number;
}

const companyCache = new Map<string, CachedCompany>();

export async function tenantMiddleware(c: Context, next: Next): Promise<void> {
  const companyId = c.get('companyId') as string | undefined;

  if (!companyId) {
    throw new AppError('FORBIDDEN', 'Company context not found', 403);
  }

  // Check in-memory cache first
  const cached = companyCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.is_active) {
      throw new AppError('FORBIDDEN', 'Company is inactive', 403);
    }
    c.set('companyTimezone', cached.timezone || DEFAULT_TIMEZONE);
    return next();
  }

  // Cache miss — validate company exists and is active
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, is_active: true, timezone: true },
  });

  if (!company) {
    throw new AppError('FORBIDDEN', 'Company not found', 403);
  }

  // Store in cache before checking is_active (cache inactive state too)
  companyCache.set(companyId, {
    is_active: company.is_active,
    timezone: company.timezone,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  if (!company.is_active) {
    throw new AppError('FORBIDDEN', 'Company is inactive', 403);
  }

  // Cache timezone on context — controllers/services use c.get('companyTimezone')
  c.set('companyTimezone', company.timezone || DEFAULT_TIMEZONE);

  await next();
}

/** Invalidate cached company data (call after admin updates company settings) */
export function invalidateCompanyCache(companyId: string): void {
  companyCache.delete(companyId);
}
