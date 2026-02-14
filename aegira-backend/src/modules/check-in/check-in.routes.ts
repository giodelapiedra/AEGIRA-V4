// Check-In Module Routes
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './check-in.controller';
import { submitCheckInSchema, getCheckInHistorySchema } from './check-in.validator';

const router = new Hono();

// Apply auth and tenant middleware to all routes
router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Only workers and team leads submit check-ins (they're assigned to teams)
const checkInRoles = roleMiddleware(['WORKER', 'TEAM_LEAD']);

// POST /api/v1/check-ins - Submit a new check-in
router.post('/', checkInRoles, zValidator('json', submitCheckInSchema), controller.submitCheckIn);

// GET endpoints below are scoped to authenticated user's own data via c.get('userId')
// - /:id: has manual access control in controller (owner, WHS, SUPERVISOR, ADMIN, TEAM_LEAD)

// GET /api/v1/check-ins/today - Get today's check-in (MUST be before /:id)
router.get('/today', controller.getTodayCheckIn);

// GET /api/v1/check-ins/status - Get check-in status (restricted to roles that can submit)
router.get('/status', checkInRoles, controller.getCheckInStatus);

// GET /api/v1/check-ins/history - Get check-in history (MUST be before /:id)
router.get('/history', zValidator('query', getCheckInHistorySchema), controller.getCheckInHistory);

// GET /api/v1/check-ins/:id - Get check-in by ID (MUST be last - catches all)
router.get('/:id', controller.getCheckInById);

export { router as checkInRoutes };
