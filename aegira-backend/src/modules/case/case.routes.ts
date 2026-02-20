import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './case.controller';
import { getCasesQuerySchema, updateCaseSchema } from './case.validator';

const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

const whsOnly = roleMiddleware(['WHS']);
const allAuthenticated = roleMiddleware(['WORKER', 'TEAM_LEAD', 'SUPERVISOR', 'ADMIN', 'WHS']);

// GET /api/v1/cases — list all cases (WHS only)
router.get(
  '/',
  whsOnly,
  zValidator('query', getCasesQuerySchema),
  controller.getCases
);

// GET /api/v1/cases/:id — single case detail (owner of linked incident or WHS/ADMIN)
router.get('/:id', allAuthenticated, controller.getCaseById);

// PATCH /api/v1/cases/:id — update case (WHS only)
router.patch(
  '/:id',
  whsOnly,
  zValidator('json', updateCaseSchema),
  controller.updateCase
);

export { router as caseRoutes };
