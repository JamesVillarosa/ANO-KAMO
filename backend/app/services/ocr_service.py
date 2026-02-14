"""
OCR Service — Text extraction from images via Gemini Vision API
Extracts text from photos/screenshots and translates using TranslationService.
"""
import logging
import base64
from typing import Optional

import google.generativeai as genai
from app.core.config import settings
from app.services.translation_service import TranslationService, SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)


class OcrService:
    """OCR using Gemini Vision for text extraction and translation"""

    @staticmethod
    def extract_and_translate(
        image_base64: str,
        target_lang: str,
        source_lang: Optional[str] = None,
    ) -> dict:
        """
        Extract text from a base64-encoded image and translate it.
        Uses Gemini Vision API for OCR.
        """
        extracted_text = OcrService._extract_text(image_base64, source_lang)
        detected_language = source_lang or "tl"

        if not extracted_text or extracted_text.startswith("["):
            return {
                "extracted_text": extracted_text or "No text detected",
                "translated_text": "",
                "detected_language": detected_language,
            }

        # Translate extracted text
        result = TranslationService.translate_text(
            text=extracted_text,
            source_lang=detected_language,
            target_lang=target_lang,
        )

        return {
            "extracted_text": extracted_text,
            "translated_text": result["output_text"],
            "detected_language": detected_language,
        }

    @staticmethod
    def _extract_text(image_base64: str, source_lang: Optional[str] = None) -> str:
        """Extract text from a base64 image using Gemini Vision"""
        if not settings.GEMINI_API_KEY:
            return "[OCR unavailable — Gemini API not configured]"

        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-2.0-flash")

            # Decode base64
            image_bytes = base64.b64decode(image_base64)

            lang_hint = ""
            if source_lang:
                lang_name = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
                lang_hint = f" The text is likely in {lang_name}."

            prompt = (
                f"Extract ALL visible text from this image exactly as written."
                f"{lang_hint}\n"
                f"Return ONLY the extracted text, preserving line breaks. "
                f"If no text is found, return 'No text detected'."
            )

            response = model.generate_content([
                prompt,
                {"mime_type": "image/jpeg", "data": image_bytes},
            ])

            return response.text.strip()
        except Exception as e:
            logger.error(f"OCR extraction error: {e}")
            return f"[OCR error: {str(e)[:100]}]"
