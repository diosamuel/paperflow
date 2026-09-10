# PaperFlow Vision API

A simple FastAPI service that provides an `/upload` endpoint to receive an image, send it to Google Gemini Vision API, and return the analysis.

---

## 📁 Directory Structure

```
api/
├── main.py              # FastAPI application & endpoints (/upload, /health)
├── gemini_service.py    # Gemini Vision API integration
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
Health check endpoint reporting configuration status.

### 3. Interactive Swagger UI
Open your browser at:
`http://localhost:8000/docs`
