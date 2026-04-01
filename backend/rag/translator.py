"""
translator.py — Detect language and translate Hindi/Gujarati ↔ English.
Uses Groq LLM itself for translation (lightweight, no extra model download).
Falls back to English-only if translation fails.
"""
import re
import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
load_dotenv()

_groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Unicode ranges for Devanagari (Hindi/Sanskrit) and Gujarati script
_DEVANAGARI = re.compile(r'[\u0900-\u097F]')
_GUJARATI = re.compile(r'[\u0A80-\u0AFF]')


def detect_language(text: str) -> str:
    """Detect if input is Hindi, Gujarati, or English."""
    if _GUJARATI.search(text):
        return "gujarati"
    if _DEVANAGARI.search(text):
        return "hindi"
    return "english"


def translate_to_english(text: str, source_lang: str) -> str:
    """Translate Hindi/Gujarati text to English using Groq."""
    if source_lang == "english":
        return text
    try:
        response = _groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a translator. Translate the text to English. Output ONLY the translation, nothing else."},
                {"role": "user", "content": text}
            ],
            temperature=0.1,
            max_tokens=500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Translator] to-English failed: {e}")
        return text


def translate_from_english(text: str, target_lang: str) -> str:
    """Translate English answer back to Hindi/Gujarati using Groq."""
    if target_lang == "english":
        return text
    lang_name = "Hindi" if target_lang == "hindi" else "Gujarati"
    try:
        response = _groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": f"You are a translator. Translate the text to {lang_name}. Output ONLY the translation, nothing else."},
                {"role": "user", "content": text}
            ],
            temperature=0.1,
            max_tokens=1000
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Translator] to-{lang_name} failed: {e}")
        return text
