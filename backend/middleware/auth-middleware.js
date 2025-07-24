/**
 * IntelliGlass - Smart Solar Window System
 * Authentication Middleware
 * 
 * This middleware verifies Firebase authentication tokens
 * and adds the authenticated user to the request object.
 */

const { getAuth } = require('../firebase/firebase-config');
const logger = require('../utils/logger');

/**
 * Middleware to verify Firebase authentication token
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No authorization token provided' 
      });
    }
    
    // Check if the header format is correct
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid authorization header format' 
      });
    }
    
    // Extract the token
    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No token provided' 
      });
    }
    
    // Verify the token with Firebase Auth
    const decodedToken = await getAuth().verifyIdToken(token);
    
    if (!decodedToken) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid token' 
      });
    }
    
    // Add the user to the request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      role: decodedToken.role || 'user',
      // Add any other user properties you need
    };
    
    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Token expired' 
      });
    } else if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Token revoked' 
      });
    } else {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid authentication' 
      });
    }
  }
};

/**
 * Middleware to check if user has admin role
 */
const adminMiddleware = (req, res, next) => {
  // First ensure the user is authenticated
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }
  
  // Check if the user has admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Admin access required' 
    });
  }
  
  // User is an admin, proceed
  next();
};

/**
 * Middleware to check if user owns the requested resource
 * This is a factory function that creates middleware for specific resource types
 */
const resourceOwnerMiddleware = (resourceType, resourceIdParam) => {
  return async (req, res, next) => {
    try {
      // First ensure the user is authenticated
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Authentication required' 
        });
      }
      
      // Get the resource ID from the request parameters
      const resourceId = req.params[resourceIdParam];
      
      if (!resourceId) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: `${resourceType} ID is required` 
        });
      }
      
      // Get the Firestore instance
      const { getFirestore } = require('../firebase/firebase-config');
      const db = getFirestore();
      
      // Get the resource document
      const resourceDoc = await db.collection(resourceType + 's').doc(resourceId).get();
      
      if (!resourceDoc.exists) {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: `${resourceType} not found` 
        });
      }
      
      const resourceData = resourceDoc.data();
      
      // Check if the user owns the resource
      if (resourceData.userId !== req.user.uid && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: `You don't have permission to access this ${resourceType}` 
        });
      }
      
      // User owns the resource or is an admin, proceed
      // Add the resource to the request for convenience
      req[resourceType] = {
        id: resourceId,
        ...resourceData
      };
      
      next();
    } catch (error) {
      logger.error(`Error in resourceOwnerMiddleware for ${resourceType}:`, error);
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'An error occurred while checking resource ownership' 
      });
    }
  };
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  resourceOwnerMiddleware
};