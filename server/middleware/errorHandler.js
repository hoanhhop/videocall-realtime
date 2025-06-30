// server/middleware/errorHandler.js
const { createLogger } = require('../utils/logger');
const logger = createLogger('error-handler');

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Log error
  logger.error(`${err.name}: ${err.message}`, {
    path: req.path,
    method: req.method,
    body: req.body,
    stack: err.stack
  });

  // Set status code
  const statusCode = err.statusCode || 500;

  // Format error response
  const errorResponse = {
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR'
    }
  };

  // Add stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
}

module.exports = errorHandler;