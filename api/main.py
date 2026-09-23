import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

from gemini_service import callGeminiVision
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
    title="PaperFlow Vision API",
    description="FastAPI boilerplate for receiving images and analyzing them with Gemini Vision API.",
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
        "message": "Welcome to PaperFlow Vision API",
        "docs_url": "/docs",
        "health_check": "/health",
    }


@app.get("/health")
def getHealth():
    gemini_key_set = bool(os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_API_KEY") != "your_gemini_api_key_here")
    return {
        "status": "healthy",
        "gemini_api_key_configured": gemini_key_set,
        "default_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
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


@app.post("/upload")
async def uploadImage(
    file: UploadFile = File(..., description="Image file to analyze"),
    prompt: Optional[str] = Form(
        None,
        description="Optional custom prompt instructions for Gemini Vision",
    ),
):
    # Validate content type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Please upload an image file (e.g. image/jpeg, image/png).",
        )

    try:
        # Read file contents
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # Pass image to Gemini Vision API
        response_text = callGeminiVision(
            image_bytes=image_bytes,
            mime_type=file.content_type,
            prompt=prompt,
        )

        return {
            "status": "success",
            "filename": file.filename,
            "content_type": file.content_type,
            "size_bytes": len(image_bytes),
            "prompt": prompt or "Default prompt",
            "response": response_text,
        }

    except ValueError as ve:
        raise HTTPException(status_code=500, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=500, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image with Gemini: {str(e)}")


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
