/**
 * IntelliGlass - Smart Solar Window System
 * Machine Learning Routes
 * 
 * This module defines API routes for ML predictions and model management.
 */

const express = require('express');
const router = express.Router();
const { asyncHandler, createError } = require('../middleware/error-middleware');
const { resourceOwnerMiddleware } = require('../middleware/auth-middleware');
const logger = require('../utils/logger');
const axios = require('axios');
const path = require('path');

// Middleware to check device ownership
const deviceOwnerMiddleware = resourceOwnerMiddleware('device', 'deviceId');

// Configuration for ML service
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

/**
 * @route   POST /api/ml/:deviceId/predict
 * @desc    Get ML predictions for a device
 * @access  Private (owner only)
 */
router.post('/:deviceId/predict', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  
  // Validate request body
  const { date, weatherData } = req.body;
  
  if (!date) {
    throw createError(400, 'Date is required for prediction');
  }
  
  try {
    // Get device data and sensor history
    const { getFirestore } = require('../firebase/firebase-config');
    const db = getFirestore();
    
    // Get device data
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      throw createError(404, 'Device not found');
    }
    
    const deviceData = deviceDoc.data();
    
    // Get sensor history for the device (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sensorLogsSnapshot = await db.collection('sensor_logs')
      .where('deviceId', '==', deviceId)
      .where('timestamp', '>=', thirtyDaysAgo)
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();
    
    const sensorLogs = [];
    sensorLogsSnapshot.forEach(doc => {
      sensorLogs.push({
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      });
    });
    
    // Get user schedules
    const schedulesSnapshot = await db.collection('schedules')
      .where('deviceId', '==', deviceId)
      .get();
    
    const schedules = [];
    schedulesSnapshot.forEach(doc => {
      schedules.push({
        ...doc.data(),
        id: doc.id
      });
    });
    
    // Prepare data for ML prediction
    const predictionData = {
      deviceId,
      deviceType: deviceData.deviceType,
      location: deviceData.location,
      date,
      weatherData: weatherData || {},
      sensorHistory: sensorLogs,
      userSchedules: schedules
    };
    
    // Call ML service for prediction
    let predictionResult;
    
    try {
      // Try to call external ML service
      const response = await axios.post(`${ML_SERVICE_URL}/predict`, predictionData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000 // 10 second timeout
      });
      
      predictionResult = response.data;
    } catch (mlError) {
      logger.error('Error calling ML service:', mlError);
      
      // Fallback to local prediction if ML service is unavailable
      predictionResult = generateFallbackPrediction(predictionData);
    }
    
    // Return prediction result
    res.status(200).json({
      deviceId,
      date,
      predictions: predictionResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Error generating prediction for device ${deviceId}:`, error);
    throw createError(500, 'Failed to generate prediction: ' + error.message);
  }
}));

/**
 * @route   GET /api/ml/:deviceId/recommendations
 * @desc    Get usage recommendations for a device
 * @access  Private (owner only)
 */
router.get('/:deviceId/recommendations', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  
  try {
    // Get device data and sensor history
    const { getFirestore } = require('../firebase/firebase-config');
    const db = getFirestore();
    
    // Get device data
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      throw createError(404, 'Device not found');
    }
    
    // Get sensor history for the device (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const sensorLogsSnapshot = await db.collection('sensor_logs')
      .where('deviceId', '==', deviceId)
      .where('timestamp', '>=', sevenDaysAgo)
      .orderBy('timestamp', 'desc')
      .limit(500)
      .get();
    
    const sensorLogs = [];
    sensorLogsSnapshot.forEach(doc => {
      sensorLogs.push({
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      });
    });
    
    // Generate recommendations based on sensor data
    const recommendations = generateRecommendations(sensorLogs);
    
    res.status(200).json({
      deviceId,
      recommendations,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Error generating recommendations for device ${deviceId}:`, error);
    throw createError(500, 'Failed to generate recommendations: ' + error.message);
  }
}));

/**
 * @route   POST /api/ml/:deviceId/feedback
 * @desc    Submit feedback on predictions for model improvement
 * @access  Private (owner only)
 */
router.post('/:deviceId/feedback', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  const userId = req.user.uid;
  
  // Validate request body
  const { predictionId, actualBehavior, rating, comments } = req.body;
  
  if (!predictionId) {
    throw createError(400, 'Prediction ID is required');
  }
  
  if (!actualBehavior) {
    throw createError(400, 'Actual behavior is required');
  }
  
  if (rating === undefined || rating < 1 || rating > 5) {
    throw createError(400, 'Rating must be a number between 1 and 5');
  }
  
  try {
    // Store feedback in Firestore
    const { getFirestore } = require('../firebase/firebase-config');
    const db = getFirestore();
    
    await db.collection('ml_feedback').add({
      deviceId,
      userId,
      predictionId,
      actualBehavior,
      rating,
      comments: comments || '',
      timestamp: new Date()
    });
    
    logger.info(`ML feedback submitted for device ${deviceId} by user ${userId}`);
    res.status(201).json({ 
      success: true, 
      message: 'Feedback submitted successfully' 
    });
    
  } catch (error) {
    logger.error(`Error submitting ML feedback for device ${deviceId}:`, error);
    throw createError(500, 'Failed to submit feedback: ' + error.message);
  }
}));

/**
 * Generate fallback prediction when ML service is unavailable
 * This is a simple rule-based prediction as a backup
 */
