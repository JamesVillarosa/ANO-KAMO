"""
OCR Service — Text extraction from images
- Tesseract: scan for bounding boxes (real-time overlay)
- Gemini Vision: full extract + translate (post-capture)
- Translation integration: translate extracted blocks via Gemini
"""
import logging
import base64
import io
import re
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

# Minimum confidence threshold for Tesseract text detection
MIN_CONFIDENCE_SCAN = 50      # For live scan (stricter to avoid noise)
MIN_CONFIDENCE_FULL = 40      # For full OCR (slightly relaxed)

# Minimum character length for a valid text block
MIN_TEXT_LENGTH = 2


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


def _is_real_text(text: str) -> bool:
    """
    Filter out noise: single chars, pure symbols, pure numbers, etc.
    Returns True only if the text looks like a real word/phrase.
    """
    if len(text) < MIN_TEXT_LENGTH:
        return False

    # Count actual letters (any alphabet)
    letter_count = sum(1 for c in text if c.isalpha())

    # Must have at least 2 letters
    if letter_count < 2:
        return False

    # Reject if less than 40% letters (i.e., mostly symbols/numbers)
    if letter_count / len(text) < 0.4:
        return False

    return True


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
        """
        try:
            fixed_b64 = _fix_base64_padding(image_base64)
            image_bytes = base64.b64decode(fixed_b64)
            image = Image.open(io.BytesIO(image_bytes))
            img_width, img_height = image.size

            tess_lang = TESSERACT_LANG_MAP.get(source_lang, "eng+fil")

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
                if not text or conf < MIN_CONFIDENCE_SCAN:
                    continue

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

            # Build result blocks — filter out noise
            blocks = []
            for line in lines.values():
                avg_conf = line["conf"] / line["count"] if line["count"] > 0 else 0
                text = line["text"].strip()

                # Skip non-real text (noise, single chars, symbols)
                if not _is_real_text(text):
                    continue

                blocks.append({
                    "text": text,
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

    # ─── Tesseract + Translation: scan + translate each block ───

    @staticmethod
    def scan_and_translate(
        image_base64: str,
        source_lang: str = "tl",
        target_lang: str = "en",
    ) -> dict:
        """
        Extract text blocks with Tesseract, then translate each block
        using Gemini. For real-time camera overlay with translation.
        """
        scan_result = OcrService.scan_text_blocks(image_base64, source_lang)

        if scan_result.get("error") or not scan_result.get("blocks"):
            return {
                "blocks": [],
                "image_width": scan_result.get("image_width", 0),
                "image_height": scan_result.get("image_height", 0),
                "error": scan_result.get("error"),
            }

        blocks = scan_result["blocks"]
        all_texts = [b["text"] for b in blocks]

        # If source and target are the same, no translation needed
        if source_lang == target_lang:
            result_blocks = []
            for block in blocks:
                result_blocks.append({
                    "text": block["text"],
                    "translated_text": block["text"],
                    **{k: block[k] for k in ("x", "y", "width", "height", "confidence")},
                })
            return {
                "blocks": result_blocks,
                "image_width": scan_result["image_width"],
                "image_height": scan_result["image_height"],
            }

        try:
            translated_texts = OcrService._batch_translate(
                texts=all_texts,
                source_lang=source_lang,
                target_lang=target_lang,
                context="signage, menu, or label",
            )
        except Exception as e:
            logger.error(f"Batch translation error: {e}")
            translated_texts = ["" for _ in all_texts]

        result_blocks = []
        for i, block in enumerate(blocks):
            result_blocks.append({
                "text": block["text"],
                "translated_text": translated_texts[i] if i < len(translated_texts) else "",
                "x": block["x"],
                "y": block["y"],
                "width": block["width"],
                "height": block["height"],
                "confidence": block.get("confidence", 0),
            })

        return {
            "blocks": result_blocks,
            "image_width": scan_result["image_width"],
            "image_height": scan_result["image_height"],
        }

    # ─── Full OCR: high-res image → extract + translate + coordinates ───

    @staticmethod
    def process_full_ocr(
        image_base64: str,
        source_lang: Optional[str] = None,
        target_lang: str = "en",
    ) -> dict:
        """
        Full OCR processing for captured/gallery images.
        Uses Tesseract for bounding boxes + Gemini for translation.
        """
        try:
            fixed_b64 = _fix_base64_padding(image_base64)
            image_bytes = base64.b64decode(fixed_b64)
            image = Image.open(io.BytesIO(image_bytes))
            img_width, img_height = image.size

            tess_lang = TESSERACT_LANG_MAP.get(source_lang or "tl", "eng+fil")
            data = pytesseract.image_to_data(
                image,
                lang=tess_lang,
                output_type=pytesseract.Output.DICT,
                config="--psm 6",  # Assume uniform block — better for photos
            )

            # Group words into lines
            lines: dict = {}
            n = len(data["text"])
            for i in range(n):
                text = data["text"][i].strip()
                conf = int(data["conf"][i])
                if not text or conf < MIN_CONFIDENCE_FULL:
                    continue

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

            # Build text blocks — filter noise
            raw_blocks = []
            all_texts = []
            for line in lines.values():
                avg_conf = line["conf"] / line["count"] if line["count"] > 0 else 0
                text = line["text"].strip()

                # Filter noise
                if not _is_real_text(text):
                    continue

                raw_blocks.append({
                    "text": text,
                    "x": line["x"],
                    "y": line["y"],
                    "width": line["x2"] - line["x"],
                    "height": line["y2"] - line["y"],
                    "confidence": round(avg_conf, 1),
                })
                all_texts.append(text)

            full_text = "\n".join(all_texts)

            # Batch translate all blocks
            if all_texts and source_lang != target_lang:
                try:
                    translated_texts = OcrService._batch_translate(
                        texts=all_texts,
                        source_lang=source_lang or "tl",
                        target_lang=target_lang,
                        context="signage, menu, label, or document",
                    )
                except Exception as e:
                    logger.error(f"Full OCR translation error: {e}")
                    translated_texts = all_texts[:]
            elif all_texts:
                # Same language → no translation needed
                translated_texts = all_texts[:]
            else:
                translated_texts = []

            full_translated = "\n".join(translated_texts) if translated_texts else ""

            result_blocks = []
            for i, block in enumerate(raw_blocks):
                result_blocks.append({
                    "text": block["text"],
                    "translated_text": translated_texts[i] if i < len(translated_texts) else "",
                    "box": [block["x"], block["y"], block["width"], block["height"]],
                    "confidence": block["confidence"],
                })

            logger.info(f"Full OCR: {len(result_blocks)} blocks from {img_width}x{img_height}")

            return {
                "blocks": result_blocks,
                "image_width": img_width,
                "image_height": img_height,
                "full_extracted_text": full_text,
                "full_translated_text": full_translated,
            }

        except Exception as e:
            logger.error(f"Full OCR processing error: {e}")
            return {
                "blocks": [],
                "image_width": 0,
                "image_height": 0,
                "full_extracted_text": "",
                "full_translated_text": "",
                "error": str(e),
            }

    # ─── Batch Translation via Gemini ───

    @staticmethod
    def _batch_translate(
        texts: List[str],
        source_lang: str,
        target_lang: str,
        context: str = "signage or menu",
    ) -> List[str]:
        """
        Translate multiple text blocks in a single Gemini call for efficiency.
        """
        if not texts:
            return []

        # If source == target, return as-is
        if source_lang == target_lang:
            return texts[:]

        if not settings.GEMINI_API_KEY:
            # Fallback: use TranslationService one-by-one
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

        numbered_lines = "\n".join(
            f"{i+1}. {text}" for i, text in enumerate(texts)
        )

        prompt = (
            f"You are a precise Filipino language translator specializing in Philippine regional dialects.\n"
            f"Task: Translate each numbered text from {src_name} into {tgt_name}.\n"
            f"CRITICAL: {tgt_name} is a DISTINCT Philippine language/dialect — NOT Tagalog and NOT Filipino. "
            f"Produce authentic, natural {tgt_name} translations that a native {tgt_name} speaker would use.\n"
            f"Context: texts are from {context}.\n"
            f"Rules:\n"
            f"1. Output ONLY the translations as a numbered list in the exact same order as the input.\n"
            f"2. One translation per line, prefixed with its number.\n"
            f"3. Do NOT output the original text — always translate.\n"
            f"4. Do not add explanations, notes, or any extra text.\n\n"
            f"{numbered_lines}"
        )

        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-2.5-flash-lite")
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(temperature=0.0),
            )
            response_text = response.text.strip()

            translated = OcrService._parse_numbered_response(response_text, len(texts))

            logger.info(f"Batch translated {len(texts)} texts: {src_name} → {tgt_name}")
            return translated

        except Exception as e:
            logger.error(f"Gemini batch translate error: {e}")
            return texts[:]

    @staticmethod
    def _parse_numbered_response(response_text: str, expected_count: int) -> List[str]:
        """Parse a numbered list response from Gemini into individual translations."""
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
        """Extract text from a base64 image using Gemini Vision"""
        if not settings.GEMINI_API_KEY:
            return "[OCR unavailable — Gemini API not configured]"

        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

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
