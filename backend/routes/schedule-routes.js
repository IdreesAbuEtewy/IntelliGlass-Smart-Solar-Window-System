/**
 * IntelliGlass - Smart Solar Window System
 * Schedule Routes
 * 
 * This module defines API routes for user schedule management.
 */

const express = require('express');
const router = express.Router();
const { scheduleService } = require('../firebase/firebase-service');
const { asyncHandler, createError } = require('../middleware/error-middleware');
const { resourceOwnerMiddleware } = require('../middleware/auth-middleware');
const logger = require('../utils/logger');

// Middleware to check device ownership
const deviceOwnerMiddleware = resourceOwnerMiddleware('device', 'deviceId');

// Middleware to check schedule ownership
const scheduleOwnerMiddleware = resourceOwnerMiddleware('schedule', 'scheduleId');

/**
 * @route   GET /api/schedules/:deviceId
 * @desc    Get all schedules for a device
 * @access  Private (owner only)
 */
router.get('/:deviceId', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  
  // Get all schedules for the device
  const schedules = await scheduleService.getDeviceSchedules(deviceId);
  
  res.status(200).json(schedules);
}));

/**
 * @route   POST /api/schedules/:deviceId
 * @desc    Create a new schedule for a device
 * @access  Private (owner only)
 */
router.post('/:deviceId', deviceOwnerMiddleware, asyncHandler(async (req, res) => {
  const deviceId = req.params.deviceId;
  const userId = req.user.uid;
  
  // Validate request body
  const { name, days, startTime, endTime, action, enabled } = req.body;
  
  if (!name) {
    throw createError(400, 'Schedule name is required');
  }
  
  if (!days || !Array.isArray(days) || days.length === 0) {
    throw createError(400, 'Days must be a non-empty array');
  }
  
  if (!startTime) {
    throw createError(400, 'Start time is required');
  }
  
  if (!action) {
    throw createError(400, 'Action is required');
  }
  
  // Validate days of week
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    if (!validDays.includes(day.toLowerCase())) {
      throw createError(400, `Invalid day: ${day}. Must be one of: ${validDays.join(', ')}`);
    }
  }
  
  // Validate time format (HH:MM)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime)) {
    throw createError(400, 'Start time must be in HH:MM format (24-hour)');
  }
  
  if (endTime && !timeRegex.test(endTime)) {
    throw createError(400, 'End time must be in HH:MM format (24-hour)');
  }
  
  // Validate action
  const validActions = ['open_window', 'close_window', 'set_angle', 'toggle_tracking', 'toggle_auto'];
  if (!validActions.includes(action)) {
    throw createError(400, `Invalid action. Must be one of: ${validActions.join(', ')}`);
  }
  
  // Validate parameters for specific actions
  if (action === 'set_angle') {
    if (!req.body.parameters || typeof req.body.parameters.angle !== 'number' || 
        req.body.parameters.angle < 0 || req.body.parameters.angle > 180) {
      throw createError(400, 'For set_angle action, angle parameter must be a number between 0 and 180');
    }
  }
  
  // Create schedule data object
  const scheduleData = {
    name,
    deviceId,
    userId,
    days,
    startTime,
    endTime: endTime || null,
    action,
    parameters: req.body.parameters || {},
    enabled: enabled !== undefined ? enabled : true,
    lastRun: null
  };
  
  // Create the schedule
  const newSchedule = await scheduleService.createSchedule(scheduleData);
  
  logger.info(`New schedule created for device ${deviceId} by user ${userId}`);
  res.status(201).json(newSchedule);
}));

/**
 * @route   PUT /api/schedules/:scheduleId
 * @desc    Update a schedule
 * @access  Private (owner only)
 */
router.put('/:scheduleId', scheduleOwnerMiddleware, asyncHandler(async (req, res) => {
  const scheduleId = req.params.scheduleId;
  
  // Get fields that can be updated
  const { name, days, startTime, endTime, action, parameters, enabled } = req.body;
  const updateData = {};
  
  // Add fields to update data if they exist
  if (name !== undefined) updateData.name = name;
  if (days !== undefined) {
    // Validate days of week
    if (!Array.isArray(days) || days.length === 0) {
      throw createError(400, 'Days must be a non-empty array');
    }
    
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      if (!validDays.includes(day.toLowerCase())) {
        throw createError(400, `Invalid day: ${day}. Must be one of: ${validDays.join(', ')}`);
      }
    }
    
    updateData.days = days;
  }
  
  if (startTime !== undefined) {
    // Validate time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime)) {
      throw createError(400, 'Start time must be in HH:MM format (24-hour)');
    }
    
    updateData.startTime = startTime;
  }
  
  if (endTime !== undefined) {
    if (endTime === null) {
      updateData.endTime = null;
    } else {
      // Validate time format (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(endTime)) {
        throw createError(400, 'End time must be in HH:MM format (24-hour)');
      }
      
      updateData.endTime = endTime;
    }
  }
  
  if (action !== undefined) {
    // Validate action
    const validActions = ['open_window', 'close_window', 'set_angle', 'toggle_tracking', 'toggle_auto'];
    if (!validActions.includes(action)) {
      throw createError(400, `Invalid action. Must be one of: ${validActions.join(', ')}`);
    }
    
    updateData.action = action;
  }
  
  if (parameters !== undefined) {
    // Validate parameters for specific actions
    if (action === 'set_angle' || req.schedule.action === 'set_angle') {
      if (typeof parameters.angle !== 'number' || parameters.angle < 0 || parameters.angle > 180) {
        throw createError(400, 'For set_angle action, angle parameter must be a number between 0 and 180');
      }
    }
    
    updateData.parameters = parameters;
  }
  
  if (enabled !== undefined) {
    updateData.enabled = enabled;
  }
  
  // Check if there's anything to update
  if (Object.keys(updateData).length === 0) {
    throw createError(400, 'No valid update fields provided');
  }
  
  // Update the schedule
  const updatedSchedule = await scheduleService.updateSchedule(scheduleId, updateData);
  
  logger.info(`Schedule ${scheduleId} updated by user ${req.user.uid}`);
  res.status(200).json(updatedSchedule);
}));

/**
 * @route   DELETE /api/schedules/:scheduleId
 * @desc    Delete a schedule
 * @access  Private (owner only)
 */
router.delete('/:scheduleId', scheduleOwnerMiddleware, asyncHandler(async (req, res) => {
  const scheduleId = req.params.scheduleId;
  
  // Delete the schedule
  await scheduleService.deleteSchedule(scheduleId);
  
  logger.info(`Schedule ${scheduleId} deleted by user ${req.user.uid}`);
  res.status(200).json({ success: true, message: 'Schedule deleted successfully' });
}));

module.exports = router;