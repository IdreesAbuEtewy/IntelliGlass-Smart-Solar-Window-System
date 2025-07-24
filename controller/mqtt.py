# IntelliGlass - Smart Solar Window System
# MQTT Module for ESP32
# This module handles MQTT communication with the backend

import time
from umqtt.simple import MQTTClient
import ujson
import config

# MQTT client
client = None
connected = False
command_callback = None

# Connect to MQTT broker
def connect():
    global client, connected
    
    try:
        # Generate a unique client ID based on config + random number
        client_id = config.MQTT_CLIENT_ID + "_" + str(int(time.time()) % 10000)
        
        # Create MQTT client instance
        client = MQTTClient(
            client_id,
            config.MQTT_BROKER,
            port=config.MQTT_PORT,
            user=config.MQTT_USER,
            password=config.MQTT_PASSWORD,
            keepalive=config.MQTT_KEEPALIVE,
            ssl=config.MQTT_USE_SSL
        )
        
        # Set callback for incoming messages
        client.set_callback(_message_callback)
        
        # Connect to broker
        client.connect()
        
        # Subscribe to command topic
        client.subscribe(config.MQTT_COMMAND_TOPIC)
        
        connected = True
        print("Connected to MQTT broker at {}".format(config.MQTT_BROKER))
        
        # Publish connection status
        publish(config.MQTT_STATUS_TOPIC, ujson.dumps({
            "status": "connected",
            "device_id": config.DEVICE_ID,
            "timestamp": time.time()
        }))
        
        return True
        
    except Exception as e:
        print("MQTT connection failed:", e)
        connected = False
        return False

# Disconnect from MQTT broker
def disconnect():
    global connected
    
    if client and connected:
        try:
            # Publish disconnect message
            publish(config.MQTT_STATUS_TOPIC, ujson.dumps({
                "status": "disconnected",
                "device_id": config.DEVICE_ID,
                "timestamp": time.time()
            }))
            
            client.disconnect()
            connected = False
            print("Disconnected from MQTT broker")
            
        except Exception as e:
            print("Error disconnecting from MQTT:", e)

# Publish message to topic
def publish(topic, message):
    if client and connected:
        try:
            client.publish(topic, message)
            if config.DEBUG_MODE:
                print("Published to {}: {}".format(topic, message))
            return True
        except Exception as e:
            print("MQTT publish error:", e)
            connected = False
            return False
    return False

# Subscribe to a topic
def subscribe(topic):
    if client and connected:
        try:
            client.subscribe(topic)
            print("Subscribed to topic: {}".format(topic))
            return True
        except Exception as e:
            print("MQTT subscribe error:", e)
            connected = False
            return False
    return False

# Set callback for command messages
def subscribe_to_commands(callback):
    global command_callback
    command_callback = callback

# Internal message callback
def _message_callback(topic, msg):
    try:
        topic_str = topic.decode('utf-8')
        msg_str = msg.decode('utf-8')
        
        if config.DEBUG_MODE:
            print("Message received on {}: {}".format(topic_str, msg_str))
        
        # Handle command messages
        if topic_str == config.MQTT_COMMAND_TOPIC and command_callback:
            command_callback(topic_str, msg_str)
            
    except Exception as e:
        print("Error processing MQTT message:", e)

# Check for pending messages
def check_msg():
    if client and connected:
        try:
            client.check_msg()
            return True
        except Exception as e:
            print("Error checking MQTT messages:", e)
            connected = False
            return False
    return False

# Reconnect if connection is lost
def ensure_connection():
    global connected
    
    if not connected:
        print("MQTT connection lost. Attempting to reconnect...")
        return connect()
    return True

# Check if connected to MQTT broker
def is_connected():
    return connected