// Custom Error Classes

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error factory functions
export const Errors = {
  notFound: (resource: string): AppError =>
    new AppError('NOT_FOUND', `${resource} not found`, 404),

  unauthorized: (message = 'Unauthorized'): AppError =>
    new AppError('UNAUTHORIZED', message, 401),

  forbidden: (message = 'Access denied'): AppError =>
    new AppError('FORBIDDEN', message, 403),

  conflict: (message: string): AppError =>
    new AppError('CONFLICT', message, 409),

  validation: (message: string): AppError =>
    new AppError('VALIDATION_ERROR', message, 400),

  internal: (message = 'Internal server error'): AppError =>
    new AppError('INTERNAL_ERROR', message, 500),
};
