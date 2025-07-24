# IntelliGlass - Smart Solar Window System
# Actuators Module for ESP32
# This module controls the servo motor and chain actuator

import time
from machine import Pin, PWM
import config

# Initialize actuator objects
servo_pwm = None
chain_motor_pin1 = None
chain_motor_pin2 = None
chain_motor_enable = None

# Current state tracking
current_panel_angle = 90  # Default 90 degrees (vertical)
window_state = "closed"  # Current window state ("closed", "open", "moving")

# Initialize actuators
def initialize():
    global servo_pwm, chain_motor_pin1, chain_motor_pin2, chain_motor_enable
    
    # Initialize servo for panel angle control
    servo_pin = Pin(config.SERVO_PIN)
    servo_pwm = PWM(servo_pin)
    servo_pwm.freq(50)  # Standard 50Hz for servos
    
    # Initialize H-bridge for chain actuator control
    chain_motor_pin1 = Pin(config.CHAIN_MOTOR_PIN1, Pin.OUT)
    chain_motor_pin2 = Pin(config.CHAIN_MOTOR_PIN2, Pin.OUT)
    
    # Enable pin for the motor driver (optional, set to None if not used)
    if hasattr(config, 'CHAIN_MOTOR_ENABLE_PIN') and config.CHAIN_MOTOR_ENABLE_PIN is not None:
        chain_motor_enable = Pin(config.CHAIN_MOTOR_ENABLE_PIN, Pin.OUT)
        chain_motor_enable.value(0)  # Start with motor disabled
    
    # Ensure motors are stopped initially
    stop_chain_motor()
    
    # Set initial panel position
    set_panel_angle(current_panel_angle)
    
    print("Actuators initialized successfully")

# Convert angle to servo PWM duty cycle
def angle_to_duty(angle):
    # Map angle (0-180) to duty cycle (typically ~2.5% to ~12.5% for 0-180 degrees)
    # For ESP32 PWM, duty is 0-1023
    min_duty = int(config.SERVO_MIN_DUTY * 1023 / 100)
    max_duty = int(config.SERVO_MAX_DUTY * 1023 / 100)
    
    # Linear mapping from angle to duty cycle
    duty = min_duty + (max_duty - min_duty) * angle / 180
    return int(duty)

# Set panel angle using servo
def set_panel_angle(angle):
    global current_panel_angle
    
    # Constrain angle to valid range
    angle = max(config.MIN_PANEL_ANGLE, min(config.MAX_PANEL_ANGLE, angle))
    
    # Calculate duty cycle
    duty = angle_to_duty(angle)
    
    # Apply PWM signal to servo
    servo_pwm.duty(duty)
    
    # Update current angle
    current_panel_angle = angle
    
    if config.DEBUG_MODE:
        print("Panel angle set to {} degrees (PWM duty: {})".format(angle, duty))
    
    # Small delay to allow servo to reach position
    time.sleep(0.1)

# Open window using chain actuator
def open_window():
    global window_state
    
    if window_state == "open":
        print("Window is already open")
        return
    
    print("Opening window...")
    window_state = "moving"
    
    # Enable motor if using enable pin
    if chain_motor_enable is not None:
        chain_motor_enable.value(1)
    
    # Set motor direction to open
    chain_motor_pin1.value(1)
    chain_motor_pin2.value(0)
    
    # Run motor for configured time
    time.sleep(config.WINDOW_OPERATION_TIME)
    
    # Stop motor
    stop_chain_motor()
    
    window_state = "open"
    print("Window opened successfully")

# Close window using chain actuator
def close_window():
    global window_state
    
    if window_state == "closed":
        print("Window is already closed")
        return
    
    print("Closing window...")
    window_state = "moving"
    
    # Enable motor if using enable pin
    if chain_motor_enable is not None:
        chain_motor_enable.value(1)
    
    # Set motor direction to close
    chain_motor_pin1.value(0)
    chain_motor_pin2.value(1)
    
    # Run motor for configured time
    time.sleep(config.WINDOW_OPERATION_TIME)
    
    # Stop motor
    stop_chain_motor()
    
    window_state = "closed"
    print("Window closed successfully")

# Stop chain motor
def stop_chain_motor():
    # Stop motor by setting both control pins low
    chain_motor_pin1.value(0)
    chain_motor_pin2.value(0)
    
    # Disable motor if using enable pin
    if chain_motor_enable is not None:
        chain_motor_enable.value(0)

# Get current actuator status
def get_status():
    return {
        "panel_angle": current_panel_angle,
        "window_state": window_state
    }

# Emergency stop all actuators
def emergency_stop():
    stop_chain_motor()
    print("Emergency stop activated - all actuators stopped")