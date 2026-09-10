import os
from typing import Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

from gemini_service import call_gemini_vision

load_dotenv()

app = FastAPI(
    title="PaperFlow Vision API",
    description="FastAPI boilerplate for receiving images and analyzing them with Gemini Vision API.",
    version="0.1.0",
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
def root():
    return {
        "message": "Welcome to PaperFlow Vision API",
        "docs_url": "/docs",
        "health_check": "/health",
    }


@app.get("/health")
def health():
    gemini_key_set = bool(os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_API_KEY") != "your_gemini_api_key_here")
    return {
        "status": "healthy",
        "gemini_api_key_configured": gemini_key_set,
        "default_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    }


@app.post("/upload")
async def upload_image(
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
        response_text = call_gemini_vision(
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
