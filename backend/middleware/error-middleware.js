/**
 * IntelliGlass - Smart Solar Window System
 * Error Handling Middleware
 * 
 * This middleware provides centralized error handling for the API.
 */

const logger = require('../utils/logger');

/**
 * Custom API error class
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiError';
  }
}

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('API Error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    user: req.user ? req.user.uid : 'unauthenticated'
  });
  
  // Handle ApiError instances
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      details: err.details
    });
  }
  
  // Handle Firebase Auth errors
  if (err.code && err.code.startsWith('auth/')) {
    return res.status(401).json({
      error: 'Authentication Error',
      message: err.message,
      code: err.code
    });
  }
  
  // Handle Firebase Firestore errors
  if (err.code && err.code.startsWith('firestore/')) {
    return res.status(500).json({
      error: 'Database Error',
      message: 'An error occurred while accessing the database',
      code: err.code
    });
  }
  
  // Handle validation errors (e.g., from express-validator)
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: err.errors
    });
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Token expired'
    });
  }
  
  // Default to 500 Internal Server Error
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal Server Error' : err.message;
  
  // In production, don't expose internal error details
  const responseBody = {
    error: err.name || 'Error',
    message: message
  };
  
  // Only include error details in development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    responseBody.stack = err.stack;
  }
  
  return res.status(statusCode).json(responseBody);
};

// Helper function to create API errors
const createError = (statusCode, message, details = null) => {
  return new ApiError(statusCode, message, details);
};

// Helper function to handle async route handlers
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  createError,
  asyncHandler,
  ApiError
};