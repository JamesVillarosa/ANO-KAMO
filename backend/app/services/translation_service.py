"""
Translation Service — Minimal-token AI Translations via Gemini 1.5 Flash
Uses a single API call with a system instruction for translation + tone detection.
"""
import json
import logging
from typing import Optional, List

import google.generativeai as genai
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

# ─── System instruction (cached once, never re-sent per call) ───

SYSTEM_INSTRUCTION = (
    "You are Ano-Kamo?, a Filipino-language translator. "
    "Reply ONLY with a JSON object: {\"t\":\"<translated text>\",\"tone\":\"<detected tone>\"}. "
    "Tones: neutral, polite, angry, joking, sarcastic, playful, formal, informal. "
    "Rules: natural culturally-appropriate translation; handle Taglish/code-switching; "
    "preserve idiom meaning; never translate literally; no explanations."
)


class TranslationService:
    """Single-call translation using Gemini 1.5 Flash with system instruction."""

    _model = None

    @classmethod
    def _get_model(cls):
        if cls._model is None and settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            cls._model = genai.GenerativeModel(
                "gemini-1.5-flash", # Model name as positional argument
                system_instruction=SYSTEM_INSTRUCTION,
                generation_config=genai.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=256,
                    response_mime_type="application/json",
                ),
            )
        return cls._model

    # ────────────────── Core Translation ──────────────────

    @staticmethod
    def translate_text(
        text: str,
        source_lang: str,
        target_lang: str,
        tone: Optional[str] = None,
        community_phrases: Optional[List[dict]] = None,
    ) -> dict:
        model = TranslationService._get_model()

        if not model:
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

            # Build compact prompt — keep user message minimal
            parts = [f"{src}→{tgt}"]
            if tone:
                parts.append(f"tone:{tone}")
            if community_phrases:
                pairs = ";".join(
                    f'{p["phrase"]}={p["proposed_translation"]}'
                    for p in community_phrases[:5]
                )
                parts.append(f"ref:{pairs}")
            parts.append(text)

            prompt = "|".join(parts)

            response = model.generate_content(prompt)
            raw = response.text.strip()

            # Parse JSON response
            parsed = _parse_response(raw)
            translated = parsed.get("t", raw)
            detected = parsed.get("tone", "neutral")

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
            logger.error(f"Gemini error: {e}")
            detected = TranslationService._heuristic_tone(text)
            return {
                "input_text": text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "output_text": TranslationService._mock_translate(text, source_lang, target_lang),
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

    # ────────────────── Tone Detection (local, no API) ──────────────────

    @staticmethod
    def detect_tone(text: str) -> str:
        """Heuristic-only tone detection — no API call."""
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
        }
        key = (text, source_lang, target_lang)
        return mocks.get(key, f"[{SUPPORTED_LANGUAGES.get(target_lang, target_lang)}] {text}")


# ─── Helper ───

def _parse_response(raw: str) -> dict:
    """Extract JSON from model response, handling markdown fences."""
    text = raw.strip()
    if text.startswith("```"):
        # Strip ```json ... ```
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fallback: treat entire response as plain translated text
        return {"t": raw.strip().strip('"').strip("'"), "tone": "neutral"}
