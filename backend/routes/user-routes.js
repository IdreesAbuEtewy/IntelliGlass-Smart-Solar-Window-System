/**
 * IntelliGlass - Smart Solar Window System
 * User Routes
 * 
 * This module defines API routes for user management and administration.
 */

const express = require('express');
const router = express.Router();
const { asyncHandler, createError } = require('../middleware/error-middleware');
const { authMiddleware, adminMiddleware } = require('../middleware/auth-middleware');
const logger = require('../utils/logger');

// Firebase services
const { getAuth, getFirestore } = require('../firebase/firebase-config');

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 * @access  Admin
 */
router.get('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  try {
    const db = getFirestore();
    const usersSnapshot = await db.collection('user_profiles').get();
    
    const users = [];
    usersSnapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.status(200).json(users);
    
  } catch (error) {
    logger.error('Error fetching users:', error);
    throw createError(500, 'Failed to fetch users');
  }
}));

/**
 * @route   GET /api/users/:userId
 * @desc    Get a specific user (admin only)
 * @access  Admin
 */
router.get('/:userId', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  
  try {
    const db = getFirestore();
    const userDoc = await db.collection('user_profiles').doc(userId).get();
    
    if (!userDoc.exists) {
      throw createError(404, 'User not found');
    }
    
    // Get user's devices
    const devicesSnapshot = await db.collection('devices')
      .where('userId', '==', userId)
      .get();
    
    const devices = [];
    devicesSnapshot.forEach(doc => {
      devices.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.status(200).json({
      id: userDoc.id,
      ...userDoc.data(),
      devices
    });
    
  } catch (error) {
    logger.error(`Error fetching user ${userId}:`, error);
    throw createError(500, 'Failed to fetch user');
  }
}));

/**
 * @route   PUT /api/users/:userId/role
 * @desc    Update a user's role (admin only)
 * @access  Admin
 */
router.put('/:userId/role', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const { role } = req.body;
  
  if (!role || !['user', 'admin'].includes(role)) {
    throw createError(400, 'Valid role is required (user or admin)');
  }
  
  try {
    const db = getFirestore();
    
    // Check if user exists
    const userDoc = await db.collection('user_profiles').doc(userId).get();
    if (!userDoc.exists) {
      throw createError(404, 'User not found');
    }
    
    // Update user role
    await db.collection('user_profiles').doc(userId).update({
      role,
      updatedAt: new Date().toISOString()
    });
    
    logger.info(`User ${userId} role updated to ${role} by admin ${req.user.uid}`);
    
    // Get updated user data
    const updatedUserDoc = await db.collection('user_profiles').doc(userId).get();
    
    res.status(200).json({
      id: updatedUserDoc.id,
      ...updatedUserDoc.data()
    });
    
  } catch (error) {
    logger.error(`Error updating user ${userId} role:`, error);
    throw createError(500, 'Failed to update user role');
  }
}));

/**
 * @route   DELETE /api/users/:userId
 * @desc    Delete a user (admin only)
 * @access  Admin
 */
router.delete('/:userId', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  
  // Prevent deleting yourself
  if (userId === req.user.uid) {
    throw createError(400, 'Cannot delete your own account');
  }
  
  try {
    const db = getFirestore();
    const auth = getAuth();
    
    // Check if user exists
    const userDoc = await db.collection('user_profiles').doc(userId).get();
    if (!userDoc.exists) {
      throw createError(404, 'User not found');
    }
    
    // Start a batch operation
    const batch = db.batch();
    
    // Delete user profile
    batch.delete(db.collection('user_profiles').doc(userId));
    
    // Get user's devices
    const devicesSnapshot = await db.collection('devices')
      .where('userId', '==', userId)
      .get();
    
    // Delete user's devices
    devicesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Get user's schedules
    const schedulesSnapshot = await db.collection('schedules')
      .where('userId', '==', userId)
      .get();
    
    // Delete user's schedules
    schedulesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Get user's notification tokens
    const tokensSnapshot = await db.collection('notification_tokens')
      .where('userId', '==', userId)
      .get();
    
    // Delete user's notification tokens
    tokensSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Commit the batch
    await batch.commit();
    
    // Delete the user from Firebase Auth
    await auth.deleteUser(userId);
    
    logger.info(`User ${userId} deleted by admin ${req.user.uid}`);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    logger.error(`Error deleting user ${userId}:`, error);
    throw createError(500, 'Failed to delete user');
  }
}));

/**
 * @route   GET /api/users/stats/overview
 * @desc    Get user statistics overview (admin only)
 * @access  Admin
 */
router.get('/stats/overview', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  try {
    const db = getFirestore();
    
    // Get all users
    const usersSnapshot = await db.collection('user_profiles').get();
    const totalUsers = usersSnapshot.size;
    
    // Count users by role
    let adminCount = 0;
    let userCount = 0;
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.role === 'admin') {
        adminCount++;
      } else {
        userCount++;
      }
    });
    
    // Get active users in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeUsersSnapshot = await db.collection('user_profiles')
      .where('lastLogin', '>=', thirtyDaysAgo)
      .get();
    
    const activeUsers = activeUsersSnapshot.size;
    
    // Get total devices
    const devicesSnapshot = await db.collection('devices').get();
    const totalDevices = devicesSnapshot.size;
    
    // Get devices registered in the last 30 days
    const newDevicesSnapshot = await db.collection('devices')
      .where('createdAt', '>=', thirtyDaysAgo)
      .get();
    
    const newDevices = newDevicesSnapshot.size;
    
    res.status(200).json({
      totalUsers,
      activeUsers,
      usersByRole: {
        admin: adminCount,
        user: userCount
      },
      totalDevices,
      newDevices,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error fetching user statistics:', error);
    throw createError(500, 'Failed to fetch user statistics');
  }
}));

module.exports = router;