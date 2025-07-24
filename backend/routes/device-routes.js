/**
 * IntelliGlass - Smart Solar Window System
 * Device Routes
 * 
 * This module defines API routes for device management.
 */

const express = require('express');
const router = express.Router();
const { deviceService } = require('../firebase/firebase-service');
const { asyncHandler, createError } = require('../middleware/error-middleware');
const { resourceOwnerMiddleware } = require('../middleware/auth-middleware');
const logger = require('../utils/logger');

// Middleware to check device ownership
const deviceOwnerMiddleware = resourceOwnerMiddleware('device', 'deviceId');

/**
 * @route   GET /api/devices
 * @desc    Get all devices for the authenticated user
 * @access  Private
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.uid;
  const devices = await deviceService.getUserDevices(userId);
  res.status(200).json(devices);
}));

/**
 * @route   GET /api/devices/:deviceId
 * @desc    Get a single device by ID
 * @access  Private (owner only)
 */
router.get('/:deviceId', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  // The device is already attached to req by the middleware
  res.status(200).json(req.device);
}));

/**
 * @route   POST /api/devices
 * @desc    Register a new device
 * @access  Private
 */
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.uid;
  
  // Validate request body
  const { name, location, deviceType } = req.body;
  
  if (!name) {
    throw createError(400, 'Device name is required');
  }
  
  // Create device data object
  const deviceData = {
    name,
    location: location || 'Unknown',
    deviceType: deviceType || 'window',
    userId,
    status: 'offline',
    latestSensorData: null,
  };
  
  // Create the device
  const newDevice = await deviceService.createDevice(deviceData);
  
  logger.info(`User ${userId} registered new device: ${newDevice.id}`);
  res.status(201).json(newDevice);
}));

/**
 * @route   PUT /api/devices/:deviceId
 * @desc    Update a device
 * @access  Private (owner only)
 */
router.put('/:deviceId', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  
  // Validate request body
  const { name, location } = req.body;
  const updateData = {};
  
  if (name) updateData.name = name;
  if (location) updateData.location = location;
  
  if (Object.keys(updateData).length === 0) {
    throw createError(400, 'No valid update fields provided');
  }
  
  // Update the device
  const updatedDevice = await deviceService.updateDevice(deviceId, updateData);
  
  logger.info(`Device ${deviceId} updated by user ${req.user.uid}`);
  res.status(200).json(updatedDevice);
}));

/**
 * @route   DELETE /api/devices/:deviceId
 * @desc    Delete a device
 * @access  Private (owner only)
 */
router.delete('/:deviceId', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  
  // Delete the device
  await deviceService.deleteDevice(deviceId);
  
  logger.info(`Device ${deviceId} deleted by user ${req.user.uid}`);
  res.status(200).json({ success: true, message: 'Device deleted successfully' });
}));

/**
 * @route   POST /api/devices/:deviceId/command
 * @desc    Send a command to a device
 * @access  Private (owner only)
 */
router.post('/:deviceId/command', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  
  // Validate request body
  const { command, parameters } = req.body;
  
  if (!command) {
    throw createError(400, 'Command is required');
  }
  
  // Validate command type
  const validCommands = ['open_window', 'close_window', 'set_angle', 'toggle_tracking', 'toggle_auto'];
  if (!validCommands.includes(command)) {
    throw createError(400, `Invalid command. Must be one of: ${validCommands.join(', ')}`);
  }
  
  // Validate parameters for specific commands
  if (command === 'set_angle') {
    if (!parameters || typeof parameters.angle !== 'number' || parameters.angle < 0 || parameters.angle > 180) {
      throw createError(400, 'For set_angle command, angle parameter must be a number between 0 and 180');
    }
  }
  
  // In a real implementation, this would send the command to the device via MQTT
  // For now, we'll just log it and return success
  logger.info(`Command sent to device ${deviceId}: ${command}`, { parameters });
  
  // Update device status in database to reflect the command
  // This is a simplified implementation
  let updateData = {};
  
  if (command === 'open_window') {
    updateData.windowState = 'open';
  } else if (command === 'close_window') {
    updateData.windowState = 'closed';
  } else if (command === 'set_angle') {
    updateData.panelAngle = parameters.angle;
  } else if (command === 'toggle_tracking') {
    // Toggle the current tracking state
    updateData.trackingEnabled = !req.device.trackingEnabled;
  } else if (command === 'toggle_auto') {
    // Toggle the current auto mode state
    updateData.autoMode = !req.device.autoMode;
  }
  
  // Update the device with the new state
  await deviceService.updateDevice(deviceId, updateData);
  
  res.status(200).json({
    success: true,
    message: `Command ${command} sent to device successfully`,
    deviceId,
    command,
    parameters,
    timestamp: new Date().toISOString()
  });
}));

module.exports = router;