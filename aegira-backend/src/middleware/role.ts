// Role-based Access Control Middleware
import { Context, Next } from 'hono';
import { AppError } from '../shared/errors';
import type { AuthenticatedUser } from '../types/api.types';

export function roleMiddleware(allowedRoles: string[]) {
  return async (c: Context, next: Next): Promise<void> => {
    const user = c.get('user') as AuthenticatedUser;

    if (!user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const userRole = user.role.toUpperCase();
    const normalizedAllowedRoles = allowedRoles.map(r => r.toUpperCase());

    if (!normalizedAllowedRoles.includes(userRole)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to access this resource', 403);
    }

    await next();
  };
}
