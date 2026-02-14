"""
Translation Service — Context-Aware AI Translations via Gemini API
Supports: single, multi-target, conversation, community-driven, and tone detection
"""
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


class TranslationService:
    """Context-aware translation using Gemini API"""

    _model = None

    @classmethod
    def _get_model(cls):
        if cls._model is None and settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            cls._model = genai.GenerativeModel("gemini-2.0-flash")
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
        detected_tone = TranslationService.detect_tone(text)
        tone_to_use = tone or detected_tone
        model = TranslationService._get_model()

        if not model:
            translated = TranslationService._mock_translate(text, source_lang, target_lang)
        else:
            try:
                src = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
                tgt = SUPPORTED_LANGUAGES.get(target_lang, target_lang)

                # Build community context if available
                community_ctx = ""
                if community_phrases:
                    pairs = "; ".join(
                        f'"{p["phrase"]}" → "{p["proposed_translation"]}"'
                        for p in community_phrases[:10]
                    )
                    community_ctx = (
                        f"\n\nCommunity-contributed translations for reference "
                        f"(use these if the input matches):\n{pairs}\n"
                    )

                prompt = (
                    f"You are Ano-Kamo?, an expert AI translator specializing in "
                    f"Filipino languages (Tagalog, Cebuano, Hiligaynon, English).\n\n"
                    f"RULES:\n"
                    f"- Translate the text from {src} to {tgt}.\n"
                    f"- Use a {tone_to_use} tone.\n"
                    f"- Produce natural, culturally appropriate translations.\n"
                    f"- Handle mixed-language input (e.g. Taglish like 'nag-drive').\n"
                    f"- Preserve idioms and slang meaning, do NOT translate literally.\n"
                    f"- Return ONLY the translated text, no explanations or quotes.\n"
                    f"{community_ctx}\n"
                    f"Text to translate:\n{text}"
                )

                response = model.generate_content(prompt)
                translated = response.text.strip().strip('"').strip("'")
            except Exception as e:
                logger.error(f"Gemini translation error: {e}")
                translated = TranslationService._mock_translate(text, source_lang, target_lang)

        return {
            "input_text": text,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "output_text": translated,
            "tone": tone_to_use,
            "detected_tone": detected_tone,
        }

    @staticmethod
    def translate_multi(
        text: str,
        source_lang: str,
        target_langs: List[str],
        tone: Optional[str] = None,
        community_phrases: Optional[List[dict]] = None,
    ) -> dict:
        detected_tone = TranslationService.detect_tone(text)
        tone_to_use = tone or detected_tone
        translations = []
        for tl in target_langs:
            r = TranslationService.translate_text(
                text, source_lang, tl, tone_to_use, community_phrases
            )
            translations.append(r["output_text"])
        return {
            "input_text": text,
            "source_lang": source_lang,
            "target_langs": target_langs,
            "output_texts": translations,
            "tone": tone_to_use,
            "detected_tone": detected_tone,
        }

    # ────────────────── Tone Detection ──────────────────

    @staticmethod
    def detect_tone(text: str) -> str:
        model = TranslationService._get_model()
        if not model:
            return TranslationService._heuristic_tone(text)
        try:
            prompt = (
                f"Analyze the emotional tone of this text. "
                f"Choose exactly ONE from: {', '.join(AVAILABLE_TONES)}.\n"
                f"Return ONLY the single tone word, nothing else.\n\n"
                f"Text: {text}"
            )
            response = model.generate_content(prompt)
            tone = response.text.strip().lower()
            return tone if tone in AVAILABLE_TONES else "neutral"
        except Exception:
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
        if key in mocks:
            return mocks[key]
        return f"[{SUPPORTED_LANGUAGES.get(target_lang, target_lang)}] {text}"
