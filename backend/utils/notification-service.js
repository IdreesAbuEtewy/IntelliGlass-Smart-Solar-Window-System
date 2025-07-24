/**
 * IntelliGlass - Smart Solar Window System
 * Notification Service
 * 
 * This module provides functions for sending push notifications to users
 * via Firebase Cloud Messaging (FCM).
 */

const { getFirestore, getMessaging } = require('../firebase/firebase-config');
const logger = require('./logger');

/**
 * Send a notification to a specific user
 * 
 * @param {string} userId - The user ID to send notification to
 * @param {object} notification - The notification object
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {object} [notification.data] - Optional data payload
 * @param {string} [notification.imageUrl] - Optional image URL
 * @returns {Promise<object>} - Result of the notification send operation
 */
async function sendUserNotification(userId, notification) {
  try {
    // Validate notification object
    if (!notification || !notification.title || !notification.body) {
      throw new Error('Invalid notification: title and body are required');
    }
    
    // Get user's FCM tokens from Firestore
    const db = getFirestore();
    const tokensSnapshot = await db.collection('notification_tokens')
      .where('userId', '==', userId)
      .get();
    
    if (tokensSnapshot.empty) {
      logger.info(`No notification tokens found for user ${userId}`);
      return { success: false, message: 'No notification tokens found' };
    }
    
    // Extract tokens
    const tokens = [];
    tokensSnapshot.forEach(doc => {
      tokens.push(doc.data().token);
    });
    
    // Prepare notification message
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens: tokens,
    };
    
    // Add image if provided
    if (notification.imageUrl) {
      message.notification.imageUrl = notification.imageUrl;
    }
    
    // Send the notification
    const messaging = getMessaging();
    const response = await messaging.sendMulticast(message);
    
    logger.info(`Notification sent to user ${userId}: ${response.successCount} successful, ${response.failureCount} failed`);
    
    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      
      // Remove failed tokens
      await removeFailedTokens(failedTokens);
    }
    
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
    
  } catch (error) {
    logger.error(`Error sending notification to user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a notification to all users with a specific device
 * 
 * @param {string} deviceId - The device ID related to the notification
 * @param {object} notification - The notification object
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {object} [notification.data] - Optional data payload
 * @param {string} [notification.imageUrl] - Optional image URL
 * @returns {Promise<object>} - Result of the notification send operation
 */
async function sendDeviceNotification(deviceId, notification) {
  try {
    // Get device info to find the owner
    const db = getFirestore();
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    
    if (!deviceDoc.exists) {
      logger.error(`Device ${deviceId} not found for notification`);
      return { success: false, message: 'Device not found' };
    }
    
    const deviceData = deviceDoc.data();
    const userId = deviceData.userId;
    
    // Add device info to notification data
    const notificationWithDeviceInfo = {
      ...notification,
      data: {
        ...(notification.data || {}),
        deviceId,
        deviceName: deviceData.name || 'IntelliGlass Device'
      }
    };
    
    // Send notification to the device owner
    return await sendUserNotification(userId, notificationWithDeviceInfo);
    
  } catch (error) {
    logger.error(`Error sending device notification for ${deviceId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a notification to all users with admin role
 * 
 * @param {object} notification - The notification object
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {object} [notification.data] - Optional data payload
 * @param {string} [notification.imageUrl] - Optional image URL
 * @returns {Promise<object>} - Result of the notification send operation
 */
async function sendAdminNotification(notification) {
  try {
    // Get all admin users
    const db = getFirestore();
    const adminsSnapshot = await db.collection('user_profiles')
      .where('role', '==', 'admin')
      .get();
    
    if (adminsSnapshot.empty) {
      logger.info('No admin users found for notification');
      return { success: false, message: 'No admin users found' };
    }
    
    // Send notification to each admin
    const results = [];
    const promises = [];
    
    adminsSnapshot.forEach(doc => {
      const adminId = doc.id;
      promises.push(
        sendUserNotification(adminId, notification)
          .then(result => {
            results.push({ adminId, ...result });
            return result;
          })
      );
    });
    
    await Promise.all(promises);
    
    // Count successful notifications
    const successCount = results.reduce((count, result) => {
      return count + (result.success ? result.successCount || 0 : 0);
    }, 0);
    
    return {
      success: successCount > 0,
      totalAdmins: adminsSnapshot.size,
      successCount
    };
    
  } catch (error) {
    logger.error('Error sending admin notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a safety alert notification for a device
 * 
 * @param {string} deviceId - The device ID
 * @param {string} alertType - Type of alert ('rain', 'smoke', etc.)
 * @param {object} sensorData - The sensor data that triggered the alert
 * @returns {Promise<object>} - Result of the notification send operation
 */
async function sendSafetyAlert(deviceId, alertType, sensorData) {
  try {
    // Get device info
    const db = getFirestore();
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    
    if (!deviceDoc.exists) {
      logger.error(`Device ${deviceId} not found for safety alert`);
      return { success: false, message: 'Device not found' };
    }
    
    const deviceData = deviceDoc.data();
    const deviceName = deviceData.name || 'IntelliGlass Device';
    
    // Prepare notification based on alert type
    let notification = {
      data: {
        type: 'safety_alert',
        alertType,
        deviceId,
        timestamp: new Date().toISOString()
      }
    };
    
    switch (alertType) {
      case 'rain':
        notification.title = '⚠️ Rain Alert';
        notification.body = `Rain detected at ${deviceName}. Window has been automatically closed.`;
        break;
      case 'smoke':
        notification.title = '🔥 Smoke Alert';
        notification.body = `Smoke detected at ${deviceName}. Window has been automatically closed.`;
        break;
      case 'system_failure':
        notification.title = '⚠️ System Alert';
        notification.body = `System failure detected at ${deviceName}. Please check the device.`;
        break;
      default:
        notification.title = '⚠️ Safety Alert';
        notification.body = `Safety issue detected at ${deviceName}. Window has been automatically closed.`;
    }
    
    // Add sensor data to notification data
    notification.data.sensorData = JSON.stringify(sensorData);
    
    // Send notification to device owner
    return await sendDeviceNotification(deviceId, notification);
    
  } catch (error) {
    logger.error(`Error sending safety alert for device ${deviceId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove failed or invalid FCM tokens from the database
 * 
 * @param {string[]} tokens - Array of FCM tokens to remove
 * @returns {Promise<void>}
 */
async function removeFailedTokens(tokens) {
  if (!tokens || tokens.length === 0) {
    return;
  }
  
  try {
    const db = getFirestore();
    const batch = db.batch();
    let batchCount = 0;
    
    // Find and delete each token
    for (const token of tokens) {
      const tokenSnapshot = await db.collection('notification_tokens')
        .where('token', '==', token)
        .limit(1)
        .get();
      
      if (!tokenSnapshot.empty) {
        batch.delete(tokenSnapshot.docs[0].ref);
        batchCount++;
      }
      
      // Commit batch if it reaches 500 operations (Firestore limit)
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }
    
    // Commit any remaining operations
    if (batchCount > 0) {
      await batch.commit();
    }
    
    logger.info(`Removed ${tokens.length} invalid FCM tokens`);
    
  } catch (error) {
    logger.error('Error removing invalid FCM tokens:', error);
  }
}

module.exports = {
  sendUserNotification,
  sendDeviceNotification,
  sendAdminNotification,
  sendSafetyAlert
};