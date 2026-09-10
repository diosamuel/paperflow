import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def callGeminiVision(
    image_bytes,
    mime_type="image/png",
    prompt=None,
    model_name=None,
):
    """Send an image to Gemini Vision API and return the text response.

    Supports both 'google-genai' (recommended) and 'google-generativeai'.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError(
            "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your environment or api/.env file."
        )

    model = model_name or DEFAULT_MODEL
    prompt_text = prompt or "Analyze this image and describe what you see in detail."

    # Try modern google-genai SDK first
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt_text,
            ],
        )
        return response.text or ""
    except ImportError:
        pass

    # Fallback to google-generativeai SDK
    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        genai_model = genai.GenerativeModel(model)
        response = genai_model.generate_content(
            [
                {"mime_type": mime_type, "data": image_bytes},
                prompt_text,
            ]
        )
        return response.text or ""
    except ImportError:
        raise RuntimeError(
            "Neither 'google-genai' nor 'google-generativeai' package is installed. "
            "Please run: pip install -r requirements.txt"
        )
