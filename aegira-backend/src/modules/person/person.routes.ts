// Person Module Routes
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './person.controller';
import { createPersonSchema, updatePersonSchema, updateProfileSchema } from './person.validator';

const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);

// Role-based access
const adminOnly = roleMiddleware(['ADMIN']);
const adminOrSupervisor = roleMiddleware(['ADMIN', 'SUPERVISOR']);
const adminSupervisorOrWhs = roleMiddleware(['ADMIN', 'SUPERVISOR', 'WHS']);

// GET /api/v1/persons/me - Get current user profile (any authenticated user)
router.get('/me', controller.getCurrentProfile);

// PATCH /api/v1/persons/me - Update own profile (any authenticated user)
router.patch('/me', zValidator('json', updateProfileSchema), controller.updateProfile);

// POST /api/v1/persons/me/avatar - Upload profile picture (any authenticated user)
router.post('/me/avatar', bodyLimit({ maxSize: 5 * 1024 * 1024 }), controller.uploadAvatar);

// GET /api/v1/persons - List persons (ADMIN/SUPERVISOR/WHS)
router.get('/', adminSupervisorOrWhs, controller.listPersons);

// POST /api/v1/persons - Create person (ADMIN only)
router.post('/', adminOnly, zValidator('json', createPersonSchema), controller.createPerson);

// GET /api/v1/persons/:id - Get person by ID (ADMIN/SUPERVISOR only)
router.get('/:id', adminOrSupervisor, controller.getPersonById);

// PATCH /api/v1/persons/:id - Update person (ADMIN only)
router.patch('/:id', adminOnly, zValidator('json', updatePersonSchema), controller.updatePerson);

export { router as personRoutes };
