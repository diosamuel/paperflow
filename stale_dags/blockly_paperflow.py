import os
from datetime import datetime

import requests

from airflow.sdk import dag, task

API_BASE = os.getenv("PAPERFLOW_API_BASE", "http://localhost:8000")
REQUEST_TIMEOUT = 5


def latestReading() -> dict:
    """GET /iot/sensor and return the cached reading (temp, humid, ts)."""
    response = requests.get(f"{API_BASE}/iot/sensor", timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("online"):
        raise RuntimeError("Pi sensor offline: no reading within MQTT_STALE_AFTER_SECONDS")
    return payload["data"]


@task
def read_humidity() -> float:
    # Reads the humidity (%) from the Raspberry Pi sensor. GET /iot/sensor.
    return latestReading()["humid"]


@task
def read_temperature() -> float:
    # Reads the temperature (C) from the Raspberry Pi sensor. GET /iot/sensor.
    return latestReading()["temp"]


@task
def set_led(colour: str, state: bool) -> None:
    # Turns one of the Raspberry Pi LEDs on or off. POST /iot/led/{colour}.
    response = requests.post(
        f"{API_BASE}/iot/led/{colour}", json={"on": state}, timeout=REQUEST_TIMEOUT
    )
    response.raise_for_status()


@task.branch()
def check_humidity(humidity):
    return 'set_led_on' if humidity > 70 else 'set_led_off'


@dag(dag_id='blockly_paperflow', schedule='@daily', start_date=datetime(2023, 1, 1), catchup=False)
def paperflow_dag():
    humidity = read_humidity()
    task_check = check_humidity(humidity)
    set_led_on = set_led.override(task_id='set_led_on')('red', True)
    set_led_off = set_led.override(task_id='set_led_off')('red', False)
    task_check >> [set_led_on, set_led_off]


paperflow_dag()
