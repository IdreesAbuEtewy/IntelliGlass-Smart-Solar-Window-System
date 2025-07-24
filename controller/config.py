# IntelliGlass - Smart Solar Window System
# Configuration Module for ESP32
# This module contains all configurable parameters for the system

# Device Information
DEVICE_ID = "intelliGlass-001"  # Unique device identifier
DEVICE_NAME = "IntelliGlass Window Controller"  # Human-readable device name
FIRMWARE_VERSION = "1.0.0"  # Firmware version

# Debug Settings
DEBUG_MODE = True  # Enable/disable debug output

# Pin Configuration
# LDR Sensors (Light Dependent Resistors)
LDR1_PIN = 32  # ADC pin for first LDR sensor
LDR2_PIN = 33  # ADC pin for second LDR sensor

# Rain Sensor (YL-83)
RAIN_SENSOR_PIN = 34  # ADC pin for rain sensor

# Smoke Sensor (MQ-2)
SMOKE_SENSOR_PIN = 35  # ADC pin for smoke sensor

# Servo Motor for Panel Angle
SERVO_PIN = 25  # PWM pin for servo control

# Chain Actuator for Window Opening/Closing
CHAIN_MOTOR_PIN1 = 26  # H-bridge control pin 1
CHAIN_MOTOR_PIN2 = 27  # H-bridge control pin 2
CHAIN_MOTOR_ENABLE_PIN = 14  # Optional enable pin for motor driver

# Status LED
STATUS_LED_PIN = 2  # Built-in LED on most ESP32 boards

# Servo Configuration
SERVO_MIN_DUTY = 2.5  # Minimum duty cycle (%) for 0 degrees
SERVO_MAX_DUTY = 12.5  # Maximum duty cycle (%) for 180 degrees
MIN_PANEL_ANGLE = 0  # Minimum panel angle in degrees
MAX_PANEL_ANGLE = 180  # Maximum panel angle in degrees

# Window Operation
WINDOW_OPERATION_TIME = 10  # Time in seconds to fully open/close window

# Tracking Configuration
ANGLE_SCALING_FACTOR = 0.01  # Scaling factor for PI controller output to angle
MIN_LIGHT_THRESHOLD = 200  # Minimum light level for tracking to operate
MAX_INTEGRAL = 100  # Anti-windup limit for integral term

# Sensor Configuration
SENSOR_SMOOTHING = True  # Enable sensor reading smoothing
SENSOR_CHECK_INTERVAL = 2  # Seconds between sensor checks

# WiFi Configuration
WIFI_SSID = "YourWiFiNetwork"  # WiFi network name
WIFI_PASSWORD = "YourWiFiPassword"  # WiFi password
WIFI_TIMEOUT = 20  # Connection timeout in seconds

# MQTT Configuration
MQTT_BROKER = "intelliGlass.cloud.thingspeak.com"  # MQTT broker address
MQTT_PORT = 1883  # MQTT broker port (1883 for non-SSL, 8883 for SSL)
MQTT_CLIENT_ID = "intelliGlass-" + DEVICE_ID  # MQTT client ID
MQTT_USER = "intelliGlass"  # MQTT username
MQTT_PASSWORD = "YourMQTTPassword"  # MQTT password
MQTT_KEEPALIVE = 60  # Keepalive interval in seconds
MQTT_USE_SSL = False  # Use SSL/TLS for MQTT connection

# MQTT Topics
MQTT_BASE_TOPIC = "intelliGlass/" + DEVICE_ID  # Base topic for this device
MQTT_STATUS_TOPIC = MQTT_BASE_TOPIC + "/status"  # Topic for status updates
MQTT_COMMAND_TOPIC = MQTT_BASE_TOPIC + "/commands"  # Topic for receiving commands
MQTT_ALERT_TOPIC = MQTT_BASE_TOPIC + "/alerts"  # Topic for sending alerts

# Power Management
DEEP_SLEEP_ENABLE = False  # Enable deep sleep mode when idle
DEEP_SLEEP_INTERVAL = 300  # Deep sleep interval in seconds

# Over-the-Air Update
OTA_ENABLED = True  # Enable OTA updates
OTA_SERVER = "https://intelliGlass.com/firmware"  # OTA update server
OTA_CHECK_INTERVAL = 86400  # Check for updates every 24 hours

# Function to update configuration from external source (e.g., MQTT, file)
def update_from_dict(config_dict):
    """Update configuration parameters from a dictionary"""
    for key, value in config_dict.items():
        if key in globals() and not key.startswith('_'):
            globals()[key] = value
            print(f"Updated config: {key} = {value}")

# Function to get all configuration as a dictionary
def get_all_config():
    """Return all configuration parameters as a dictionary"""
    config_dict = {}
    for key, value in globals().items():
        # Only include variables that don't start with underscore and are not functions
        if not key.startswith('_') and not callable(value):
            config_dict[key] = value
    return config_dict