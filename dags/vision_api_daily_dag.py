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


def findActiveApiUrl():
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
def dailyVisionApiDag():

    @task
    def checkApiHealth():
        """Task 1: Verify the FastAPI service is alive and healthy."""
        apiUrl = findActiveApiUrl()
        healthEndpoint = f"{apiUrl}/health"

        logger.info(f"Checking health at {healthEndpoint}...")
        response = requests.get(healthEndpoint, timeout=10)
        response.raise_for_status()

        data = response.json()
        logger.info(f"FastAPI Health Response: {data}")

        if not data.get("gemini_api_key_configured"):
            logger.warning(
                "GEMINI_API_KEY is not configured in the FastAPI service. "
                "Make sure to set GEMINI_API_KEY in api/.env"
            )

        return apiUrl

    @task
    def uploadImageToGemini(baseUrl):
        """Task 2: Send sample image to FastAPI /upload endpoint."""
        uploadEndpoint = f"{baseUrl}/upload"

        # Search for sample image inside container or host filesystem
        possiblePaths = [
            Path("/opt/airflow/dags/sample_images/sample_drawing.png"),
            Path(__file__).parent / "sample_images" / "sample_drawing.png",
        ]

        imagePath = None
        for p in possiblePaths:
            if p.exists():
                imagePath = p
                break

        prompt = (
            "Analyze this workflow drawing. Identify the steps, "
            "connections, and overall pipeline structure."
        )

        if imagePath:
            logger.info(f"Uploading image from: {imagePath}")
            with open(imagePath, "rb") as f:
                files = {"file": (imagePath.name, f.read(), "image/png")}
        else:
            logger.info("Sample image not found on disk, creating 1x1 test PNG in-memory...")
            # 1x1 transparent PNG fallback bytes
            dummyPng = (
                b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
                b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05"
                b"\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
            )
            files = {"file": ("test_diagram.png", dummyPng, "image/png")}

        data = {"prompt": prompt}

        logger.info(f"Sending POST request to {uploadEndpoint}...")
        response = requests.post(uploadEndpoint, files=files, data=data, timeout=60)
        response.raise_for_status()

        result = response.json()
        logger.info(f"FastAPI Response status: {result.get('status')}")
        logger.info(f"Gemini output:\n{result.get('response')}")
        return result

    @task
    def logSummary(result):
        """Task 3: Log a clean summary of the execution."""
        logger.info("=" * 50)
        logger.info("DAILY GEMINI VISION TASK SUMMARY")
        logger.info(f"File processed: {result.get('filename')}")
        logger.info(f"Size: {result.get('size_bytes')} bytes")
        logger.info(f"Prompt: {result.get('prompt')}")
        logger.info(f"Vision Response: {result.get('response')}")
        logger.info("=" * 50)

    # Pipeline definition
    activeUrl = checkApiHealth()
    visionResult = uploadImageToGemini(activeUrl)
    logSummary(visionResult)


dailyVisionDag = dailyVisionApiDag()
