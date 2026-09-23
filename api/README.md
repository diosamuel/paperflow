# PaperFlow Vision API

A simple FastAPI service that provides an `/upload` endpoint to receive an image, send it to Google Gemini Vision API, and return the analysis.

---

## 📁 Directory Structure

```
api/
├── main.py              # FastAPI application & endpoints (/upload, /health, /iot/*)
├── gemini_service.py    # Gemini Vision API integration
├── mqtt_bridge.py       # MQTT subscriber + last-value cache for Raspberry Pi telemetry
├── requirements.txt     # Python dependencies
├── .env.example         # Template for environment variables
└── README.md            # Setup and usage guide
```

---

## 🚀 Quickstart

### 1. Set up Python environment

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure your Gemini API Key:

```bash
cp .env.example .env
```

Edit `.env`:
```env
GEMINI_API_KEY=AIzaSy...your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
HOST=0.0.0.0
PORT=8000

# MQTT bridge (must match mqtt/post.py on the Raspberry Pi)
MQTT_HOST=broker.mqtt.cool
MQTT_PORT=1883
MQTT_CLIENT_ID=paperflow-api
MQTT_SENSOR_TOPIC=paperflow/sensor
MQTT_BUTTONS_TOPIC=paperflow/sensor/buttons
MQTT_ACTUATOR_PREFIX=paperflow/actuator
MQTT_STALE_AFTER_SECONDS=15
```

### 3. Run the API Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
or:
```bash
python main.py
```

---

## 📡 API Endpoints

### 1. `POST /upload`
Uploads an image and gets Gemini Vision response.

- **Request:** `multipart/form-data`
  - `file` (required): Image file (`image/jpeg`, `image/png`, etc.)
  - `prompt` (optional): Custom prompt string to instruct Gemini

- **Example curl:**
```bash
curl -X POST "http://localhost:8000/upload" \
  -F "file=@/path/to/workflow_paper.png" \
  -F "prompt=Describe the nodes and connections drawn on this paper."
```

- **Example Response:**
```json
{
  "status": "success",
  "filename": "workflow_paper.png",
  "content_type": "image/png",
  "size_bytes": 104230,
  "prompt": "Describe the nodes and connections drawn on this paper.",
  "response": "The drawing contains 3 nodes: Start -> Step A -> End..."
}
```

### 2. `GET /health`
Health check endpoint reporting configuration status, including MQTT broker connectivity.

### 3. `GET /iot`
Combined snapshot: latest sensor reading plus latest button state.

### 4. `GET /iot/sensor`
Latest temperature/humidity reading the Raspberry Pi published on `paperflow/sensor`.

- **Example response:**
```json
{
  "status": "success",
  "connected": true,
  "online": true,
  "age_seconds": 1.2,
  "received_at": 1690000000.0,
  "data": { "temp": 25.3, "humid": 60.1, "ts": 1690000000 }
}
```

`online` is `false` once the last message is older than `MQTT_STALE_AFTER_SECONDS`.

### 5. `GET /iot/buttons`
Latest button state published on `paperflow/sensor/buttons`.

### 6. `POST /iot/led/{color}`
Publishes an actuator command to `paperflow/actuator/{color}` to switch a Raspberry Pi LED.

- **Path:** `color` — `red`, `yellow`, or `green`
- **Body:** `{ "on": true }`

- **Example curl:**
```bash
curl -X POST "http://localhost:8000/iot/led/red" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'
```

### 7. `GET /iot/stream`
Server-Sent Events (SSE) stream. On connect it sends one `snapshot` event with the
current state, then one `message` event for every reading the Raspberry Pi pushes
(a `: keep-alive` comment every 15s keeps the connection open).

- **Example:**
```bash
curl -N http://localhost:8000/iot/stream
```
```
data: {"type": "snapshot", "sensor": {...}, "buttons": {...}}

data: {"type": "message", "topic": "paperflow/sensor", "received_at": 1690000000.0, "data": {"temp": 25.3, "humid": 60.1, "ts": 1690000000}}
```

This is what the builder's **Wiring** page sidebar consumes via `EventSource`.

### 8. Interactive Swagger UI
Open your browser at:
`http://localhost:8000/docs`

---

## 🔌 How the MQTT bridge works

MQTT is push-based and HTTP is request/response, so the API runs a background MQTT
client (started with the app's lifespan) that subscribes to the Raspberry Pi's
topics and keeps only the **latest** message in memory. The `/iot/*` endpoints then
read that cache — so "polling" happens over HTTP.

Topics and payloads mirror `mqtt/post.py` (the reference implementation running on
the Pi):

| Direction | Topic | Payload |
|-----------|-------|---------|
| Pi → API (subscribe) | `paperflow/sensor` | `temp=25.3;humid=60.1;ts=1690000000` |
| Pi → API (subscribe) | `paperflow/sensor/buttons` | `button=True` |
| API → Pi (publish) | `paperflow/actuator/red` | `on=true` / `on=false` |

Note: run a single API process (no `--workers`) — each worker would open its own
MQTT connection and hold a separate cache.
