"""
image_reader.py — Extract text from uploaded images using Groq Vision LLM.
Falls back to pytesseract OCR if Groq vision is unavailable.
"""
import os
import base64
from io import BytesIO
from dotenv import load_dotenv
from groq import Groq
from PIL import Image

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
load_dotenv()

_groq = Groq(api_key=os.getenv("GROQ_API_KEY"))
_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def _image_to_base64(image_bytes: bytes, mime_type: str = "image/png") -> str:
    """Convert raw image bytes to a data-URI string for Groq Vision."""
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


def _resize_if_needed(img: Image.Image, max_side: int = 1280) -> Image.Image:
    """Down-scale large images to avoid hitting API size limits."""
    w, h = img.size
    if max(w, h) <= max_side:
        return img
    ratio = max_side / max(w, h)
    return img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)


def extract_text_from_image(image_bytes: bytes, mime_type: str = "image/png") -> str:
    """
    Primary: Groq Vision LLM (llama-3.2-11b-vision-preview).
    Fallback: pytesseract OCR.
    Returns the extracted text string.
    """
    # ── Try Groq Vision first ───────────────────────────────────────
    try:
        # Resize to keep within API limits
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
        img = _resize_if_needed(img)

        buf = BytesIO()
        img.save(buf, format="PNG")
        data_uri = _image_to_base64(buf.getvalue(), "image/png")

        response = _groq.chat.completions.create(
            model=_VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Extract ALL text visible in this image. "
                                "Include every word, number, equation, and label exactly as written. "
                                "If the image contains a diagram, describe its key elements briefly. "
                                "Return only the extracted text, nothing else."
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": data_uri},
                        },
                    ],
                }
            ],
            temperature=0.1,
            max_tokens=1024,
        )
        text = response.choices[0].message.content.strip()
        if text:
            return text
    except Exception as e:
        print(f"[image_reader] Groq Vision failed, trying OCR fallback: {e}")

    # ── Fallback: pytesseract OCR ───────────────────────────────────
    try:
        import pytesseract
        img = Image.open(BytesIO(image_bytes))
        text = pytesseract.image_to_string(img)
        return text.strip()
    except Exception as ocr_err:
        print(f"[image_reader] OCR fallback also failed: {ocr_err}")
        return ""
