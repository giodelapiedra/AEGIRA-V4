// Auth Validation Schemas
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
});

export const signupSchema = z.object({
  // Admin personal info
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  // Company info
  companyName: z.string().min(1, 'Company name is required').trim(),
  timezone: z.string().default('Asia/Manila'),
  industry: z.string().optional(),
  businessRegistrationType: z.string().min(1, 'Business registration ID type is required').trim(),
  businessRegistrationNumber: z.string().min(1, 'Business registration number is required').trim(),
  businessType: z.string().min(1, 'Business type is required').trim(),

  // Business physical address
  addressStreet: z.string().min(1, 'Street address is required').trim(),
  addressCity: z.string().min(1, 'City is required').trim(),
  addressPostalCode: z.string().min(1, 'Postal/Zip code is required').trim(),
  addressState: z.string().min(1, 'State/Province/Region is required').trim(),
  addressCountry: z.string().min(1, 'Country is required').trim(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(12, 'New password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const verifyPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyPasswordInput = z.infer<typeof verifyPasswordSchema>;
