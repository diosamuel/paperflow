import random
from datetime import datetime

from airflow.sdk import dag, task


@dag(
    dag_id="paperflow_demo",
    description="Mock sensor read, rule evaluation, and branching.",
    schedule="@daily",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["paperflow"],
)
def paperflowDemo():
    @task
    def readSensor() -> dict:
        return {
            "temperature": round(random.uniform(20.0, 35.0), 1),
            "humidity": round(random.uniform(30.0, 80.0), 1),
        }

    @task.branch
    def evaluateEnvironment(reading: dict) -> str:
        if reading["temperature"] >= 30.0:
            return "redTask"
        if reading["temperature"] >= 25.0:
            return "yellowTask"
        return "greenTask"

    @task
    def greenTask(reading: dict) -> None:
        print(f"GREEN - temperature={reading['temperature']} humidity={reading['humidity']}")

    @task
    def yellowTask(reading: dict) -> None:
        print(f"YELLOW - temperature={reading['temperature']} humidity={reading['humidity']}")

    @task
    def redTask(reading: dict) -> None:
        print(f"RED - temperature={reading['temperature']} humidity={reading['humidity']}")

    reading = readSensor()
    decided = evaluateEnvironment(reading)

    decided >> [greenTask(reading), yellowTask(reading), redTask(reading)]


paperflowDemo()
