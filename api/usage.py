import os
import requests

API_BASE = os.getenv("PAPERFLOW_API_BASE", "http://localhost:8000")
REQUEST_TIMEOUT = 5
def latestSensorReading():
    """GET /iot/sensor and return the cached reading (temp, humid, ts)."""
    response = requests.get(f"{API_BASE}/iot/sensor", timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("online"):
        raise RuntimeError("Pi sensor offline: no reading within MQTT_STALE_AFTER_SECONDS")
    return payload["data"]

def read_humidity() -> float:
    # Reads the humidity (%) from the Raspberry Pi sensor. GET /iot/sensor.
    return latestSensorReading()["humid"]

def read_temperature() -> float:
    # Reads the temperature (C) from the Raspberry Pi sensor. GET /iot/sensor.
    return latestSensorReading()["temp"]

def set_led(colour: str, state: bool) -> None:
    # Turns one of the Raspberry Pi LEDs on or off. POST /iot/led/{colour}.
    response = requests.post(
        f"{API_BASE}/iot/led/{colour}", json={"on": state}, timeout=REQUEST_TIMEOUT
    )
    response.raise_for_status()
