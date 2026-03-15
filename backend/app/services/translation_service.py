"""
Translation Service — AI Translations via Google Gemini
Uses direct Gemini REST API (v1beta) for reliability.
Model: gemini-2.5-flash-lite (fast, cheap, accurate for Filipino languages)
"""
import json
import logging
import traceback
from typing import Optional, List

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {
    "tl": "Tagalog",
    "ceb": "Cebuano",
    "hil": "Hiligaynon",
    "en": "English",
}

AVAILABLE_TONES = [
    "neutral", "polite", "angry", "joking",
    "sarcastic", "playful", "formal", "informal",
]

SYSTEM_INSTRUCTION = (
    "You are Ano-Kamo?, a Filipino-language translator. "
    'Reply ONLY with a JSON object: {"t":"<translated text>","tone":"<detected tone>"}. '
    "Tones: neutral, polite, angry, joking, sarcastic, playful, formal, informal. "
    "Rules: natural culturally-appropriate translation; handle Taglish/code-switching; "
    "preserve idiom meaning; never translate literally; no explanations."
)

MODEL = "gemini-2.5-flash-lite"
API_BASE = "https://generativelanguage.googleapis.com/v1beta"


class TranslationService:
    """Translation using Gemini REST API directly."""

    @classmethod
    def _get_api_key(cls) -> Optional[str]:
        key = settings.GEMINI_API_KEY
        if not key:
            logger.error("GEMINI_API_KEY is empty")
            return None
        return key

    # ────────────────── Core Translation ──────────────────

    @staticmethod
    def translate_text(
        text: str,
        source_lang: str,
        target_lang: str,
        tone: Optional[str] = None,
        community_phrases: Optional[List[dict]] = None,
    ) -> dict:
        api_key = TranslationService._get_api_key()

        if not api_key:
            logger.error("No API key — using mock.")
            translated = TranslationService._mock_translate(text, source_lang, target_lang)
            detected = TranslationService._heuristic_tone(text)
            return {
                "input_text": text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "output_text": translated,
                "tone": tone or detected,
                "detected_tone": detected,
            }

        try:
            src = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
            tgt = SUPPORTED_LANGUAGES.get(target_lang, target_lang)

            # Build prompt
            parts = [f"{src}→{tgt}"]
            if tone:
                parts.append(f"tone:{tone}")
            if community_phrases:
                pairs = "; ".join(
                    f'{p["phrase"]} → {p["proposed_translation"]}'
                    for p in community_phrases[:10]
                )
                parts.append(f"COMMUNITY GLOSSARY (use these verified translations): {pairs}")
            parts.append(text)
            prompt = "|".join(parts)

            logger.info(f"Gemini prompt: {prompt}")

            # Direct REST API call
            url = f"{API_BASE}/models/{MODEL}:generateContent?key={api_key}"
            payload = {
                "system_instruction": {
                    "parts": [{"text": SYSTEM_INSTRUCTION}]
                },
                "contents": [
                    {"parts": [{"text": prompt}]}
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 256,
                    "responseMimeType": "application/json",
                },
            }

            with httpx.Client(timeout=15.0) as client:
                response = client.post(url, json=payload)

            if response.status_code != 200:
                error_body = response.text
                logger.error(f"Gemini API error {response.status_code}: {error_body[:300]}")
                raise Exception(f"API {response.status_code}: {error_body[:200]}")

            result = response.json()
            raw = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            logger.info(f"Gemini raw response: {raw}")

            parsed = _parse_response(raw)
            translated = parsed.get("t", "")
            detected = parsed.get("tone", "neutral")

            if not translated:
                translated = raw
                logger.warning(f"No 't' key in parsed response, using raw: {raw}")

            if detected not in AVAILABLE_TONES:
                detected = "neutral"

            return {
                "input_text": text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "output_text": translated,
                "tone": tone or detected,
                "detected_tone": detected,
            }
        except Exception as e:
            logger.error(f"Gemini API call error: {type(e).__name__}: {e}\n{traceback.format_exc()}")
            detected = TranslationService._heuristic_tone(text)
            return {
                "input_text": text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "output_text": f"(Translation error: {type(e).__name__})",
                "tone": tone or detected,
                "detected_tone": detected,
            }

    # ────────────────── Multi-target ──────────────────

    @staticmethod
    def translate_multi(
        text: str,
        source_lang: str,
        target_langs: List[str],
        tone: Optional[str] = None,
        community_phrases: Optional[List[dict]] = None,
    ) -> dict:
        first = TranslationService.translate_text(
            text, source_lang, target_langs[0], tone, community_phrases
        )
        detected = first["detected_tone"]
        translations = [first["output_text"]]

        for tl in target_langs[1:]:
            r = TranslationService.translate_text(
                text, source_lang, tl, tone, community_phrases
            )
            translations.append(r["output_text"])

        return {
            "input_text": text,
            "source_lang": source_lang,
            "target_langs": target_langs,
            "output_texts": translations,
            "tone": tone or detected,
            "detected_tone": detected,
        }

    # ────────────────── Tone Detection (local) ──────────────────

    @staticmethod
    def detect_tone(text: str) -> str:
        return TranslationService._heuristic_tone(text)

    @staticmethod
    def _heuristic_tone(text: str) -> str:
        t = text.lower()
        if any(w in t for w in ["!", "wow", "amazing", "love"]):
            return "playful"
        if any(w in t for w in ["?", "please", "thank", "po", "opo"]):
            return "polite"
        if any(w in t for w in ["hey", "yo", "lol", "haha"]):
            return "joking"
        return "neutral"

    # ────────────────── Mock Fallback ──────────────────

    @staticmethod
    def _mock_translate(text: str, source_lang: str, target_lang: str) -> str:
        mocks = {
            ("Hello", "en", "tl"): "Halo",
            ("Hello", "en", "ceb"): "Halo",
            ("How are you?", "en", "tl"): "Kumusta ka?",
            ("How are you?", "en", "ceb"): "Kumusta ka?",
            ("I love you", "en", "tl"): "Mahal kita",
            ("I love you", "en", "ceb"): "Gugma ko ikaw",
            ("Thank you", "en", "tl"): "Salamat",
            ("Good morning", "en", "tl"): "Magandang umaga",
            ("Good morning", "en", "ceb"): "Maayong buntag",
            ("Good morning", "en", "hil"): "Maayong aga",
            ("Magandang Umaga", "tl", "ceb"): "Maayong buntag",
            ("Magandang umaga", "tl", "ceb"): "Maayong buntag",
            ("Magandang Umaga", "tl", "hil"): "Maayong aga",
            ("Magandang umaga", "tl", "hil"): "Maayong aga",
        }
        key = (text, source_lang, target_lang)
        result = mocks.get(key)
        if result:
            return result
        text_lower = text.lower()
        for (k_text, k_src, k_tgt), v in mocks.items():
            if k_text.lower() == text_lower and k_src == source_lang and k_tgt == target_lang:
                return v
        target_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)
        return f"(Gemini unavailable — no mock for {target_name})"


# ─── Helper ───

def _parse_response(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse failed: {e} — raw: {raw}")
        return {"t": raw.strip().strip('"').strip("'"), "tone": "neutral"}
