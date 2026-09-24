import asyncio
import os
import threading
import time
from typing import Any, Optional

import paho.mqtt.client as mqtt

DEFAULT_LED_COLORS = ("red", "yellow", "green")


def coerceValue(value: str) -> Any:
    lowered = value.lower()
    if lowered in ("true", "false"):
        return lowered == "true"
    if lowered in ("none", "null", ""):
        return None
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        return value


def parsePayload(payload: str) -> dict[str, Any]:
    parsed: dict[str, Any] = {}
    for part in payload.split(";"):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        key = key.strip()
        if not key:
            continue
        parsed[key] = coerceValue(value.strip())
    return parsed


class MqttBridge:
    def __init__(self) -> None:
        self.host = os.getenv("MQTT_HOST", "broker.mqtt.cool")
        self.port = int(os.getenv("MQTT_PORT", "1883"))
        self.username = os.getenv("MQTT_USERNAME", "")
        self.password = os.getenv("MQTT_PASSWORD", "")
        self.clientId = os.getenv("MQTT_CLIENT_ID", "paperflow-api")
        self.sensorTopic = os.getenv("MQTT_SENSOR_TOPIC", "paperflow/sensor")
        self.buttonsTopic = os.getenv("MQTT_BUTTONS_TOPIC", "paperflow/sensor/buttons")
        self.actuatorPrefix = os.getenv("MQTT_ACTUATOR_PREFIX", "paperflow/actuator")
        self.staleAfterSeconds = float(os.getenv("MQTT_STALE_AFTER_SECONDS", "15"))
        self.ledColors = tuple(
            color.strip()
            for color in os.getenv("MQTT_LED_COLORS", ",".join(DEFAULT_LED_COLORS)).split(",")
            if color.strip()
        )

        self._lock = threading.Lock()
        self._connected = False
        self._sensor: Optional[dict[str, Any]] = None
        self._sensorAt: Optional[float] = None
        self._buttons: Optional[dict[str, Any]] = None
        self._buttonsAt: Optional[float] = None
        self._leds: dict[str, bool] = {color: False for color in self.ledColors}
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()

        self._client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2, client_id=self.clientId
        )
        if self.username:
            self._client.username_pw_set(self.username, self.password)
        self._client.reconnect_delay_set(min_delay=1, max_delay=30)
        self._client.on_connect = self._onConnect
        self._client.on_disconnect = self._onDisconnect
        self._client.on_message = self._onMessage

    def start(self) -> None:
        self._client.connect_async(self.host, self.port, keepalive=60)
        self._client.loop_start()
        print(f"[mqtt] connecting to {self.host}:{self.port} as {self.clientId}")

    def stop(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()

    def _onConnect(self, client, userdata, flags, reasonCode, properties=None) -> None:
        client.subscribe(self.sensorTopic)
        client.subscribe(self.buttonsTopic)
        with self._lock:
            self._connected = True
        print(f"[mqtt] connected to {self.host}:{self.port} ({reasonCode})")

    def _onDisconnect(self, client, userdata, flags, reasonCode, properties=None) -> None:
        with self._lock:
            self._connected = False
        print(f"[mqtt] disconnected ({reasonCode})")

    def _onMessage(self, client, userdata, message) -> None:
        payload = message.payload.decode(errors="replace")
        receivedAt = time.time()

        if message.topic == self.sensorTopic:
            data = parsePayload(payload)
            with self._lock:
                self._sensor = data
                self._sensorAt = receivedAt
        elif message.topic == self.buttonsTopic:
            data = parsePayload(payload)
            with self._lock:
                self._buttons = data
                self._buttonsAt = receivedAt
        else:
            return

        print(f"[mqtt] {message.topic} -> {payload}")
        self._emit(
            {
                "type": "message",
                "topic": message.topic,
                "received_at": receivedAt,
                "data": data,
            }
        )

    def setLoop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self) -> "asyncio.Queue[dict[str, Any]]":
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: "asyncio.Queue[dict[str, Any]]") -> None:
        self._subscribers.discard(queue)

    def _emit(self, event: dict[str, Any]) -> None:
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        loop.call_soon_threadsafe(self._broadcast, event)

    def _broadcast(self, event: dict[str, Any]) -> None:
        for queue in list(self._subscribers):
            queue.put_nowait(event)

    def _snapshot(
        self, data: Optional[dict[str, Any]], receivedAt: Optional[float]
    ) -> dict[str, Any]:
        ageSeconds = None if receivedAt is None else round(time.time() - receivedAt, 1)
        return {
            "connected": self._connected,
            "online": ageSeconds is not None and ageSeconds <= self.staleAfterSeconds,
            "age_seconds": ageSeconds,
            "received_at": receivedAt,
            "data": dict(data) if data else {},
        }

    def isConnected(self) -> bool:
        with self._lock:
            return self._connected

    def sensorSnapshot(self) -> dict[str, Any]:
        with self._lock:
            data = self._sensor
            receivedAt = self._sensorAt
            connected = self._connected
        snapshot = self._snapshot(data, receivedAt)
        snapshot["connected"] = connected
        return snapshot

    def buttonsSnapshot(self) -> dict[str, Any]:
        with self._lock:
            data = self._buttons
            receivedAt = self._buttonsAt
            connected = self._connected
        snapshot = self._snapshot(data, receivedAt)
        snapshot["connected"] = connected
        return snapshot

    def ledsSnapshot(self) -> dict[str, Any]:
        with self._lock:
            return {"connected": self._connected, "data": dict(self._leds)}

    def publishLed(self, color: str, on: bool) -> dict[str, Any]:
        topic = f"{self.actuatorPrefix}/{color}"
        payload = "on=true" if on else "on=false"
        result = self._client.publish(topic, payload, qos=1)

        with self._lock:
            self._leds[color] = on
            leds = dict(self._leds)
        self._emit({"type": "leds", "data": leds})

        return {
            "topic": topic,
            "payload": payload,
            "mid": result.mid,
            "rc": result.rc,
        }

    def publishButton(self, pressed: bool) -> dict[str, Any]:
        """Publish a button press/release, as the Raspberry Pi would.

        The broker echoes it back to our own subscription, so the cache and the
        SSE stream update through the normal message path.
        """
        payload = f"button={pressed}"
        result = self._client.publish(self.buttonsTopic, payload, qos=1)
        return {
            "topic": self.buttonsTopic,
            "payload": payload,
            "mid": result.mid,
            "rc": result.rc,
        }
