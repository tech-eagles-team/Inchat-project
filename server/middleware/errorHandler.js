/**
 * Global error handler middleware
 * Catches and formats all errors consistently
 */
export const errorHandler = (err, req, res, next) => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = null;

  // Handle different error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = Object.values(err.errors || {}).map(e => e.message);
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0];
    message = `${field ? field.charAt(0).toUpperCase() + field.slice(1) : 'Field'} already exists`;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  // Log error details for debugging
  const errorLog = {
    timestamp: new Date().toISOString(),
    statusCode,
    message,
    path: req.path,
    method: req.method,
    userId: req.user?._id || 'anonymous',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  console.error('Error:', errorLog);

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Custom error class for operational errors
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async error wrapper - catches errors in async route handlers
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

