// Dashboard Module Routes
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './dashboard.controller';

const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Role-based access
const anyRole = roleMiddleware(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'ADMIN']);
const teamLeadUp = roleMiddleware(['TEAM_LEAD', 'SUPERVISOR', 'ADMIN']);
const supervisorUp = roleMiddleware(['SUPERVISOR', 'ADMIN']);
const adminOnly = roleMiddleware(['ADMIN']);

// GET /api/v1/dashboard/summary - Get dashboard summary (SUPERVISOR/ADMIN)
router.get('/summary', supervisorUp, controller.getSummary);

// GET /api/v1/dashboard/worker - Worker dashboard with personal stats (any authenticated)
router.get('/worker', anyRole, controller.getWorkerDashboard);

// GET /api/v1/dashboard/team-lead - Team lead dashboard with team oversight (TEAM_LEAD+)
router.get('/team-lead', teamLeadUp, controller.getTeamLeadDashboard);

// GET /api/v1/dashboard/supervisor - Supervisor dashboard with all teams overview (SUPERVISOR+)
router.get('/supervisor', supervisorUp, controller.getSupervisorDashboard);

// GET /api/v1/dashboard/admin - Admin dashboard (company overview) (ADMIN only)
router.get('/admin', adminOnly, controller.getSummary);

// GET /api/v1/dashboard/team/:id - Get team dashboard (TEAM_LEAD+)
router.get('/team/:id', teamLeadUp, controller.getTeamDashboard);

// GET /api/v1/dashboard/trends - Get readiness trends (SUPERVISOR+)
router.get('/trends', supervisorUp, controller.getTrends);

export { router as dashboardRoutes };
