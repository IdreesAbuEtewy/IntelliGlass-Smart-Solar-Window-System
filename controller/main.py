# IntelliGlass - Smart Solar Window System
# Main Controller Script for ESP32
# This file orchestrates the entire ESP32 functionality

import time
import gc
from machine import Pin, ADC
import ujson

# Import custom modules
import tracking
import sensors
import actuators
import wifi
import mqtt
import config

# Initialize global variables
system_status = {
    "window_open": False,
    "tracking_enabled": True,
    "panel_angle": 90,  # Default 90 degrees (vertical)
    "light_level": 0,
    "rain_detected": False,
    "smoke_detected": False,
    "last_update": 0,
    "auto_mode": True
}

# Status LED
status_led = Pin(config.STATUS_LED_PIN, Pin.OUT)

# Initialize components
def initialize_system():
    print("Initializing IntelliGlass Smart Solar Window System...")
    
    # Initialize hardware components
    sensors.initialize()
    actuators.initialize()
    
    # Connect to WiFi
    if not wifi.connect():
        print("WiFi connection failed. Running in offline mode.")
        blink_error(3)  # 3 blinks indicates WiFi error
    else:
        print("WiFi connected successfully.")
        
        # Connect to MQTT broker
        if not mqtt.connect():
            print("MQTT connection failed. Running without cloud connectivity.")
            blink_error(2)  # 2 blinks indicates MQTT error
        else:
            print("MQTT connected successfully.")
            mqtt.subscribe_to_commands(command_callback)
    
    # Set initial position
    actuators.set_panel_angle(system_status["panel_angle"])
    
    print("System initialized and ready.")
    status_led.on()  # Solid light indicates system ready

# Main control loop
def main_loop():
    last_mqtt_publish = 0
    last_sensor_check = 0
    
    while True:
        current_time = time.time()
        
        # Check sensors every 2 seconds
        if current_time - last_sensor_check >= 2:
            check_sensors()
            last_sensor_check = current_time
        
        # Run solar tracking if enabled
        if system_status["tracking_enabled"] and system_status["auto_mode"]:
            tracking.update()
        
        # Publish status every 30 seconds
        if current_time - last_mqtt_publish >= 30 and mqtt.is_connected():
            publish_status()
            last_mqtt_publish = current_time
        
        # Process any pending MQTT messages
        if mqtt.is_connected():
            mqtt.check_msg()
        
        # Give some time to other processes and save power
        time.sleep(0.1)
        
        # Run garbage collection to prevent memory issues
        if current_time % 60 == 0:  # Every minute
            gc.collect()

# Check all sensors and respond to conditions
def check_sensors():
    # Read sensor values
    light_values = sensors.read_light_sensors()
    rain_detected = sensors.check_rain()
    smoke_detected = sensors.check_smoke()
    
    # Update system status
    system_status["light_level"] = sum(light_values) / len(light_values)
    system_status["rain_detected"] = rain_detected
    system_status["smoke_detected"] = smoke_detected
    system_status["last_update"] = time.time()
    
    # Safety checks - override if rain or smoke detected
    if rain_detected or smoke_detected:
        emergency_close()

# Emergency close function for safety
def emergency_close():
    print("EMERGENCY: Closing window due to rain or smoke detection")
    system_status["window_open"] = False
    actuators.close_window()
    
    # Notify via MQTT if connected
    if mqtt.is_connected():
        alert_data = {
            "type": "emergency",
            "reason": "rain" if system_status["rain_detected"] else "smoke",
            "timestamp": time.time()
        }
        mqtt.publish(config.MQTT_ALERT_TOPIC, ujson.dumps(alert_data))

# Publish system status via MQTT
def publish_status():
    status_data = {
        "window_open": system_status["window_open"],
        "tracking_enabled": system_status["tracking_enabled"],
        "panel_angle": system_status["panel_angle"],
        "light_level": system_status["light_level"],
        "rain_detected": system_status["rain_detected"],
        "smoke_detected": system_status["smoke_detected"],
        "timestamp": system_status["last_update"],
        "auto_mode": system_status["auto_mode"]
    }
    mqtt.publish(config.MQTT_STATUS_TOPIC, ujson.dumps(status_data))

# Callback for MQTT commands
def command_callback(topic, message):
    try:
        command = ujson.loads(message)
        
        if "action" in command:
            if command["action"] == "open_window" and not (system_status["rain_detected"] or system_status["smoke_detected"]):
                system_status["window_open"] = True
                actuators.open_window()
                
            elif command["action"] == "close_window":
                system_status["window_open"] = False
                actuators.close_window()
                
            elif command["action"] == "set_angle" and "angle" in command:
                angle = max(0, min(180, command["angle"]))  # Constrain between 0-180
                system_status["panel_angle"] = angle
                actuators.set_panel_angle(angle)
                
            elif command["action"] == "toggle_tracking":
                system_status["tracking_enabled"] = not system_status["tracking_enabled"]
                
            elif command["action"] == "toggle_auto":
                system_status["auto_mode"] = not system_status["auto_mode"]
                
            # Publish updated status after command execution
            publish_status()
            
    except Exception as e:
        print("Error processing command:", e)

# Error indicator
def blink_error(count):
    for _ in range(count):
        status_led.on()
        time.sleep(0.2)
        status_led.off()
        time.sleep(0.2)
    time.sleep(0.5)

# Main execution
if __name__ == "__main__":
    try:
        initialize_system()
        main_loop()
    except Exception as e:
        print("Critical error:", e)
        # Continuous blinking indicates system error
        while True:
            status_led.on()
            time.sleep(0.1)
            status_led.off()
            time.sleep(0.1)