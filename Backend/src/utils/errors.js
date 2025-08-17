// errors.js
class AppError extends Error {
  constructor(message, statusCode, details = null, code = null) {
    super(message);
    this.statusCode = Number(statusCode);
    this.status = this.#determineStatus(statusCode);
    this.isOperational = true;
    this.details = details;
    this.code = code; // Unique error code for client-side handling

    Error.captureStackTrace(this, this.constructor);
  }

  #determineStatus(statusCode) {
    if (!Number.isInteger(statusCode)) {
      return 'error'; // Default to 'error' for invalid status codes
    }
    return statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
  }

  toJSON() {
    const { message, statusCode, status, details, code } = this;
    return {
      status,
      statusCode,
      message,
      ...(code && { code }),
      ...(details && { details }),
    };
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null, code = 'VALIDATION_ERROR') {
    super(message, 400, details, code);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', details = null, code = 'AUTHENTICATION_ERROR') {
    super(message, 401, details, code);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied', details = null, code = 'AUTHORIZATION_ERROR') {
    super(message, 403, details, code);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null, code = 'NOT_FOUND') {
    super(message, 404, details, code);
  }
}

// Export for ES Modules
export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
};