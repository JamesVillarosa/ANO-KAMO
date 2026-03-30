"""
OCR Service — Text extraction and translation via Gemini Vision.
Single-call approach: OCR + translate + bounding boxes in one Gemini API call.
No Tesseract dependency required.
"""
import base64
import io
import json
import logging
import re
from typing import Optional, List

import httpx
from PIL import Image, ImageOps

from app.core.config import settings
from app.services.translation_service import TranslationService, SUPPORTED_LANGUAGES

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_MODEL = "gemini-2.5-flash-lite"

logger = logging.getLogger(__name__)


def _fix_base64_padding(b64_string: str) -> str:
    """Fix base64 padding to prevent 'Incorrect padding' errors."""
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
    b64_string = b64_string.strip()
    b64_string = re.sub(r'[^A-Za-z0-9+/=]', '', b64_string)
    missing_padding = len(b64_string) % 4
    if missing_padding:
        b64_string += "=" * (4 - missing_padding)
    return b64_string


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences from Gemini responses."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        inner = lines[1:-1] if len(lines) > 2 else lines[1:]
        text = "\n".join(inner).strip()
    return text


class OcrService:
    """OCR using Gemini Vision — single-call OCR + translation + bounding boxes."""

    # ─── Main: Full OCR with Gemini Vision ───

    @staticmethod
    def process_full_ocr(
        image_base64: str,
        source_lang: Optional[str] = None,
        target_lang: str = "en",
    ) -> dict:
        """
        Full OCR using Gemini Vision.
        Single API call: detects text blocks, translates, and returns
        approximate bounding box coordinates (similar to Google Translate camera).
        """
        raw = ""
        try:
            fixed_b64 = _fix_base64_padding(image_base64)
            image_bytes = base64.b64decode(fixed_b64)
            image = Image.open(io.BytesIO(image_bytes))
            image = ImageOps.exif_transpose(image)  # Fix EXIF rotation (portrait photos)
            img_width, img_height = image.size

            # Normalize to JPEG for Gemini (handles PNG, HEIC, WEBP, etc.)
            buf = io.BytesIO()
            image.convert("RGB").save(buf, format="JPEG", quality=85)
            clean_bytes = buf.getvalue()

            if not settings.GEMINI_API_KEY:
                return {
                    "blocks": [],
                    "image_width": img_width,
                    "image_height": img_height,
                    "full_extracted_text": "",
                    "full_translated_text": "",
                    "error": "Gemini API not configured",
                }

            src_name = SUPPORTED_LANGUAGES.get(source_lang or "", "Filipino")
            tgt_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)
            lang_hint = f"The text is primarily in {src_name}. " if source_lang else ""

            prompt = (
                f"You are an expert OCR and translation assistant analyzing a photo.\n\n"
                f"{lang_hint}"
                f"Task: Find ALL readable text in this image (signs, labels, menus, products, "
                f"documents, anything with text). For each text group:\n"
                f"1. Extract the original text exactly as it appears\n"
                f"2. Translate it to {tgt_name}\n"
                f"3. Estimate its bounding box as NORMALIZED coordinates (values 0.0 to 1.0)\n\n"
                f"RULES:\n"
                f"- Only include clear, intentional text — skip background textures or watermarks\n"
                f"- Group text that belongs together on the same sign or label as ONE block\n"
                f"- box format: [x, y, width, height] where (x,y) is the top-left corner\n"
                f"  All values are fractions of image dimensions (0.0 = left/top, 1.0 = right/bottom)\n"
                f"  Example: a sign in the top-left quarter might be [0.05, 0.05, 0.4, 0.15]\n"
                f"- If text is already in {tgt_name}, set translated = original text\n"
                f"- Translate accurately and naturally\n\n"
                f"Return ONLY valid JSON with no markdown fences:\n"
                f'{{ "blocks": [ {{ "text": "original", "translated": "translation", "box": [x, y, w, h] }} ] }}\n\n'
                f"If no readable text is found, return: {{ \"blocks\": [] }}"
            )

            url = f"{GEMINI_API_BASE}/models/{GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {
                            "mime_type": "image/jpeg",
                            "data": base64.b64encode(clean_bytes).decode("utf-8"),
                        }},
                    ]
                }],
                "generationConfig": {"temperature": 0.0, "maxOutputTokens": 2048},
            }

            with httpx.Client(timeout=45.0) as client:
                resp = client.post(url, json=payload)
            if resp.status_code != 200:
                raise Exception(f"Gemini API {resp.status_code}: {resp.text[:200]}")

            raw = _strip_code_fences(
                resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            )
            parsed = json.loads(raw)
            raw_blocks = parsed.get("blocks", [])

            result_blocks = []
            all_texts = []
            all_translated = []

            for block in raw_blocks:
                text = str(block.get("text", "")).strip()
                translated = str(block.get("translated", "")).strip()
                box = block.get("box", [])

                if not text or len(box) < 4:
                    continue

                try:
                    bx, by, bw, bh = float(box[0]), float(box[1]), float(box[2]), float(box[3])
                except (TypeError, ValueError):
                    continue

                # Gemini may return pixel coords if it ignores the normalized instruction.
                # Heuristic: if any value > 1.5, treat as pixel coordinates directly.
                if bx > 1.5 or by > 1.5 or bw > 1.5 or bh > 1.5:
                    px = max(0, int(bx))
                    py = max(0, int(by))
                    pw = max(10, min(int(bw), img_width - px))
                    ph = max(10, min(int(bh), img_height - py))
                else:
                    # Normalized → pixel
                    px = max(0, int(bx * img_width))
                    py = max(0, int(by * img_height))
                    pw = max(10, min(int(bw * img_width), img_width - px))
                    ph = max(10, min(int(bh * img_height), img_height - py))

                result_blocks.append({
                    "text": text,
                    "translated_text": translated or text,
                    "box": [px, py, pw, ph],
                    "confidence": 95.0,
                })
                all_texts.append(text)
                all_translated.append(translated or text)

            full_text = "\n".join(all_texts)
            full_translated = "\n".join(all_translated)

            logger.info(f"Gemini Vision OCR: {len(result_blocks)} blocks from {img_width}x{img_height}")

            return {
                "blocks": result_blocks,
                "image_width": img_width,
                "image_height": img_height,
                "full_extracted_text": full_text,
                "full_translated_text": full_translated,
            }

        except json.JSONDecodeError as e:
            raw_preview = raw[:300] if raw else "N/A"
            logger.error(f"Gemini OCR JSON parse error: {e} — raw: {raw_preview}")
            return {
                "blocks": [],
                "image_width": 0,
                "image_height": 0,
                "full_extracted_text": "",
                "full_translated_text": "",
                "error": "Could not parse OCR response. Please try again.",
            }
        except Exception as e:
            logger.error(f"Gemini Vision OCR error: {type(e).__name__}: {e}")
            return {
                "blocks": [],
                "image_width": 0,
                "image_height": 0,
                "full_extracted_text": "",
                "full_translated_text": "",
                "error": str(e),
            }

    # ─── Batch Translation (used by /ocr/translate-blocks endpoint) ───

    @staticmethod
    def _batch_translate(
        texts: List[str],
        source_lang: str,
        target_lang: str,
        context: str = "signage or menu",
    ) -> List[str]:
        """Translate multiple text blocks in a single Gemini call for efficiency."""
        if not texts:
            return []

        if source_lang == target_lang:
            return texts[:]

        if not settings.GEMINI_API_KEY:
            results = []
            for text in texts:
                try:
                    r = TranslationService.translate_text(text, source_lang, target_lang)
                    results.append(r.get("output_text", text))
                except Exception:
                    results.append(text)
            return results

        src_name = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
        tgt_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)
        numbered_lines = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))

        prompt = (
            f"Translate each numbered text from {src_name} to {tgt_name}.\n"
            f"Context: {context}.\n"
            f"Rules:\n"
            f"1. Output ONLY numbered translations in the exact same order.\n"
            f"2. One translation per line, prefixed with its number.\n"
            f"3. No explanations, no original text, no extra lines.\n\n"
            f"{numbered_lines}"
        )

        try:
            url = f"{GEMINI_API_BASE}/models/{GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.0, "maxOutputTokens": 1024},
            }
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, json=payload)
            if resp.status_code != 200:
                raise Exception(f"Gemini API {resp.status_code}: {resp.text[:200]}")
            response_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            return OcrService._parse_numbered_response(response_text.strip(), len(texts))
        except Exception as e:
            logger.error(f"Batch translate error: {e}")
            return texts[:]

    @staticmethod
    def _parse_numbered_response(response_text: str, expected_count: int) -> List[str]:
        """Parse a numbered list response from Gemini into individual strings."""
        lines = response_text.strip().split("\n")
        results = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            cleaned = re.sub(r"^\d+[\.\)\-]\s*", "", line)
            if cleaned:
                results.append(cleaned)
        while len(results) < expected_count:
            results.append("")
        return results[:expected_count]

    # ─── Legacy: simple extract + translate (no bounding boxes) ───

    @staticmethod
    def extract_and_translate(
        image_base64: str,
        target_lang: str,
        source_lang: Optional[str] = None,
    ) -> dict:
        """Legacy endpoint: extract text from image and translate it (no bounding boxes)."""
        fixed_b64 = _fix_base64_padding(image_base64)
        extracted_text = OcrService._extract_text(fixed_b64, source_lang)
        detected_language = source_lang or "tl"

        if not extracted_text or extracted_text.startswith("["):
            return {
                "extracted_text": extracted_text or "No text detected",
                "translated_text": "",
                "detected_language": detected_language,
            }

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
        """Extract text from a base64 image using Gemini Vision."""
        if not settings.GEMINI_API_KEY:
            return "[OCR unavailable — Gemini API not configured]"
        try:
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
            url = f"{GEMINI_API_BASE}/models/{GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {
                            "mime_type": "image/jpeg",
                            "data": base64.b64encode(image_bytes).decode("utf-8"),
                        }},
                    ]
                }],
                "generationConfig": {"temperature": 0.0, "maxOutputTokens": 1024},
            }
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, json=payload)
            if resp.status_code != 200:
                raise Exception(f"Gemini API {resp.status_code}: {resp.text[:200]}")
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            logger.error(f"OCR extraction error: {e}")
            return f"[OCR error: {str(e)[:100]}]"
