# PaperFlow IoT API

A FastAPI service that bridges the Raspberry Pi over MQTT: it exposes the Pi's
latest sensor and button readings over HTTP (plus a Server-Sent Events stream),
and publishes LED commands back to the Pi.

---

## 📁 Directory Structure

```
api/
├── main.py              # FastAPI application & endpoints (/, /health, /iot/*)
├── mqtt_bridge.py       # MQTT subscriber + last-value cache for Raspberry Pi telemetry
├── requirements.txt     # Python dependencies
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

Configuration is centralised in the **repo-root `.env`**, shared with the Airflow
DAGs and the builder UI. Create it once from the template:

```bash
cd ..
cp .env.example .env
```

`main.py` loads that file explicitly, so the service picks it up no matter which
directory you launch it from. The variables it reads:

```env
# This file lives at the repo root, not in api/.
HOST=0.0.0.0
PORT=8000

# MQTT bridge (must match mqtt/raspi.py on the Raspberry Pi)
MQTT_HOST=broker.mqtt.cool
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_CLIENT_ID=paperflow-api
MQTT_SENSOR_TOPIC=paperflow/sensor
MQTT_BUTTONS_TOPIC=paperflow/sensor/buttons
MQTT_ACTUATOR_PREFIX=paperflow/actuator
MQTT_LED_COLORS=red,yellow,green
MQTT_STALE_AFTER_SECONDS=15

# Airflow API, used by POST /save to trigger the Blockly->DAG agent
AIRFLOW_API_URL=http://localhost:8080
AIRFLOW_API_USERNAME=admin
AIRFLOW_API_PASSWORD=admin
AIRFLOW_DAG_ID=auto_generate_dag
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

### 1. `GET /`
Welcome message with links to the docs and health check.

### 2. `GET /health`
Health check endpoint reporting MQTT broker connectivity.

- **Example response:**
```json
{
  "status": "healthy",
  "mqtt_connected": true,
  "mqtt_broker": "broker.mqtt.cool:1883"
}
```

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

- **Path:** `color` — `red`, `yellow`, or `green` (lowercased; anything else returns `400`)
- **Body (JSON):**
  ```json
  { "on": true }
  ```
  `on` is optional and defaults to `true`.

  The JSON is the HTTP layer only. The bridge converts it to the string payload
  the Pi expects, so `{"on": true}` publishes `on=true` and `{"on": false}`
  publishes `on=false` on `paperflow/actuator/{color}` — which is exactly what
  `mqtt/raspi.py` → `handleActuator` matches with `payload.lower()`. Returns `503`
  if the MQTT broker is not connected.

- **Example curl:**
```bash
curl -X POST "http://localhost:8000/iot/led/red" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'
```

- **Example response:**
```json
{
  "status": "success",
  "color": "red",
  "on": true,
  "topic": "paperflow/actuator/red",
  "payload": "on=true",
  "mid": 3,
  "rc": 0
}
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

### 8. `POST /save`
Writes Blockly-generated Python into the repo-root `blockly_dags/` folder, where
`airflow/dags/auto_generate_dag.py` picks it up and has the LLM agent convert it
into a real DAG.

- **Body (JSON):**
  ```json
  {
    "code": "def read_humidity():\n    # read from raspberry pi\n    return humidity\n",
    "filename": "paperflow_dag.py"
  }
  ```
`filename` is sanitized to a bare `blockly*.py` name — directory components are
stripped and a `blockly-` prefix is added when missing, so `paperflow_dag.py`
is written as `blockly-paperflow_dag.py`. The folder can be redirected with
`BLOCKLY_DAGS_DIR`.

After writing, the endpoint **triggers the Airflow agent**: it authenticates to
the Airflow API (`POST /auth/token`) and creates a DAG run
(`POST /api/v2/dags/{AIRFLOW_DAG_ID}/dagRuns`), which rewrites the source into a
real DAG. Configuration: `AIRFLOW_API_URL` (default `http://localhost:8080`),
`AIRFLOW_API_USERNAME` / `AIRFLOW_API_PASSWORD` (default `admin` / `admin`),
`AIRFLOW_DAG_ID` (default `auto_generate_dag`). A failed trigger does not fail the
save — it is reported in `airflow`.

- **Example response:**
```json
{
  "status": "success",
  "filename": "blockly-paperflow_dag.py",
  "path": "/…/blockly_dags/blockly-paperflow_dag.py",
  "airflow": { "triggered": true, "dag_run_id": "manual__2026-09-24T18:57:46.402385+00:00" }
}
```

### 9. Interactive Swagger UI
Open your browser at:
`http://localhost:8000/docs`

---

## 🔌 How the MQTT bridge works

MQTT is push-based and HTTP is request/response, so the API runs a background MQTT
client (started with the app's lifespan) that subscribes to the Raspberry Pi's
topics and keeps only the **latest** message in memory. The `/iot/*` endpoints then
read that cache — so "polling" happens over HTTP.

Topics and payloads mirror `mqtt/raspi.py` (the reference implementation running on
the Pi):

| Direction | Topic | Payload |
|-----------|-------|---------|
| Pi → API (subscribe) | `paperflow/sensor` | `temp=25.3;humid=60.1;ts=1690000000` |
| Pi → API (subscribe) | `paperflow/sensor/buttons` | `button=True` |
| API → Pi (publish) | `paperflow/actuator/red` | `on=true` / `on=false` |

Note: run a single API process (no `--workers`) — each worker would open its own
MQTT connection and hold a separate cache.

See the repository-root `README.md` for the Raspberry Pi pinout tables.
