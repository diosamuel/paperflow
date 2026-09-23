import time

import board
import adafruit_dht
import paho.mqtt.client as mqtt
from gpiozero import Button, LED

BROKER_HOST = "broker.mqtt.cool"
BROKER_PORT = 1883
MQTT_USERNAME = ""
MQTT_PASSWORD = ""
CLIENT_ID = "paperflow-pi"
PUBLISH_INTERVAL = 5
TOPIC_SENSOR = "paperflow/sensor"
TOPIC_BUTTONS = "paperflow/sensor/buttons"
TOPIC_ACTUATOR = "paperflow/actuator/+"

LED_PINS = {"red": 27, "yellow": 22, "green": 17}
BUTTON_PINS = {"blueButton": 13}


def readSensor(dht):
    try:
        reading = {"temperature": dht.temperature, "humidity": dht.humidity}
        print(f"[dht] temperature={reading['temperature']} humidity={reading['humidity']}")
        return reading
    except RuntimeError as error:
        print(f"[dht] read failed: {error}")
        return {"temperature": None, "humidity": None}


def onButton(name, pressed, client):
    print(f"[button] {name} {'pressed' if pressed else 'released'}")
    client.publish(TOPIC_BUTTONS, f"button={pressed}")


def setupButtons(client, buttons):
    for name, button in buttons.items():
        button.when_pressed = lambda n=name: onButton(n, True, client)
        button.when_released = lambda n=name: onButton(n, False, client)


def handleActuator(topic, payload, leds):
    color = topic.rsplit("/", 1)[-1]
    led = leds.get(color)
    if led is None:
        print(f"[mqtt] no LED for {color}")
        return
    if payload.lower() == "on=true":
        led.on()
    elif payload.lower() == "on=false":
        led.off()
    else:
        print(f"[mqtt] unknown payload: {payload!r}")


def onConnect(client, userdata, flags, reasonCode, properties):
    print(f"[mqtt] connected to {BROKER_HOST}:{BROKER_PORT} ({reasonCode})")
    client.subscribe(TOPIC_ACTUATOR)


def onMessage(client, userdata, msg):
    payload = msg.payload.decode()
    print(f"[mqtt] {msg.topic} -> {payload}")
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
    setupButtons(client, buttons)
    while True:
        reading = readSensor(dht)
        if reading["temperature"] is not None:
            message = (
                f"temp={reading['temperature']};"
                f"humid={reading['humidity']};"
                f"ts={int(time.time())}"
            )
            client.publish(TOPIC_SENSOR, message)
        time.sleep(PUBLISH_INTERVAL)


if __name__ == "__main__":
    main()
