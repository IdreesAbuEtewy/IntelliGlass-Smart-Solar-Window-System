/**
 * IntelliGlass - Smart Solar Window System
 * Firebase Service
 * 
 * This module provides functions to interact with Firebase services.
 */

const { getFirestore, getAuth, getStorage } = require('./firebase-config');
const logger = require('../utils/logger');

/**
 * Device-related operations
 */
const deviceService = {
  // Get all devices for a user
  async getUserDevices(userId) {
    try {
      const db = getFirestore();
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
      
      return devices;
    } catch (error) {
      logger.error('Error getting user devices:', error);
      throw new Error('Failed to get user devices: ' + error.message);
    }
  },
  
  // Get a single device by ID
  async getDeviceById(deviceId) {
    try {
      const db = getFirestore();
      const deviceDoc = await db.collection('devices').doc(deviceId).get();
      
      if (!deviceDoc.exists) {
        throw new Error('Device not found');
      }
      
      return {
        id: deviceDoc.id,
        ...deviceDoc.data()
      };
    } catch (error) {
      logger.error(`Error getting device ${deviceId}:`, error);
      throw new Error(`Failed to get device ${deviceId}: ${error.message}`);
    }
  },
  
  // Create a new device
  async createDevice(deviceData) {
    try {
      const db = getFirestore();
      const newDeviceRef = await db.collection('devices').add({
        ...deviceData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return {
        id: newDeviceRef.id,
        ...deviceData
      };
    } catch (error) {
      logger.error('Error creating device:', error);
      throw new Error('Failed to create device: ' + error.message);
    }
  },
  
  // Update a device
  async updateDevice(deviceId, deviceData) {
    try {
      const db = getFirestore();
      await db.collection('devices').doc(deviceId).update({
        ...deviceData,
        updatedAt: new Date()
      });
      
      return {
        id: deviceId,
        ...deviceData
      };
    } catch (error) {
      logger.error(`Error updating device ${deviceId}:`, error);
      throw new Error(`Failed to update device ${deviceId}: ${error.message}`);
    }
  },
  
  // Delete a device
  async deleteDevice(deviceId) {
    try {
      const db = getFirestore();
      await db.collection('devices').doc(deviceId).delete();
      return { success: true, message: 'Device deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting device ${deviceId}:`, error);
      throw new Error(`Failed to delete device ${deviceId}: ${error.message}`);
    }
  }
};

/**
 * Sensor data operations
 */
const sensorService = {
  // Store sensor data
  async storeSensorData(deviceId, sensorData) {
    try {
      const db = getFirestore();
      const timestamp = new Date();
      
      // Add to sensor_logs collection
      await db.collection('sensor_logs').add({
        deviceId,
        ...sensorData,
        timestamp
      });
      
      // Update latest sensor data in device document
      await db.collection('devices').doc(deviceId).update({
        latestSensorData: {
          ...sensorData,
          timestamp
        },
        updatedAt: timestamp
      });
      
      return { success: true, message: 'Sensor data stored successfully' };
    } catch (error) {
      logger.error(`Error storing sensor data for device ${deviceId}:`, error);
      throw new Error(`Failed to store sensor data: ${error.message}`);
    }
  },
  
  // Get sensor history for a device
  async getSensorHistory(deviceId, startTime, endTime, limit = 100) {
    try {
      const db = getFirestore();
      let query = db.collection('sensor_logs')
        .where('deviceId', '==', deviceId)
        .orderBy('timestamp', 'desc');
      
      if (startTime) {
        query = query.where('timestamp', '>=', new Date(startTime));
      }
      
      if (endTime) {
        query = query.where('timestamp', '<=', new Date(endTime));
      }
      
      query = query.limit(limit);
      
      const snapshot = await query.get();
      const sensorLogs = [];
      
      snapshot.forEach(doc => {
        sensorLogs.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate() // Convert Firestore timestamp to JS Date
        });
      });
      
      return sensorLogs;
    } catch (error) {
      logger.error(`Error getting sensor history for device ${deviceId}:`, error);
      throw new Error(`Failed to get sensor history: ${error.message}`);
    }
  },
  
  // Get latest sensor data for a device
  async getLatestSensorData(deviceId) {
    try {
      const db = getFirestore();
      const deviceDoc = await db.collection('devices').doc(deviceId).get();
      
      if (!deviceDoc.exists) {
        throw new Error('Device not found');
      }
      
      const deviceData = deviceDoc.data();
      return deviceData.latestSensorData || null;
    } catch (error) {
      logger.error(`Error getting latest sensor data for device ${deviceId}:`, error);
      throw new Error(`Failed to get latest sensor data: ${error.message}`);
    }
  }
};

/**
 * Schedule operations
 */
const scheduleService = {
  // Get all schedules for a device
  async getDeviceSchedules(deviceId) {
    try {
      const db = getFirestore();
      const schedulesSnapshot = await db.collection('schedules')
        .where('deviceId', '==', deviceId)
        .get();
      
      const schedules = [];
      schedulesSnapshot.forEach(doc => {
        schedules.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return schedules;
    } catch (error) {
      logger.error(`Error getting schedules for device ${deviceId}:`, error);
      throw new Error(`Failed to get device schedules: ${error.message}`);
    }
  },
  
  // Create a new schedule
  async createSchedule(scheduleData) {
    try {
      const db = getFirestore();
      const newScheduleRef = await db.collection('schedules').add({
        ...scheduleData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return {
        id: newScheduleRef.id,
        ...scheduleData
      };
    } catch (error) {
      logger.error('Error creating schedule:', error);
      throw new Error(`Failed to create schedule: ${error.message}`);
    }
  },
  
  // Update a schedule
  async updateSchedule(scheduleId, scheduleData) {
    try {
      const db = getFirestore();
      await db.collection('schedules').doc(scheduleId).update({
        ...scheduleData,
        updatedAt: new Date()
      });
      
      return {
        id: scheduleId,
        ...scheduleData
      };
    } catch (error) {
      logger.error(`Error updating schedule ${scheduleId}:`, error);
      throw new Error(`Failed to update schedule: ${error.message}`);
    }
  },
  
  // Delete a schedule
  async deleteSchedule(scheduleId) {
    try {
      const db = getFirestore();
      await db.collection('schedules').doc(scheduleId).delete();
      return { success: true, message: 'Schedule deleted successfully' };
    } catch (error) {
      logger.error(`Error deleting schedule ${scheduleId}:`, error);
      throw new Error(`Failed to delete schedule: ${error.message}`);
    }
  }
};

/**
 * User operations
 */
const userService = {
  // Get user profile
  async getUserProfile(userId) {
    try {
      const db = getFirestore();
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }
      
      return {
        id: userDoc.id,
        ...userDoc.data()
      };
    } catch (error) {
      logger.error(`Error getting user profile ${userId}:`, error);
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  },
  
  // Create or update user profile
  async updateUserProfile(userId, userData) {
    try {
      const db = getFirestore();
      const userRef = db.collection('users').doc(userId);
      
      // Check if user exists
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        // Update existing user
        await userRef.update({
          ...userData,
          updatedAt: new Date()
        });
      } else {
        // Create new user
        await userRef.set({
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      return {
        id: userId,
        ...userData
      };
    } catch (error) {
      logger.error(`Error updating user profile ${userId}:`, error);
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
  }
};

module.exports = {
  deviceService,
  sensorService,
  scheduleService,
  userService
};