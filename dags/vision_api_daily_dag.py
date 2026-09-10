"""Daily DAG to trigger the FastAPI Gemini Vision endpoint.

This DAG runs daily to check the FastAPI service health, upload an image
to the /upload endpoint, and log the Gemini Vision analysis response.
"""

from datetime import datetime, timedelta
import logging
import os
from pathlib import Path
import requests

from airflow.decorators import dag, task

# Configurable FastAPI base URL
DEFAULT_BASE_URLS = [
    os.getenv("FASTAPI_BASE_URL", "").strip(),
    "http://host.docker.internal:8000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

logger = logging.getLogger(__name__)


def find_active_api_url() -> str:
    """Finds the first reachable FastAPI service URL."""
    for url in DEFAULT_BASE_URLS:
        if not url:
            continue
        try:
            res = requests.get(f"{url.rstrip('/')}/health", timeout=3)
            if res.status_code == 200:
                logger.info(f"Connected successfully to FastAPI at: {url}")
                return url.rstrip("/")
        except Exception:
            continue
    # Default fallback
    return os.getenv("FASTAPI_BASE_URL", "http://host.docker.internal:8000").rstrip("/")


@dag(
    dag_id="daily_vision_api_trigger",
    description="Daily automated workflow triggering FastAPI /upload for Gemini Vision analysis",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    max_active_runs=1,
    default_args={
        "owner": "paperflow",
        "retries": 2,
        "retry_delay": timedelta(minutes=1),
    },
    tags=["vision", "fastapi", "gemini", "daily"],
)
def daily_vision_api_dag():

    @task
    def check_api_health() -> str:
        """Task 1: Verify the FastAPI service is alive and healthy."""
        api_url = find_active_api_url()
        health_endpoint = f"{api_url}/health"

        logger.info(f"Checking health at {health_endpoint}...")
        response = requests.get(health_endpoint, timeout=10)
        response.raise_for_status()

        data = response.json()
        logger.info(f"FastAPI Health Response: {data}")

        if not data.get("gemini_api_key_configured"):
            logger.warning(
                "GEMINI_API_KEY is not configured in the FastAPI service. "
                "Make sure to set GEMINI_API_KEY in api/.env"
            )

        return api_url

    @task
    def upload_image_to_gemini(base_url: str) -> dict:
        """Task 2: Send sample image to FastAPI /upload endpoint."""
        upload_endpoint = f"{base_url}/upload"

        # Search for sample image inside container or host filesystem
        possible_paths = [
            Path("/opt/airflow/dags/sample_images/sample_drawing.png"),
            Path(__file__).parent / "sample_images" / "sample_drawing.png",
        ]

        image_path = None
        for p in possible_paths:
            if p.exists():
                image_path = p
                break

        prompt = (
            "Analyze this workflow drawing. Identify the steps, "
            "connections, and overall pipeline structure."
        )

        if image_path:
            logger.info(f"Uploading image from: {image_path}")
            with open(image_path, "rb") as f:
                files = {"file": (image_path.name, f.read(), "image/png")}
        else:
            logger.info("Sample image not found on disk, creating 1x1 test PNG in-memory...")
            # 1x1 transparent PNG fallback bytes
            dummy_png = (
                b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
                b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05"
                b"\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
            )
            files = {"file": ("test_diagram.png", dummy_png, "image/png")}

        data = {"prompt": prompt}

        logger.info(f"Sending POST request to {upload_endpoint}...")
        response = requests.post(upload_endpoint, files=files, data=data, timeout=60)
        response.raise_for_status()

        result = response.json()
        logger.info(f"FastAPI Response status: {result.get('status')}")
        logger.info(f"Gemini output:\n{result.get('response')}")
        return result

    @task
    def log_summary(result: dict):
        """Task 3: Log a clean summary of the execution."""
        logger.info("=" * 50)
        logger.info("DAILY GEMINI VISION TASK SUMMARY")
        logger.info(f"File processed: {result.get('filename')}")
        logger.info(f"Size: {result.get('size_bytes')} bytes")
        logger.info(f"Prompt: {result.get('prompt')}")
        logger.info(f"Vision Response: {result.get('response')}")
        logger.info("=" * 50)

    # Pipeline definition
    active_url = check_api_health()
    vision_result = upload_image_to_gemini(active_url)
    log_summary(vision_result)


daily_vision_dag = daily_vision_api_dag()
