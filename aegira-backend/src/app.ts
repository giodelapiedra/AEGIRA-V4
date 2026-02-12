// AEGIRA Backend - Hono App Configuration
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { loggerMiddleware } from './middleware/logger';
import { AppError } from './shared/errors';
import { logger } from './config/logger';
import { env } from './config/env';

// Import routes
import { authRoutes } from './modules/auth/auth.routes';
import { checkInRoutes } from './modules/check-in/check-in.routes';
import { teamRoutes } from './modules/team/team.routes';
import { personRoutes } from './modules/person/person.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { notificationRoutes } from './modules/notification/notification.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { incidentRoutes } from './modules/incident/incident.routes';
import { caseRoutes } from './modules/case/case.routes';

const app = new Hono();

// Global error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    logger.warn({
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: c.req.path,
    });

    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 500
    );
  }

  // Unexpected error
  logger.error({
    error: err.message,
    stack: err.stack,
    path: c.req.path,
  });

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500
  );
});

// Global middleware
app.use('*', secureHeaders());
app.use('*', cors({
  origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
  credentials: true,
}));
app.use('*', loggerMiddleware);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API v1 routes
const api = new Hono();

api.route('/auth', authRoutes);
api.route('/check-ins', checkInRoutes);
api.route('/teams', teamRoutes);
api.route('/persons', personRoutes);
api.route('/dashboard', dashboardRoutes);
api.route('/notifications', notificationRoutes);
api.route('/admin', adminRoutes);
api.route('/incidents', incidentRoutes);
api.route('/cases', caseRoutes);

app.route('/api/v1', api);

export { app };
