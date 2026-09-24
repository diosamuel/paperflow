import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

from mqtt_bridge import MqttBridge

load_dotenv()

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
    }


@app.get("/iot/sensor")
def getSensorData():
    """Latest temperature/humidity reading published on the sensor topic."""
    return {"status": "success", **bridge.sensorSnapshot()}


@app.get("/iot/buttons")
def getButtonsData():
    """Latest button press/release state published by the Raspberry Pi."""
    return {"status": "success", **bridge.buttonsSnapshot()}


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


BLOCKLY_DIR = Path(
    os.getenv("BLOCKLY_DAGS_DIR", Path(__file__).resolve().parent.parent / "blockly_dags")
)


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


@app.post("/save")
def saveBlocklySource(source: BlocklySource):
    """Write Blockly-generated Python into blockly_dags/ for the Airflow agent to convert."""
    name = safeBlocklyName(source.filename)
    BLOCKLY_DIR.mkdir(parents=True, exist_ok=True)
    path = BLOCKLY_DIR / name
    path.write_text(source.code)
    return {"status": "success", "filename": name, "path": str(path)}


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
