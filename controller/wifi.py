# IntelliGlass - Smart Solar Window System
# WiFi Module for ESP32
# This module handles WiFi connectivity

import time
import network
import config

# WiFi objects
wlan = None
connected = False

# Initialize and connect to WiFi
def connect():
    global wlan, connected
    
    # Initialize WiFi in station mode
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    # Check if already connected
    if wlan.isconnected():
        print("Already connected to WiFi")
        connected = True
        return True
    
    # Connect to the configured access point
    print("Connecting to WiFi network: {}".format(config.WIFI_SSID))
    wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
    
    # Wait for connection with timeout
    max_wait = config.WIFI_TIMEOUT
    while max_wait > 0:
        if wlan.isconnected():
            break
        max_wait -= 1
        print("Waiting for connection...")
        time.sleep(1)
    
    # Check if connected
    if wlan.isconnected():
        network_info = wlan.ifconfig()
        print("WiFi connected!")
        print("IP address: {}".format(network_info[0]))
        connected = True
        return True
    else:
        print("WiFi connection failed")
        connected = False
        return False

# Disconnect from WiFi
def disconnect():
    global connected
    
    if wlan and wlan.isconnected():
        wlan.disconnect()
        wlan.active(False)
        connected = False
        print("WiFi disconnected")

# Check connection status
def is_connected():
    if wlan:
        return wlan.isconnected()
    return False

# Reconnect if connection is lost
def ensure_connection():
    if not is_connected():
        print("WiFi connection lost. Attempting to reconnect...")
        return connect()
    return True

# Get WiFi signal strength
def get_signal_strength():
    if wlan and wlan.isconnected():
        # RSSI (Received Signal Strength Indicator)
        return wlan.status('rssi')
    return None

# Get network information
def get_network_info():
    if wlan and wlan.isconnected():
        ip, subnet, gateway, dns = wlan.ifconfig()
        return {
            "ip": ip,
            "subnet": subnet,
            "gateway": gateway,
            "dns": dns,
            "ssid": config.WIFI_SSID,
            "rssi": get_signal_strength()
        }
    return None

# Scan for available networks
def scan_networks():
    if wlan:
        wlan.active(True)
        networks = wlan.scan()
        result = []
        
        for ssid, bssid, channel, rssi, authmode, hidden in networks:
            result.append({
                "ssid": ssid.decode('utf-8'),
                "channel": channel,
                "rssi": rssi,
                "authmode": authmode
            })
        
        return result
    
    return None