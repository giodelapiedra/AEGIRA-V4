// Team Module Routes
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './team.controller';
import * as missedCheckInController from '../missed-check-in/missed-check-in.controller';
import { createTeamSchema, updateTeamSchema } from './team.validator';
import { getMissedCheckInsQuerySchema } from '../missed-check-in/missed-check-in.validator';

const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Role-based access
const adminOnly = roleMiddleware(['ADMIN']);
const teamLeadUp = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']);
const teamLeadUpOrWhs = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN', 'WHS']);

// GET /api/v1/teams - List teams (ADMIN only - full list)
router.get('/', adminOnly, controller.listTeams);

// POST /api/v1/teams - Create team (ADMIN only)
router.post('/', adminOnly, zValidator('json', createTeamSchema), controller.createTeam);

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes

// GET /api/v1/teams/missed-check-ins - Get missed check-ins (from DB)
router.get('/missed-check-ins', teamLeadUpOrWhs, zValidator('query', getMissedCheckInsQuerySchema), missedCheckInController.getMissedCheckIns);

// GET /api/v1/teams/analytics - Get team analytics
router.get('/analytics', teamLeadUp, controller.getTeamAnalytics);

// GET /api/v1/teams/check-in-history - Get check-in history for team workers (+ WHS for investigation)
router.get('/check-in-history', teamLeadUpOrWhs, controller.getCheckInHistory);

// GET /api/v1/teams/my-members - Get current user's team members
router.get('/my-members', teamLeadUp, controller.getMyTeamMembers);

// Parameterized routes come AFTER specific routes
// GET /api/v1/teams/:id - Get team by ID (TEAM_LEAD+ can view)
router.get('/:id', teamLeadUp, controller.getTeamById);

// PATCH /api/v1/teams/:id - Update team (ADMIN only)
router.patch('/:id', adminOnly, zValidator('json', updateTeamSchema), controller.updateTeam);

// GET /api/v1/teams/:id/members - Get team members (TEAM_LEAD+)
router.get('/:id/members', teamLeadUp, controller.getTeamMembers);

export { router as teamRoutes };
