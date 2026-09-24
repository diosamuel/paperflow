import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

from mqtt_bridge import MqttBridge

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

bridge = MqttBridge()


@asynccontextmanager
async def lifespan(app: FastAPI):
    bridge.setLoop(asyncio.get_running_loop())
    bridge.start()
    try:
        yield
    finally:
        bridge.stop()


app = FastAPI(
    title="PaperFlow IoT API",
    description="FastAPI service that bridges Raspberry Pi telemetry and LEDs over MQTT.",
    version="0.1.0",
    lifespan=lifespan,
)

# Enable CORS for local development / web frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def getRoot():
    return {
        "message": "Welcome to PaperFlow IoT API",
        "docs_url": "/docs",
        "health_check": "/health",
    }


@app.get("/health")
def getHealth():
    return {
        "status": "healthy",
        "mqtt_connected": bridge.isConnected(),
        "mqtt_broker": f"{bridge.host}:{bridge.port}",
    }


@app.get("/iot")
def getIotData():
    """Latest cached telemetry pushed by the Raspberry Pi over MQTT."""
    return {
        "status": "success",
        "sensor": bridge.sensorSnapshot(),
        "buttons": bridge.buttonsSnapshot(),
        "leds": bridge.ledsSnapshot(),
    }


@app.get("/iot/sensor")
def getSensorData():
    """Latest temperature/humidity reading published on the sensor topic."""
    return {"status": "success", **bridge.sensorSnapshot()}


@app.get("/iot/buttons")
def getButtonsData():
    """Latest button press/release state published by the Raspberry Pi."""
    return {"status": "success", **bridge.buttonsSnapshot()}


@app.get("/iot/leds")
def getLedsData():
    """Last commanded state of each Raspberry Pi LED."""
    return {"status": "success", **bridge.ledsSnapshot()}


@app.get("/iot/stream")
async def streamIotData():
    """Server-Sent Events stream of every reading pushed by the Raspberry Pi."""
    queue = bridge.subscribe()

    def encode(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    async def eventStream():
        try:
            yield encode(
                {
                    "type": "snapshot",
                    "sensor": bridge.sensorSnapshot(),
                    "buttons": bridge.buttonsSnapshot(),
                    "leds": bridge.ledsSnapshot()["data"],
                }
            )
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                yield encode(event)
        finally:
            bridge.unsubscribe(queue)

    return StreamingResponse(
        eventStream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class LedCommand(BaseModel):
    on: bool = True


@app.post("/iot/led/{color}")
def setLed(color: str, command: LedCommand):
    """Publish an actuator command to turn a Raspberry Pi LED on or off."""
    color = color.lower()
    if color not in bridge.ledColors:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown LED '{color}'. Use one of: {', '.join(bridge.ledColors)}.",
        )
    if not bridge.isConnected():
        raise HTTPException(status_code=503, detail="MQTT broker not connected.")

    result = bridge.publishLed(color, command.on)
    return {
        "status": "success",
        "color": color,
        "on": command.on,
        **result,
    }


class ButtonCommand(BaseModel):
    pressed: bool = True


@app.post("/iot/button")
def pressButton(command: ButtonCommand):
    """Publish a button press/release as the Raspberry Pi would, for demos without hardware."""
    if not bridge.isConnected():
        raise HTTPException(status_code=503, detail="MQTT broker not connected.")

    result = bridge.publishButton(command.pressed)
    return {
        "status": "success",
        "pressed": command.pressed,
        **result,
    }


BLOCKLY_DIR = Path(
    os.getenv("BLOCKLY_DAGS_DIR", Path(__file__).resolve().parent.parent / "blockly_dags")
)


AIRFLOW_API_URL = os.getenv("AIRFLOW_API_URL", "http://localhost:8080")
AIRFLOW_API_USERNAME = os.getenv("AIRFLOW_API_USERNAME", "admin")
AIRFLOW_API_PASSWORD = os.getenv("AIRFLOW_API_PASSWORD", "admin")
AIRFLOW_DAG_ID = os.getenv("AIRFLOW_DAG_ID", "auto_generate_dag")

REQUEST_TIMEOUT = 5


class BlocklySource(BaseModel):
    code: str
    filename: str = "blockly_source.py"


def safeBlocklyName(raw: str) -> str:
    """Reduce a client-supplied name to a plain ``blockly*.py`` file name."""
    name = Path(raw.strip() or "blockly_source").name
    if not name.endswith(".py"):
        name = f"{name}.py"
    if not name.startswith("blockly"):
        name = f"blockly-{name}"
    return name


def triggerAirflowDag() -> dict:
    """Create a DAG run for the agent that turns the saved Blockly source into a real DAG."""
    base = AIRFLOW_API_URL.rstrip("/")

    token = requests.post(
        f"{base}/auth/token",
        json={"username": AIRFLOW_API_USERNAME, "password": AIRFLOW_API_PASSWORD},
        timeout=REQUEST_TIMEOUT,
    )
    token.raise_for_status()

    run = requests.post(
        f"{base}/api/v2/dags/{AIRFLOW_DAG_ID}/dagRuns",
        headers={"Authorization": f"Bearer {token.json()['access_token']}"},
        json={"logical_date": None, "conf": {}},
        timeout=REQUEST_TIMEOUT,
    )
    run.raise_for_status()
    return run.json()


@app.post("/save")
def saveBlocklySource(source: BlocklySource):
    """Write Blockly-generated Python into blockly_dags/, then kick off the Airflow agent."""
    name = safeBlocklyName(source.filename)
    BLOCKLY_DIR.mkdir(parents=True, exist_ok=True)
    path = BLOCKLY_DIR / name
    path.write_text(source.code)

    try:
        run = triggerAirflowDag()
        airflow = {"triggered": True, "dag_run_id": run.get("dag_run_id")}
    except Exception as error:
        airflow = {"triggered": False, "error": f"{type(error).__name__}: {error}"}

    return {"status": "success", "filename": name, "path": str(path), "airflow": airflow}


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
