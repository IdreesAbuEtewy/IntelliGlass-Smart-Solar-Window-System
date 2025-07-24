/**
 * IntelliGlass - Smart Solar Window System
 * Authentication Routes
 * 
 * This module defines API routes for user authentication and profile management.
 */

const express = require('express');
const router = express.Router();
const { asyncHandler, createError } = require('../middleware/error-middleware');
const { authMiddleware } = require('../middleware/auth-middleware');
const logger = require('../utils/logger');

// Firebase services
const { getAuth, getFirestore } = require('../firebase/firebase-config');

/**
 * @route   POST /api/auth/verify-token
 * @desc    Verify a Firebase ID token and return user data
 * @access  Private
 */
router.post('/verify-token', authMiddleware, asyncHandler(async (req, res) => {
  // User is already verified by authMiddleware
  // Return user data from Firebase Auth
  const user = req.user;
  
  // Get additional user profile data from Firestore
  const db = getFirestore();
  const userProfileDoc = await db.collection('user_profiles').doc(user.uid).get();
  
  let userProfile = {};
  if (userProfileDoc.exists) {
    userProfile = userProfileDoc.data();
  }
  
  res.status(200).json({
    uid: user.uid,
    email: user.email,
    emailVerified: user.email_verified,
    displayName: user.name || userProfile.displayName,
    photoURL: user.picture || userProfile.photoURL,
    phoneNumber: user.phone_number || userProfile.phoneNumber,
    preferences: userProfile.preferences || {},
    role: userProfile.role || 'user',
    createdAt: userProfile.createdAt || null,
    lastLogin: new Date().toISOString()
  });
}));

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile data
 * @access  Private
 */
router.get('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.uid;
  
  try {
    // Get user profile from Firestore
    const db = getFirestore();
    const userProfileDoc = await db.collection('user_profiles').doc(userId).get();
    
    if (!userProfileDoc.exists) {
      // Create a new profile if it doesn't exist
      const newProfile = {
        uid: userId,
        email: req.user.email,
        displayName: req.user.name || '',
        photoURL: req.user.picture || '',
        phoneNumber: req.user.phone_number || '',
        preferences: {},
        role: 'user',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      
      await db.collection('user_profiles').doc(userId).set(newProfile);
      
      return res.status(200).json(newProfile);
    }
    
    // Return existing profile
    const userProfile = userProfileDoc.data();
    
    // Update last login time
    await db.collection('user_profiles').doc(userId).update({
      lastLogin: new Date().toISOString()
    });
    
    res.status(200).json(userProfile);
    
  } catch (error) {
    logger.error(`Error fetching user profile for ${userId}:`, error);
    throw createError(500, 'Failed to fetch user profile');
  }
}));

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile data
 * @access  Private
 */
router.put('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.uid;
  
  // Fields that can be updated
  const allowedFields = ['displayName', 'phoneNumber', 'preferences', 'notificationSettings'];
  
  // Extract only allowed fields from request body
  const updates = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });
  
  // Add updatedAt timestamp
  updates.updatedAt = new Date().toISOString();
  
  if (Object.keys(updates).length === 1) { // Only updatedAt is present
    throw createError(400, 'No valid fields to update');
  }
  
  try {
    // Update user profile in Firestore
    const db = getFirestore();
    await db.collection('user_profiles').doc(userId).update(updates);
    
    // Get updated profile
    const updatedProfileDoc = await db.collection('user_profiles').doc(userId).get();
    const updatedProfile = updatedProfileDoc.data();
    
    logger.info(`User profile updated for ${userId}`);
    res.status(200).json(updatedProfile);
    
  } catch (error) {
    logger.error(`Error updating user profile for ${userId}:`, error);
    throw createError(500, 'Failed to update user profile');
  }
}));

/**
 * @route   POST /api/auth/notification-token
 * @desc    Register or update FCM token for push notifications
 * @access  Private
 */
router.post('/notification-token', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.uid;
  const { token, deviceType } = req.body;
  
  if (!token) {
    throw createError(400, 'FCM token is required');
  }
  
  if (!deviceType) {
    throw createError(400, 'Device type is required');
  }
  
  try {
    const db = getFirestore();
    
    // Check if token already exists
    const tokenSnapshot = await db.collection('notification_tokens')
      .where('token', '==', token)
      .limit(1)
      .get();
    
    if (!tokenSnapshot.empty) {
      // Update existing token
      const tokenDoc = tokenSnapshot.docs[0];
      await tokenDoc.ref.update({
        userId,
        deviceType,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Create new token
      await db.collection('notification_tokens').add({
        userId,
        token,
        deviceType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    logger.info(`FCM token registered for user ${userId}`);
    res.status(200).json({ success: true });
    
  } catch (error) {
    logger.error(`Error registering FCM token for ${userId}:`, error);
    throw createError(500, 'Failed to register notification token');
  }
}));

/**
 * @route   DELETE /api/auth/notification-token
 * @desc    Remove FCM token when user logs out
 * @access  Private
 */
router.delete('/notification-token', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.uid;
  const { token } = req.body;
  
  if (!token) {
    throw createError(400, 'FCM token is required');
  }
  
  try {
    const db = getFirestore();
    
    // Find and delete the token
    const tokenSnapshot = await db.collection('notification_tokens')
      .where('token', '==', token)
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    if (!tokenSnapshot.empty) {
      await tokenSnapshot.docs[0].ref.delete();
      logger.info(`FCM token removed for user ${userId}`);
    }
    
    res.status(200).json({ success: true });
    
  } catch (error) {
    logger.error(`Error removing FCM token for ${userId}:`, error);
    throw createError(500, 'Failed to remove notification token');
  }
}));

/**
 * @route   POST /api/auth/request-password-reset
 * @desc    Request a password reset email
 * @access  Public
 */
router.post('/request-password-reset', asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    throw createError(400, 'Email is required');
  }
  
  try {
    const auth = getAuth();
    await auth.generatePasswordResetLink(email);
    
    logger.info(`Password reset requested for ${email}`);
    res.status(200).json({ 
      success: true, 
      message: 'Password reset email sent' 
    });
    
  } catch (error) {
    // Don't reveal if email exists or not for security
    logger.error('Error requesting password reset:', error);
    res.status(200).json({ 
      success: true, 
      message: 'If the email exists, a password reset link will be sent' 
    });
  }
}));

module.exports = router;