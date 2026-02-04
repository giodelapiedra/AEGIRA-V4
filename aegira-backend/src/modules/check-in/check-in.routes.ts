// Check-In Module Routes
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import * as controller from './check-in.controller';
import { submitCheckInSchema, getCheckInHistorySchema } from './check-in.validator';

const router = new Hono();

// Apply auth and tenant middleware to all routes
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// POST /api/v1/check-ins - Submit a new check-in
router.post('/', zValidator('json', submitCheckInSchema), controller.submitCheckIn);

// GET /api/v1/check-ins/today - Get today's check-in (MUST be before /:id)
router.get('/today', controller.getTodayCheckIn);

// GET /api/v1/check-ins/status - Get check-in status (can they check in based on team schedule)
router.get('/status', controller.getCheckInStatus);

// GET /api/v1/check-ins/history - Get check-in history (MUST be before /:id)
router.get('/history', zValidator('query', getCheckInHistorySchema), controller.getCheckInHistory);

// GET /api/v1/check-ins/:id - Get check-in by ID (MUST be last - catches all)
router.get('/:id', controller.getCheckInById);

export { router as checkInRoutes };
