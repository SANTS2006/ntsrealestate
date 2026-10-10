// Typed, operational errors. Anything thrown as AppError is safe to surface
// (code + message) to the client; anything else is an unexpected bug and gets
// a generic message in production (see middleware/errorHandler.js).
export class AppError extends Error {
  constructor(code, message, statusCode, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message, details) {
    return new AppError('BAD_REQUEST', message, 400, details);
  }

  static unauthorized(message = 'Authentication is required.') {
    return new AppError('UNAUTHORIZED', message, 401);
  }

  static forbidden(message = 'You do not have permission to perform this action.') {
    return new AppError('FORBIDDEN', message, 403);
  }

  static notFound(message = 'The requested resource could not be found.') {
    return new AppError('RESOURCE_NOT_FOUND', message, 404);
  }

  static conflict(message, details) {
    return new AppError('CONFLICT', message, 409, details);
  }

  static tooManyRequests(message = 'Too many requests. Please try again later.') {
    return new AppError('RATE_LIMITED', message, 429);
  }

  static validation(message, details) {
    return new AppError('VALIDATION_ERROR', message, 422, details);
  }

  static internal(message = 'An unexpected error occurred.') {
    return new AppError('INTERNAL_ERROR', message, 500);
  }
}
