"""
OCR Service — Text extraction from images
- Gemini Vision: full extract + translate (existing)
- Tesseract: scan for bounding boxes (new, for real-time overlay)
"""
import logging
import base64
import io
from typing import Optional, List

from PIL import Image
import pytesseract

import google.generativeai as genai
from app.core.config import settings
from app.services.translation_service import TranslationService, SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)

# Map app language codes to Tesseract language codes
TESSERACT_LANG_MAP = {
    "tl": "fil",     # Filipino / Tagalog
    "en": "eng",     # English
    "ceb": "fil",    # Cebuano → Filipino (same Latin charset)
    "hil": "fil",    # Hiligaynon → Filipino (same Latin charset)
}


class OcrService:
    """OCR using Gemini Vision for translation and Tesseract for real-time scanning"""

    # ─── Tesseract: scan for bounding boxes (real-time overlay) ───

    @staticmethod
    def scan_text_blocks(
        image_base64: str,
        source_lang: str = "tl",
    ) -> dict:
        """
        Extract text blocks with bounding boxes using Tesseract.
        Returns image dimensions + list of text blocks with coordinates.
        Used for the real-time camera overlay feature.
        """
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_base64)
            image = Image.open(io.BytesIO(image_bytes))
            img_width, img_height = image.size

            # Get Tesseract language code
            tess_lang = TESSERACT_LANG_MAP.get(source_lang, "eng+fil")

            # Run Tesseract with detailed output (bounding boxes per word)
            data = pytesseract.image_to_data(
                image,
                lang=tess_lang,
                output_type=pytesseract.Output.DICT,
                config="--psm 11",  # Sparse text mode — best for signs/menus
            )

            # Group words into lines based on block_num + line_num
            lines: dict = {}
            n = len(data["text"])
            for i in range(n):
                text = data["text"][i].strip()
                conf = int(data["conf"][i])

                # Skip empty or low-confidence detections
                if not text or conf < 30:
                    continue

                # Group by (block, paragraph, line)
                key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
                if key not in lines:
                    lines[key] = {
                        "text": "",
                        "x": data["left"][i],
                        "y": data["top"][i],
                        "x2": data["left"][i] + data["width"][i],
                        "y2": data["top"][i] + data["height"][i],
                        "conf": 0,
                        "count": 0,
                    }

                line = lines[key]
                line["text"] += (" " + text) if line["text"] else text
                line["x"] = min(line["x"], data["left"][i])
                line["y"] = min(line["y"], data["top"][i])
                line["x2"] = max(line["x2"], data["left"][i] + data["width"][i])
                line["y2"] = max(line["y2"], data["top"][i] + data["height"][i])
                line["conf"] += conf
                line["count"] += 1

            # Build result blocks
            blocks = []
            for line in lines.values():
                avg_conf = line["conf"] / line["count"] if line["count"] > 0 else 0
                blocks.append({
                    "text": line["text"],
                    "x": line["x"],
                    "y": line["y"],
                    "width": line["x2"] - line["x"],
                    "height": line["y2"] - line["y"],
                    "confidence": round(avg_conf, 1),
                })

            logger.info(f"Tesseract scan: {len(blocks)} text blocks found in {img_width}x{img_height} image")

            return {
                "blocks": blocks,
                "image_width": img_width,
                "image_height": img_height,
            }

        except Exception as e:
            logger.error(f"Tesseract scan error: {e}")
            return {
                "blocks": [],
                "image_width": 0,
                "image_height": 0,
                "error": str(e),
            }

    # ─── Gemini Vision: full extract + translate (existing) ───

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
            model = genai.GenerativeModel("gemini-1.5-flash")

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
