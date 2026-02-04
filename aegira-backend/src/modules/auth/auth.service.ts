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

export class AuthService {
  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    } catch {
      throw new AppError('INVALID_TOKEN', 'Invalid or expired token', 401);
    }
  }

  // TODO: Implement login logic with password verification
  // TODO: Implement refresh token logic
}
