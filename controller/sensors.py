# IntelliGlass - Smart Solar Window System
# Sensors Module for ESP32
# This module handles all sensor readings (LDR, rain, smoke)

import time
from machine import Pin, ADC
import config

# Initialize sensor pins
ldr1 = None
ldr2 = None
rain_sensor = None
smoke_sensor = None

# Sensor calibration values
ldr_calibration = [1.0, 1.0]  # Multipliers to balance LDR sensors
rain_threshold = 1000  # ADC value threshold for rain detection
smoke_threshold = 1200  # ADC value threshold for smoke detection

# Initialize all sensors
def initialize():
    global ldr1, ldr2, rain_sensor, smoke_sensor
    
    # Initialize LDR sensors (Light Dependent Resistors)
    ldr1 = ADC(Pin(config.LDR1_PIN))
    ldr2 = ADC(Pin(config.LDR2_PIN))
    
    # Configure ADC for LDRs (0-3.3V range)
    ldr1.atten(ADC.ATTN_11DB)
    ldr2.atten(ADC.ATTN_11DB)
    
    # Initialize rain sensor (YL-83)
    rain_sensor = ADC(Pin(config.RAIN_SENSOR_PIN))
    rain_sensor.atten(ADC.ATTN_11DB)
    
    # Initialize smoke sensor (MQ-2)
    smoke_sensor = ADC(Pin(config.SMOKE_SENSOR_PIN))
    smoke_sensor.atten(ADC.ATTN_11DB)
    
    print("All sensors initialized successfully")
    
    # Perform initial calibration
    calibrate_ldr_sensors()

# Read light sensor values
def read_light_sensors():
    # Read raw values
    ldr1_value = ldr1.read()
    ldr2_value = ldr2.read()
    
    # Apply calibration
    ldr1_calibrated = ldr1_value * ldr_calibration[0]
    ldr2_calibrated = ldr2_value * ldr_calibration[1]
    
    # Apply smoothing if configured
    if hasattr(config, 'SENSOR_SMOOTHING') and config.SENSOR_SMOOTHING:
        # Simple exponential smoothing could be implemented here
        pass
    
    if config.DEBUG_MODE:
        print("LDR readings - LDR1: {} (raw: {}), LDR2: {} (raw: {})".format(
            ldr1_calibrated, ldr1_value, ldr2_calibrated, ldr2_value))
    
    return [ldr1_calibrated, ldr2_calibrated]

# Check rain sensor
def check_rain():
    # Read analog value from rain sensor
    # Lower value indicates rain detected (water creates conductivity)
    value = rain_sensor.read()
    
    # Compare with threshold
    rain_detected = value < rain_threshold
    
    if rain_detected and config.DEBUG_MODE:
        print("Rain detected! Sensor value: {}".format(value))
    
    return rain_detected

# Check smoke sensor
def check_smoke():
    # Read analog value from MQ-2 sensor
    # Higher value indicates smoke/gas detected
    value = smoke_sensor.read()
    
    # Compare with threshold
    smoke_detected = value > smoke_threshold
    
    if smoke_detected and config.DEBUG_MODE:
        print("Smoke/Gas detected! Sensor value: {}".format(value))
    
    return smoke_detected

# Calibrate LDR sensors to balance their readings
def calibrate_ldr_sensors():
    global ldr_calibration
    
    print("Calibrating LDR sensors...")
    
    # Take multiple readings and average them
    samples = 10
    ldr1_sum = 0
    ldr2_sum = 0
    
    for _ in range(samples):
        ldr1_sum += ldr1.read()
        ldr2_sum += ldr2.read()
        time.sleep(0.1)
    
    ldr1_avg = ldr1_sum / samples
    ldr2_avg = ldr2_sum / samples
    
    # If both readings are very low, skip calibration (might be dark)
    if ldr1_avg < 100 and ldr2_avg < 100:
        print("Light level too low for calibration. Using default values.")
        return
    
    # Calculate calibration factors
    # We'll normalize to the higher value
    if ldr1_avg >= ldr2_avg and ldr1_avg > 0:
        ldr_calibration = [1.0, ldr1_avg / ldr2_avg]
    elif ldr2_avg > 0:
        ldr_calibration = [ldr2_avg / ldr1_avg, 1.0]
    
    print("LDR calibration complete. Factors: {}".format(ldr_calibration))

# Set custom thresholds
def set_rain_threshold(value):
    global rain_threshold
    rain_threshold = value
    print("Rain threshold set to {}".format(rain_threshold))

def set_smoke_threshold(value):
    global smoke_threshold
    smoke_threshold = value
    print("Smoke threshold set to {}".format(smoke_threshold))

# Get all sensor readings at once
def get_all_readings():
    light_values = read_light_sensors()
    rain = check_rain()
    smoke = check_smoke()
    
    return {
        "ldr1": light_values[0],
        "ldr2": light_values[1],
        "rain_detected": rain,
        "smoke_detected": smoke,
        "timestamp": time.time()
    }