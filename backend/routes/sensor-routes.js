/**
 * IntelliGlass - Smart Solar Window System
 * Sensor Routes
 * 
 * This module defines API routes for sensor data management.
 */

const express = require('express');
const router = express.Router();
const { sensorService, deviceService } = require('../firebase/firebase-service');
const { asyncHandler, createError } = require('../middleware/error-middleware');
const { resourceOwnerMiddleware } = require('../middleware/auth-middleware');
const logger = require('../utils/logger');

// Middleware to check device ownership
const deviceOwnerMiddleware = resourceOwnerMiddleware('device', 'deviceId');

/**
 * @route   GET /api/sensors/:deviceId/latest
 * @desc    Get latest sensor data for a device
 * @access  Private (owner only)
 */
router.get('/:deviceId/latest', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  
  // Get latest sensor data
  const sensorData = await sensorService.getLatestSensorData(deviceId);
  
  if (!sensorData) {
    return res.status(200).json({ message: 'No sensor data available for this device' });
  }
  
  res.status(200).json(sensorData);
}));

/**
 * @route   GET /api/sensors/:deviceId/history
 * @desc    Get sensor history for a device
 * @access  Private (owner only)
 */
router.get('/:deviceId/history', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  
  // Parse query parameters
  const startTime = req.query.startTime ? new Date(req.query.startTime) : null;
  const endTime = req.query.endTime ? new Date(req.query.endTime) : null;
  const limit = req.query.limit ? parseInt(req.query.limit) : 100;
  
  // Validate limit
  if (isNaN(limit) || limit < 1 || limit > 1000) {
    throw createError(400, 'Limit must be a number between 1 and 1000');
  }
  
  // Validate date range if provided
  if (startTime && endTime && startTime > endTime) {
    throw createError(400, 'Start time must be before end time');
  }
  
  // Get sensor history
  const sensorHistory = await sensorService.getSensorHistory(deviceId, startTime, endTime, limit);
  
  res.status(200).json(sensorHistory);
}));

/**
 * @route   POST /api/sensors/:deviceId
 * @desc    Store sensor data for a device
 * @access  Private (owner only)
 */
router.post('/:deviceId', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  
  // Validate request body
  const { 
    light_level, 
    panel_angle, 
    window_open, 
    rain_detected, 
    smoke_detected,
    temperature,
    humidity
  } = req.body;
  
  // Create sensor data object with required fields
  const sensorData = {};
  
  // Add fields if they exist in the request
  if (light_level !== undefined) sensorData.light_level = light_level;
  if (panel_angle !== undefined) sensorData.panel_angle = panel_angle;
  if (window_open !== undefined) sensorData.window_open = window_open;
  if (rain_detected !== undefined) sensorData.rain_detected = rain_detected;
  if (smoke_detected !== undefined) sensorData.smoke_detected = smoke_detected;
  if (temperature !== undefined) sensorData.temperature = temperature;
  if (humidity !== undefined) sensorData.humidity = humidity;
  
  // Check if at least one sensor value is provided
  if (Object.keys(sensorData).length === 0) {
    throw createError(400, 'At least one sensor value must be provided');
  }
  
  // Store sensor data
  await sensorService.storeSensorData(deviceId, sensorData);
  
  logger.info(`Sensor data stored for device ${deviceId}`);
  res.status(201).json({ 
    success: true, 
    message: 'Sensor data stored successfully',
    deviceId,
    timestamp: new Date().toISOString()
  });
}));

/**
 * @route   GET /api/sensors/:deviceId/stats
 * @desc    Get sensor statistics for a device
 * @access  Private (owner only)
 */
router.get('/:deviceId/stats', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  
  // Parse query parameters
  const startTime = req.query.startTime ? new Date(req.query.startTime) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to last 7 days
  const endTime = req.query.endTime ? new Date(req.query.endTime) : new Date();
  
  // Validate date range
  if (startTime > endTime) {
    throw createError(400, 'Start time must be before end time');
  }
  
  // Get sensor history for the period
  const sensorHistory = await sensorService.getSensorHistory(deviceId, startTime, endTime, 1000);
  
  // Calculate statistics
  const stats = calculateSensorStats(sensorHistory);
  
  res.status(200).json({
    deviceId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    sampleCount: sensorHistory.length,
    stats
  });
}));

/**
 * Helper function to calculate sensor statistics
 */
function calculateSensorStats(sensorData) {
  if (!sensorData || sensorData.length === 0) {
    return {
      message: 'No sensor data available for statistics'
    };
  }
  
  // Initialize stats object
  const stats = {};
  
  // Get all numeric sensor fields from the first record
  const numericFields = [];
  const firstRecord = sensorData[0];
  
  for (const key in firstRecord) {
    if (typeof firstRecord[key] === 'number') {
      numericFields.push(key);
    }
  }
  
  // Calculate statistics for each numeric field
  numericFields.forEach(field => {
    // Filter out records that don't have this field
    const validRecords = sensorData.filter(record => typeof record[field] === 'number');
    
    if (validRecords.length === 0) return;
    
    // Extract values
    const values = validRecords.map(record => record[field]);
    
    // Calculate statistics
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    
    // Calculate standard deviation
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    const stdDev = Math.sqrt(avgSquaredDiff);
    
    // Store statistics
    stats[field] = {
      min,
      max,
      avg,
      stdDev,
      count: values.length
    };
  });
  
  // Calculate boolean field statistics
  const booleanFields = ['window_open', 'rain_detected', 'smoke_detected'];
  
  booleanFields.forEach(field => {
    // Filter out records that don't have this field
    const validRecords = sensorData.filter(record => typeof record[field] === 'boolean');
    
    if (validRecords.length === 0) return;
    
    // Count true values
    const trueCount = validRecords.filter(record => record[field] === true).length;
    
    // Store statistics
    stats[field] = {
      trueCount,
      falseCount: validRecords.length - trueCount,
      truePercentage: (trueCount / validRecords.length) * 100,
      count: validRecords.length
    };
  });
  
  return stats;
}

module.exports = router;