import os
from datetime import datetime
import requests
from airflow.sdk import dag, task

API_BASE = os.getenv("PAPERFLOW_API_BASE", 'http://localhost:8000')
REQUEST_TIMEOUT = 5

def latestSensorReading():
    # GET /iot/sensor -> {temp, humid, ts};
    response = requests.get(f"{API_BASE}/iot/sensor", timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("online"):
        raise RuntimeError("Pi sensor offline: no recent reading")
    return payload["data"]

@task
def read_humidity() -> float:
    # Humidity (%) from the Raspberry Pi sensor.
    return latestSensorReading()["humid"]

@task
def read_temperature() -> float:
    # Temperature (C) from the Raspberry Pi DHT22 sensor.
    return latestSensorReading()["temp"]

@task
def set_led(colour: str, state: bool) -> None:
    # Turn a Raspberry Pi LED on or off.
    response = requests.post(f"{API_BASE}/iot/led/{colour}", json={"on": state}, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()

@task.branch
def home_alert_branch(humidity: float, temperature: float) -> str:
    if humidity >= 80:
        return "set_led_red"
    elif temperature == 25:
        return "set_led_yellow"
    return "set_led_green"

@dag(dag_id="blockly_home_alert", schedule="@daily", start_date=datetime(2025, 1, 1), catchup=False)
def home_alert_dag():
    humidity = read_humidity()
    temperature = read_temperature()
    branch = home_alert_branch(humidity, temperature)
    branch >> [
        set_led.override(task_id="set_led_red")("red", True),
        set_led.override(task_id="set_led_yellow")("yellow", True),
        set_led.override(task_id="set_led_green")("green", True),
    ]

home_alert_dag()