function generateFallbackPrediction(data) {
  const { date, weatherData, userSchedules } = data;
  
  // Parse the requested date
  const predictionDate = new Date(date);
  const dayOfWeek = predictionDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  // Default predictions
  const predictions = {
    window_operations: [],
    panel_angles: [],
    energy_production_estimate: 0,
    confidence: 'low',
    method: 'fallback'
  };
  
  // Check if we have any schedules for this day
  const daySchedules = userSchedules.filter(schedule => {
    return schedule.days.includes(dayNames[dayOfWeek]) && schedule.enabled;
  });
  
  // Add scheduled operations
  daySchedules.forEach(schedule => {
    if (schedule.action === 'open_window' || schedule.action === 'close_window') {
      predictions.window_operations.push({
        time: schedule.startTime,
        action: schedule.action,
        reason: 'user_schedule'
      });
    } else if (schedule.action === 'set_angle' && schedule.parameters && schedule.parameters.angle !== undefined) {
      predictions.panel_angles.push({
        time: schedule.startTime,
        angle: schedule.parameters.angle,
        reason: 'user_schedule'
      });
    }
  });
  
  // Add weather-based predictions if weather data is available
  if (weatherData && weatherData.hourly) {
    weatherData.hourly.forEach(hour => {
      // If it's going to rain, close the window
      if (hour.precipitation_probability > 50) {
        predictions.window_operations.push({
          time: hour.time,
          action: 'close_window',
          reason: 'rain_forecast'
        });
      }
      
      // If it's very sunny, adjust panel angle
      if (hour.uv_index > 5) {
        // Simple angle calculation based on time of day
        const hourTime = new Date(hour.time);
        const hourOfDay = hourTime.getHours();
        
        // Morning: face east, noon: face up, evening: face west
        let angle;
        if (hourOfDay < 10) {
          angle = 45; // Morning - face more east
        } else if (hourOfDay > 16) {
          angle = 135; // Evening - face more west
        } else {
          angle = 90; // Midday - face up
        }
        
        predictions.panel_angles.push({
          time: hour.time,
          angle: angle,
          reason: 'sun_position'
        });
      }
    });
  } else {
    // No weather data, add some generic predictions
    predictions.window_operations.push(
      { time: '08:00', action: 'open_window', reason: 'daily_routine' },
      { time: '19:00', action: 'close_window', reason: 'daily_routine' }
    );
    
    predictions.panel_angles.push(
      { time: '08:00', angle: 45, reason: 'sun_position' },
      { time: '12:00', angle: 90, reason: 'sun_position' },
      { time: '16:00', angle: 135, reason: 'sun_position' }
    );
  }
  
  // Estimate energy production (very simplified)
  predictions.energy_production_estimate = weatherData && weatherData.daily && weatherData.daily.uv_index_max
    ? weatherData.daily.uv_index_max * 0.5 // kWh, very rough estimate
    : 2.5; // Default estimate
  
  return predictions;
}

/**
 * Generate usage recommendations based on sensor history
 */
function generateRecommendations(sensorLogs) {
  if (!sensorLogs || sensorLogs.length === 0) {
    return [
      {
        type: 'info',
        message: 'Not enough data to generate recommendations. Please continue using the system.'
      }
    ];
  }
  
  const recommendations = [];
  
  // Check if window is frequently opened and closed
  const windowStateChanges = countWindowStateChanges(sensorLogs);
  if (windowStateChanges > 10) {
    recommendations.push({
      type: 'efficiency',
      message: 'Your window is being opened and closed frequently. Consider setting up an automated schedule.'
    });
  }
  
  // Check if panel angle is rarely adjusted
  const panelAngleChanges = countPanelAngleChanges(sensorLogs);
  if (panelAngleChanges < 3 && sensorLogs.length > 50) {
    recommendations.push({
      type: 'energy',
      message: 'Your panel angle is rarely adjusted. Enable automatic tracking to maximize solar energy capture.'
    });
  }
  
  // Check for rain or smoke events
  const safetyEvents = countSafetyEvents(sensorLogs);
  if (safetyEvents > 0) {
    recommendations.push({
      type: 'safety',
      message: `${safetyEvents} safety events detected. The system automatically closed the window for protection.`
    });
  }
  
  // Add general recommendations if we don't have specific ones
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'general',
      message: 'Your system is operating efficiently. Continue monitoring for optimal performance.'
    });
  }
  
  return recommendations;
}

/**
 * Count window state changes in sensor logs
 */
function countWindowStateChanges(sensorLogs) {
  let changes = 0;
  let lastState = null;
  
  sensorLogs.forEach(log => {
    if (log.window_open !== undefined && log.window_open !== lastState) {
      if (lastState !== null) {
        changes++;
      }
      lastState = log.window_open;
    }
  });
  
  return changes;
}

/**
 * Count significant panel angle changes in sensor logs
 * Only counts changes greater than 10 degrees
 */
function countPanelAngleChanges(sensorLogs) {
  let changes = 0;
  let lastAngle = null;
  
  sensorLogs.forEach(log => {
    if (log.panel_angle !== undefined) {
      if (lastAngle !== null && Math.abs(log.panel_angle - lastAngle) > 10) {
        changes++;
      }
      lastAngle = log.panel_angle;
    }
  });
  
  return changes;
}

/**
 * Count safety events (rain or smoke detection) in sensor logs
 */
function countSafetyEvents(sensorLogs) {
  let events = 0;
  
  sensorLogs.forEach(log => {
    if ((log.rain_detected && log.rain_detected === true) || 
        (log.smoke_detected && log.smoke_detected === true)) {
      events++;
    }
  });
  
  return events;
}

module.exports = router;