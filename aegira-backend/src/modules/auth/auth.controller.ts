// Auth Controller - Request Handling
import type { Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { prisma } from '../../config/database';
import { AuthService } from './auth.service';
import { AppError } from '../../shared/errors';
import { hashPassword, verifyPassword } from '../../shared/password';
import { logAudit } from '../../shared/audit';

const authService = new AuthService();

// Cookie configuration constants
const AUTH_COOKIE_NAME = 'auth_token';
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Helper: Set auth cookie
function setAuthCookie(c: Context, token: string): void {
  setCookie(c, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  });
}

// Helper: Format user response
interface UserWithCompany {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  date_of_birth: Date | null;
  profile_picture_url: string | null;
  role: string;
  company_id: string;
  company: { name: string; timezone: string };
}

function formatUserResponse(person: UserWithCompany) {
  return {
    id: person.id,
    email: person.email,
    firstName: person.first_name,
    lastName: person.last_name,
    gender: person.gender,
    dateOfBirth: person.date_of_birth ? person.date_of_birth.toISOString().split('T')[0] : null,
    profilePictureUrl: person.profile_picture_url || null,
    role: person.role,
    companyId: person.company_id,
    companyName: person.company.name,
    companyTimezone: person.company.timezone,
  };
}

export async function login(c: Context): Promise<Response> {
  const { email, password } = await c.req.json();

  // Find active person by email in an active company
  // NOTE: Email is scoped @@unique([company_id, email]) so the same email can
  // theoretically exist in multiple companies. We filter by is_active to ensure
  // we only match active users in active companies. If duplicates exist across
  // companies, we prefer the most recently created active account.
  const person = await prisma.person.findFirst({
    where: {
      email: email.toLowerCase(),
      is_active: true,
      company: { is_active: true },
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      gender: true,
      date_of_birth: true,
      profile_picture_url: true,
      role: true,
      company_id: true,
      is_active: true,
      password_hash: true,
      company: { select: { name: true, timezone: true } },
    },
  });

  if (!person || !person.password_hash) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  // Verify password
  const isValid = await verifyPassword(password, person.password_hash);
  if (!isValid) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  // Generate token and set cookie
  const token = authService.generateToken({
    sub: person.id,
    email: person.email,
    companyId: person.company_id,
    role: person.role,
  });

  setAuthCookie(c, token);

  // Audit login for non-worker roles only (non-blocking)
  if (['ADMIN', 'SUPERVISOR', 'TEAM_LEAD'].includes(person.role.toUpperCase())) {
    logAudit({
      companyId: person.company_id,
      personId: person.id,
      action: 'LOGIN',
      entityType: 'PERSON',
      entityId: person.id,
    });
  }

  return c.json({
    success: true,
    data: { user: formatUserResponse(person) },
  });
}

export async function getMe(c: Context): Promise<Response> {
  const userId = c.get('userId') as string;
  const companyId = c.get('companyId') as string;

  // Verify user belongs to the authenticated company (defense-in-depth)
  const person = await prisma.person.findFirst({
    where: {
      id: userId,
      company_id: companyId,
      is_active: true,
      company: { is_active: true },
    },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      gender: true,
      date_of_birth: true,
      profile_picture_url: true,
      role: true,
      company_id: true,
      is_active: true,
      company: { select: { name: true, timezone: true } },
    },
  });

  if (!person) {
    throw new AppError('UNAUTHORIZED', 'Account not found or disabled', 401);
  }

  return c.json({
    success: true,
    data: { user: formatUserResponse(person) },
  });
}

export async function refreshToken(c: Context): Promise<Response> {
  // Token refresh not yet implemented - return proper error instead of stub
  throw new AppError('NOT_IMPLEMENTED', 'Token refresh is not yet available. Please re-login.', 501);
}

export async function logout(c: Context): Promise<Response> {
  deleteCookie(c, AUTH_COOKIE_NAME, { path: '/' });
  return c.json({ success: true, data: { message: 'Logged out successfully' } });
}

export async function changePassword(c: Context): Promise<Response> {
  const userId = c.get('userId') as string;
  const companyId = c.get('companyId') as string;
  const { currentPassword, newPassword } = await c.req.json();

  // Find person with company_id verification
  const person = await prisma.person.findFirst({
    where: { id: userId, company_id: companyId },
    select: { id: true, password_hash: true },
  });

  if (!person || !person.password_hash) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, person.password_hash);
  if (!isValid) {
    throw new AppError('INVALID_PASSWORD', 'Current password is incorrect', 400);
  }

  // Update password with bcrypt
  const newHash = await hashPassword(newPassword);
  await prisma.person.update({
    where: { id: userId, company_id: companyId },
    data: { password_hash: newHash },
  });

  // Audit password change (non-blocking)
  logAudit({
    companyId,
    personId: userId,
    action: 'CHANGE_PASSWORD',
    entityType: 'PERSON',
    entityId: userId,
  });

  return c.json({
    success: true,
    data: { message: 'Password updated successfully' },
  });
}

export async function verifyUserPassword(c: Context): Promise<Response> {
  const userId = c.get('userId') as string;
  const companyId = c.get('companyId') as string;
  const { password } = await c.req.json();

  // Find person with company_id verification
  const person = await prisma.person.findFirst({
    where: { id: userId, company_id: companyId },
    select: { id: true, password_hash: true },
  });

  if (!person || !person.password_hash) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  const isValid = await verifyPassword(password, person.password_hash);
  if (!isValid) {
    throw new AppError('INVALID_PASSWORD', 'Password is incorrect', 401);
  }

  return c.json({
    success: true,
    data: { verified: true },
  });
}

export async function signup(c: Context): Promise<Response> {
  const {
    firstName,
    lastName,
    email,
    password,
    companyName,
    timezone,
    industry,
    businessRegistrationType,
    businessRegistrationNumber,
    businessType,
    addressStreet,
    addressCity,
    addressPostalCode,
    addressState,
    addressCountry,
  } = await c.req.json();

  // Check if email already exists
  const existingPerson = await prisma.person.findFirst({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });

  if (existingPerson) {
    throw new AppError('EMAIL_EXISTS', 'Email already registered', 400);
  }

  // Hash password with bcrypt
  const passwordHash = await hashPassword(password);

  // Generate unique slug for company
  const slug =
    companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    Date.now().toString(36);

  // Create company and admin in a single transaction
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        slug,
        timezone: timezone || 'Asia/Manila',
        industry: industry || null,
        business_registration_type: businessRegistrationType,
        business_registration_number: businessRegistrationNumber,
        business_type: businessType,
        address_street: addressStreet,
        address_city: addressCity,
        address_postal_code: addressPostalCode,
        address_state: addressState,
        address_country: addressCountry,
        is_active: true,
      },
    });

    const admin = await tx.person.create({
      data: {
        company_id: company.id,
        first_name: firstName,
        last_name: lastName,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role: 'ADMIN',
        is_active: true,
      },
    });

    return { company, admin };
  });

  // Generate token and set cookie
  const token = authService.generateToken({
    sub: result.admin.id,
    email: result.admin.email,
    companyId: result.company.id,
    role: result.admin.role,
  });

  setAuthCookie(c, token);

  return c.json(
    {
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: result.admin.id,
          email: result.admin.email,
          firstName: result.admin.first_name,
          lastName: result.admin.last_name,
          gender: null,
          dateOfBirth: null,
          profilePictureUrl: null,
          role: result.admin.role,
          companyId: result.company.id,
          companyName: result.company.name,
          companyTimezone: result.company.timezone,
        },
      },
    },
    201
  );
}
