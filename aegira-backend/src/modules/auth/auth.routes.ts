// Auth Module Routes
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ZodError } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import * as controller from './auth.controller';
import { loginSchema, signupSchema, changePasswordSchema, verifyPasswordSchema } from './auth.validator';

const router = new Hono();

// Custom validation error hook
interface ValidationResult {
  success: boolean;
  error?: ZodError;
}

const validationHook = (result: ValidationResult, c: Context): Response | undefined => {
  if (!result.success && result.error) {
    const firstError = result.error.issues[0];
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstError?.message || 'Validation failed',
          field: firstError?.path?.join('.'),
        },
      },
      400
    );
  }
  return undefined;
};

// POST /api/v1/auth/signup - Create new company admin account
router.post(
  '/signup',
  zValidator('json', signupSchema, validationHook),
  controller.signup
);

// POST /api/v1/auth/login
router.post(
  '/login',
  zValidator('json', loginSchema, validationHook),
  controller.login
);

// POST /api/v1/auth/refresh (authenticated)
router.post('/refresh', authMiddleware, controller.refreshToken);

// GET /api/v1/auth/me (authenticated - validate session & get current user)
router.get('/me', authMiddleware, controller.getMe);

// POST /api/v1/auth/logout (authenticated - ensures only session owners can logout)
router.post('/logout', authMiddleware, controller.logout);

// PATCH /api/v1/auth/change-password (authenticated)
router.patch(
  '/change-password',
  authMiddleware,
  zValidator('json', changePasswordSchema, validationHook),
  controller.changePassword
);

// POST /api/v1/auth/verify-password (authenticated - re-auth gate)
router.post(
  '/verify-password',
  authMiddleware,
  zValidator('json', verifyPasswordSchema, validationHook),
  controller.verifyUserPassword
);

export { router as authRoutes };
