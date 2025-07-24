# IntelliGlass - Smart Solar Window System
# Solar Tracking Module for ESP32
# This module handles solar tracking using LDR sensors and PI control

import time
from machine import Pin, ADC
import math

# Import project modules
import sensors
import actuators
import config

# PI Controller parameters
P_GAIN = 240  # Proportional gain
I_GAIN = 180  # Integral gain

# Tracking variables
last_error = 0
integral_error = 0
last_update_time = 0
target_angle = 90  # Default angle (vertical)

# Initialize tracking system
def initialize():
    global last_update_time
    last_update_time = time.time()
    print("Solar tracking system initialized with P={}, I={}".format(P_GAIN, I_GAIN))

# Main tracking update function
def update():
    global last_error, integral_error, last_update_time, target_angle
    
    # Get current light sensor readings
    ldr_values = sensors.read_light_sensors()
    
    # Skip tracking if light levels are too low (night time or very cloudy)
    if max(ldr_values) < config.MIN_LIGHT_THRESHOLD:
        print("Light level too low for tracking: {}".format(max(ldr_values)))
        return
    
    # Calculate error (difference between LDR sensors)
    # For perfect alignment, LDR1 - LDR2 should be 0
    error = ldr_values[0] - ldr_values[1]
    
    # Calculate time delta for integral component
    current_time = time.time()
    dt = current_time - last_update_time
    last_update_time = current_time
    
    # Prevent division by zero or very small dt
    if dt < 0.01:
        dt = 0.01
    
    # Update integral error with anti-windup
    integral_error += error * dt
    
    # Apply anti-windup to integral term (limit accumulation)
    integral_error = max(-config.MAX_INTEGRAL, min(config.MAX_INTEGRAL, integral_error))
    
    # Calculate PI control output
    p_term = P_GAIN * error
    i_term = I_GAIN * integral_error
    control_output = p_term + i_term
    
    # Scale control output to angle adjustment
    # The scaling factor determines how sensitive the system is to light changes
    angle_adjustment = control_output * config.ANGLE_SCALING_FACTOR
    
    # Update target angle
    target_angle += angle_adjustment
    
    # Constrain angle to valid range (0-180 degrees)
    target_angle = max(config.MIN_PANEL_ANGLE, min(config.MAX_PANEL_ANGLE, target_angle))
    
    # Apply the new angle to the servo
    actuators.set_panel_angle(target_angle)
    
    # Debug output
    if config.DEBUG_MODE:
        print("Tracking update: LDR1={}, LDR2={}, Error={}, P={}, I={}, Angle={}".format(
            ldr_values[0], ldr_values[1], error, p_term, i_term, target_angle))

# Reset tracking to default position
def reset():
    global target_angle, integral_error, last_error
    target_angle = 90  # Default to vertical position
    integral_error = 0
    last_error = 0
    actuators.set_panel_angle(target_angle)
    print("Tracking system reset to default position")

# Set tracking to specific angle (manual override)
def set_angle(angle):
    global target_angle, integral_error
    target_angle = max(config.MIN_PANEL_ANGLE, min(config.MAX_PANEL_ANGLE, angle))
    integral_error = 0  # Reset integral error when manually setting angle
    actuators.set_panel_angle(target_angle)
    print("Tracking angle manually set to {}".format(target_angle))

# Get current tracking status
def get_status():
    return {
        "target_angle": target_angle,
        "p_gain": P_GAIN,
        "i_gain": I_GAIN,
        "integral_error": integral_error,
        "last_error": last_error
    }

# Calculate optimal angle based on time of day (fallback method)
def calculate_time_based_angle():
    # This is a simplified calculation that estimates sun position based on time
    # In a real implementation, you would use more accurate solar position algorithms
    # and take into account location (latitude/longitude)
    
    hour = time.localtime()[3] + time.localtime()[4] / 60.0  # Current hour + minutes/60
    
    # Simple sinusoidal approximation of sun path (very simplified)
    # Assumes sunrise at 6AM (hour 6) and sunset at 6PM (hour 18)
    if hour < 6 or hour > 18:
        return 90  # Default vertical position at night
    
    # Map hour to angle: 6AM->0°, 12PM->90°, 6PM->180°
    angle = (hour - 6) * 15  # 12 hours of daylight mapped to 180 degrees
    return max(config.MIN_PANEL_ANGLE, min(config.MAX_PANEL_ANGLE, angle))