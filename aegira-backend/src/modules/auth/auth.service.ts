// Auth Service - Business Logic
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors';

interface TokenPayload {
  sub: string;
  email: string;
  companyId: string;
  role: string;
}

/**
 * Parse a JWT duration string (e.g. '7d', '24h', '30m') to seconds.
 * Used to sync cookie maxAge with JWT_EXPIRES_IN.
 */
function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    // Default to 7 days if format is unrecognized
    return 60 * 60 * 24 * 7;
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: return 60 * 60 * 24 * 7;
  }
}

export class AuthService {
  /** Cookie maxAge in seconds, derived from JWT_EXPIRES_IN */
  readonly cookieMaxAge: number;

  constructor() {
    this.cookieMaxAge = parseDurationToSeconds(env.JWT_EXPIRES_IN);
  }

  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
    } catch {
      throw new AppError('INVALID_TOKEN', 'Invalid or expired token', 401);
    }
  }
}
