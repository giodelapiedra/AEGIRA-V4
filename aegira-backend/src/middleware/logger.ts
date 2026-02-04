// Request Logging Middleware
import { Context, Next } from 'hono';
import { logger } from '../config/logger';

export async function loggerMiddleware(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  c.set('requestId', requestId);

  logger.info({
    requestId,
    method: c.req.method,
    path: c.req.path,
    type: 'request',
  });

  await next();

  const duration = Date.now() - start;

  logger.info({
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration: `${duration}ms`,
    type: 'response',
  });
}
