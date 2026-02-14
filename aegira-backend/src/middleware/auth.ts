// JWT Authentication Middleware
import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../shared/errors';
import type { AuthenticatedUser } from '../types/api.types';

interface JwtPayload {
  sub: string;
  email: string;
  companyId: string;
  role: string;
}

export async function authMiddleware(c: Context, next: Next): Promise<void> {
  // Support both cookie and Authorization header (mobile apps use Bearer token)
  let token = getCookie(c, 'auth_token');

  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;

    const user: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email,
      companyId: payload.companyId,
      role: payload.role,
    };

    c.set('user', user);
    c.set('userId', payload.sub);
    c.set('companyId', payload.companyId);
    c.set('userRole', payload.role);

    await next();
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}
