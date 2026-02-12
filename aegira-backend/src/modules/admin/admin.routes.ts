// Admin Module Routes
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { roleMiddleware } from '../../middleware/role';
import * as controller from './admin.controller';
import { createHolidaySchema, updateHolidaySchema, updateSettingsSchema, updateUserRoleSchema } from './admin.validator';

const router = new Hono();

router.use('*', authMiddleware);
router.use('*', tenantMiddleware);
router.use('*', roleMiddleware(['ADMIN']));

// Company Settings
router.get('/company/settings', controller.getCompanySettings);
router.patch('/company/settings', zValidator('json', updateSettingsSchema), controller.updateCompanySettings);

// Holidays
router.get('/holidays', controller.listHolidays);
router.post('/holidays', zValidator('json', createHolidaySchema), controller.createHoliday);
router.patch('/holidays/:id', zValidator('json', updateHolidaySchema), controller.updateHoliday);
router.delete('/holidays/:id', controller.deleteHoliday);

// Audit Logs
router.get('/audit-logs', controller.listAuditLogs);

// User Roles
router.get('/users/roles', controller.listUserRoles);
router.patch('/users/:id/role', zValidator('json', updateUserRoleSchema), controller.updateUserRole);

export { router as adminRoutes };
