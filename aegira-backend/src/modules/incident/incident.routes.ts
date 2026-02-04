import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './incident.controller';
import {
  createIncidentSchema,
  getIncidentsQuerySchema,
  getMyIncidentsQuerySchema,
  rejectIncidentSchema,
} from './incident.validator';

const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

const whsOrAdmin = roleMiddleware(['ADMIN', 'WHS']);
const whsOnly = roleMiddleware(['WHS']);
const allAuthenticated = roleMiddleware(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'ADMIN', 'WHS']);

// IMPORTANT: Specific routes BEFORE parameterized routes

// GET /api/v1/incidents/my — own incidents (all authenticated users)
router.get(
  '/my',
  allAuthenticated,
  zValidator('query', getMyIncidentsQuerySchema),
  controller.getMyIncidents
);

// POST /api/v1/incidents — create incident (all authenticated users)
router.post(
  '/',
  allAuthenticated,
  zValidator('json', createIncidentSchema),
  controller.createIncident
);

// GET /api/v1/incidents — list all incidents (WHS/ADMIN only)
router.get(
  '/',
  whsOrAdmin,
  zValidator('query', getIncidentsQuerySchema),
  controller.getIncidents
);

// GET /api/v1/incidents/:id — single incident detail
router.get('/:id', allAuthenticated, controller.getIncidentById);

// GET /api/v1/incidents/:id/timeline — incident event timeline
router.get('/:id/timeline', allAuthenticated, controller.getIncidentTimeline);

// PATCH /api/v1/incidents/:id/approve — approve incident (WHS only)
router.patch('/:id/approve', whsOnly, controller.approveIncident);

// PATCH /api/v1/incidents/:id/reject — reject incident (WHS only)
router.patch(
  '/:id/reject',
  whsOnly,
  zValidator('json', rejectIncidentSchema),
  controller.rejectIncident
);

export { router as incidentRoutes };
