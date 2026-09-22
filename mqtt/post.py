import json
import time
from datetime import datetime, timezone

import board
import adafruit_dht
import paho.mqtt.client as mqtt
from gpiozero import Button, LED

# --- custom broker: fill these in -------------------------------
BROKER_HOST = "broker.mqtt.cool"
BROKER_PORT = 1883
MQTT_USERNAME = ""
MQTT_PASSWORD = ""
CLIENT_ID = "paperflow-pi"
# ---------------------------------------------------------------

PUBLISH_INTERVAL = 5
TOPIC_TEMPERATURE = "paperflow/sensor/temperature"
TOPIC_HUMIDITY = "paperflow/sensor/humidity"
TOPIC_BUTTONS = "paperflow/sensor/buttons"
TOPIC_ACTUATOR = "paperflow/actuator/+"

LED_PINS = {"red": 27, "yellow": 22, "green": 17}
BUTTON_PINS = {"b1": 6, "b2": 13, "b3": 19}


def utcNow():
    return datetime.now(timezone.utc).isoformat()


def readSensor(dht):
    return {"temperature": dht.temperature, "humidity": dht.humidity}


def readButtons(buttons):
    return {name: button.is_pressed for name, button in buttons.items()}


def handleActuator(topic, payload, leds):
    color = topic.rsplit("/", 1)[-1]
    led = leds.get(color)
    if led is None:
        print(f"[mqtt] no LED for {color}")
        return
    action = str(payload.get("action", "")).upper()
    if action == "ON":
        led.on()
    elif action == "OFF":
        led.off()


def onConnect(client, userdata, flags, reasonCode, properties):
    print(f"[mqtt] connected to {BROKER_HOST}:{BROKER_PORT} ({reasonCode})")
    client.subscribe(TOPIC_ACTUATOR)


def onMessage(client, userdata, msg):
    raw = msg.payload.decode()
    print(f"[mqtt] {msg.topic} -> {raw}")
    payload = json.loads(raw) if raw else {}
    handleActuator(msg.topic, payload, userdata)


def onDisconnect(client, userdata, connectFlags, reasonCode, properties):
    print(f"[mqtt] disconnected ({reasonCode})")


def connect(leds):
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=CLIENT_ID)
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.user_data_set(leds)
    client.on_connect = onConnect
    client.on_message = onMessage
    client.on_disconnect = onDisconnect
    client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
    client.loop_start()
    return client


def main():
    dht = adafruit_dht.DHT22(board.D5)
    leds = {name: LED(pin) for name, pin in LED_PINS.items()}
    buttons = {name: Button(pin, pull_up=True) for name, pin in BUTTON_PINS.items()}
    client = connect(leds)
    while True:
        reading = readSensor(dht)
        if reading["temperature"] is not None:
            client.publish(
                TOPIC_TEMPERATURE,
                json.dumps(
                    {
                        "value": reading["temperature"],
                        "unit": "celsius",
                        "timestamp": utcNow(),
                    }
                ),
            )
        if reading["humidity"] is not None:
            client.publish(
                TOPIC_HUMIDITY,
                json.dumps(
                    {
                        "value": reading["humidity"],
                        "unit": "percent",
                        "timestamp": utcNow(),
                    }
                ),
            )
        client.publish(TOPIC_BUTTONS, json.dumps(readButtons(buttons)))
        time.sleep(PUBLISH_INTERVAL)


if __name__ == "__main__":
    main()
