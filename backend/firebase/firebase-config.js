/**
 * IntelliGlass - Smart Solar Window System
 * Firebase Configuration
 * 
 * This module initializes and configures Firebase for the backend.
 */

const admin = require('firebase-admin');
const logger = require('../utils/logger');

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  try {
    // Check if Firebase is already initialized
    if (admin.apps.length === 0) {
      // In production, use service account credentials from environment variables or secure storage
      // For development, you can use a service account key file
      
      // Option 1: Using environment variables (recommended for production)
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL || "https://intelliGlass-smart-window.firebaseio.com"
        });
      } 
      // Option 2: Using a service account file (development only)
      else {
        try {
          // Attempt to load service account from file
          // WARNING: Do not commit this file to version control
          const serviceAccount = require('./service-account-key.json');
          
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL || "https://intelliGlass-smart-window.firebaseio.com"
          });
        } catch (error) {
          // If service account file is not found, use application default credentials
          logger.warn('Service account file not found, using application default credentials');
          admin.initializeApp({
            // This will use the GOOGLE_APPLICATION_CREDENTIALS environment variable
            // or the default service account if running on Google Cloud Platform
            databaseURL: process.env.FIREBASE_DATABASE_URL || "https://intelliGlass-smart-window.firebaseio.com"
          });
        }
      }
      
      logger.info('Firebase Admin SDK initialized successfully');
    } else {
      logger.info('Firebase Admin SDK already initialized');
    }
    
    return true;
  } catch (error) {
    logger.error('Error initializing Firebase Admin SDK:', error);
    throw new Error('Failed to initialize Firebase: ' + error.message);
  }
};

// Get Firestore database instance
const getFirestore = () => {
  try {
    return admin.firestore();
  } catch (error) {
    logger.error('Error getting Firestore instance:', error);
    throw new Error('Failed to get Firestore instance: ' + error.message);
  }
};

// Get Firebase Authentication instance
const getAuth = () => {
  try {
    return admin.auth();
  } catch (error) {
    logger.error('Error getting Firebase Auth instance:', error);
    throw new Error('Failed to get Firebase Auth instance: ' + error.message);
  }
};

// Get Firebase Storage instance
const getStorage = () => {
  try {
    return admin.storage();
  } catch (error) {
    logger.error('Error getting Firebase Storage instance:', error);
    throw new Error('Failed to get Firebase Storage instance: ' + error.message);
  }
};

// Get Firebase Realtime Database instance
const getDatabase = () => {
  try {
    return admin.database();
  } catch (error) {
    logger.error('Error getting Firebase Realtime Database instance:', error);
    throw new Error('Failed to get Firebase Realtime Database instance: ' + error.message);
  }
};

module.exports = {
  initializeFirebase,
  getFirestore,
  getAuth,
  getStorage,
  getDatabase,
  admin // Export admin for direct access if needed
};