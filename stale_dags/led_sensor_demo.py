import os
import time
from datetime import datetime, timedelta

import requests
from airflow.sdk import dag, task

API_BASE = os.getenv("PAPERFLOW_API_BASE", "http://localhost:8000")
LED_COLORS = ("red", "yellow", "green")
REQUEST_TIMEOUT = 5
BLINK_SECONDS = 2


def setLed(color: str, on: bool) -> None:
    response = requests.post(
        f"{API_BASE}/iot/led/{color}",
        json={"on": on},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    print(f"[led] {color} {'ON' if on else 'OFF'}")


@dag(
    dag_id="led_sensor_demo",
    description="Every minute: read the Pi's temperature/humidity, then blink the red, yellow and green LEDs.",
    schedule=timedelta(minutes=1),
    start_date=datetime(2025, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["paperflow", "iot"],
)
def ledSensorDemo():
    @task
    def readSensors() -> dict:
        response = requests.get(f"{API_BASE}/iot/sensor", timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        payload = response.json()
        data = payload.get("data", {})

        temperature = data.get("temp")
        humidity = data.get("humid")
        print(
            f"[sensor] temperature={temperature} humidity={humidity} "
            f"online={payload.get('online')} age_seconds={payload.get('age_seconds')}"
        )
        return {"temperature": temperature, "humidity": humidity}

    @task
    def blinkLeds() -> None:
        for color in LED_COLORS:
            setLed(color, True)
            time.sleep(BLINK_SECONDS)
            setLed(color, False)

    readSensors() >> blinkLeds()


ledSensorDemo()
