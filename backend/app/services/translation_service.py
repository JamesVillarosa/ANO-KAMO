"""
Translation Service
Handles translation logic with Gemini API
"""
import logging
from typing import Optional

import google.generativeai as genai
from app.core.config import settings

logger = logging.getLogger(__name__)

# Supported languages
SUPPORTED_LANGUAGES = {
    "tl": "Tagalog",
    "ceb": "Cebuano",
    "hil": "Hiligaynon",
    "en": "English",
}

# Tone options
AVAILABLE_TONES = ["neutral", "formal", "casual", "friendly", "technical"]


class TranslationService:
    """Service for handling translations"""

    @staticmethod
    def _get_gemini_model():
        """Initialize and return Gemini model"""
        if not settings.GEMINI_API_KEY:
            return None
        genai.configure(api_key=settings.GEMINI_API_KEY)
        return genai.GenerativeModel("gemini-2.0-flash")

    @staticmethod
    def translate_text(
        text: str,
        source_lang: str,
        target_lang: str,
        tone: Optional[str] = None,
    ) -> dict:
        """
        Translate text from source language to target language using Gemini API
        """
        logger.info(f"Translating: '{text}' from {source_lang} to {target_lang}")

        detected_tone = TranslationService.detect_tone(text)
        tone_to_use = tone or detected_tone

        model = TranslationService._get_gemini_model()
        
        if not model or settings.GEMINI_API_KEY.startswith("sk-placeholder"):
            logger.warning("Using mock translation (Gemini API not configured correctly)")
            translated = TranslationService._mock_translate(
                text, source_lang, target_lang, tone_to_use
            )
        else:
            try:
                src_full = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
                tgt_full = SUPPORTED_LANGUAGES.get(target_lang, target_lang)
                
                prompt = (
                    f"You are a professional translator for Filipino languages.\n"
                    f"Translate the following text from {src_full} to {tgt_full}.\n"
                    f"Maintain a {tone_to_use} tone.\n"
                    f"Return ONLY the translated text without any explanations or quotes.\n\n"
                    f"Text: {text}"
                )
                
                response = model.generate_content(prompt)
                translated = response.text.strip()
            except Exception as e:
                logger.error(f"Gemini API error: {e}")
                translated = TranslationService._mock_translate(
                    text, source_lang, target_lang, tone_to_use
                )

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
        target_langs: list[str],
        tone: Optional[str] = None,
    ) -> dict:
        """
        Translate text to multiple target languages
        """
        logger.info(f"Multi-translating: '{text}' from {source_lang} to {target_langs}")

        detected_tone = TranslationService.detect_tone(text)
        tone_to_use = tone or detected_tone

        translations = []
        for target_lang in target_langs:
            result = TranslationService.translate_text(text, source_lang, target_lang, tone_to_use)
            translations.append(result["output_text"])

        return {
            "input_text": text,
            "source_lang": source_lang,
            "target_langs": target_langs,
            "output_texts": translations,
            "tone": tone_to_use,
            "detected_tone": detected_tone,
        }

    @staticmethod
    def detect_tone(text: str) -> str:
        """
        Detect tone/sentiment of input text using Gemini if available
        """
        model = TranslationService._get_gemini_model()
        
        if not model or settings.GEMINI_API_KEY.startswith("sk-placeholder"):
            # Fallback to simple heuristics
            text_lower = text.lower()
            if any(word in text_lower for word in ["!", "wow", "amazing", "love", "great"]):
                return "enthusiastic"
            elif any(word in text_lower for word in ["?", "sorry", "please", "thank"]):
                return "polite"
            elif any(word in text_lower for word in ["hey", "yo", "gonna", "lol"]):
                return "casual"
            return "neutral"
        
        try:
            prompt = (
                f"Analyze the tone of the following text. "
                f"Choose exactly one from: {', '.join(AVAILABLE_TONES)} or 'enthusiastic', 'polite'.\n"
                f"Return ONLY the tone word.\n\n"
                f"Text: {text}"
            )
            response = model.generate_content(prompt)
            return response.text.strip().lower()
        except Exception:
            return "neutral"

    @staticmethod
    def _mock_translate(
        text: str, source_lang: str, target_lang: str, tone: str = "neutral"
    ) -> str:
        """
        Generate mock translation for development fallback
        """
        mock_phrases = {
            ("Hello", "en", "tl"): "Halo",
            ("Hello", "en", "ceb"): "Halo",
            ("How are you?", "en", "tl"): "Paano ka?",
            ("How are you?", "en", "ceb"): "Paano ka?",
            ("I love you", "en", "tl"): "Mahal kita",
            ("I love you", "en", "ceb"): "Gugma ka nako",
            ("Thank you", "en", "tl"): "Salamat",
            ("Thank you", "en", "ceb"): "Salamat",
            ("Goodbye", "en", "tl"): "Paalam",
            ("Goodbye", "en", "ceb"): "Paalam",
        }

        key = (text, source_lang, target_lang)
        if key in mock_phrases:
            return mock_phrases[key]

        return f"[{target_lang.upper()}] {text}"
