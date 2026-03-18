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
    # Cultural tones (Phase 5.2)
    "street", "taglish", "respectful", "direct",
]

# ─── Cultural Tone Strategy Injections ───
TONE_STRATEGIES: dict[str, str] = {
    "formal": (
        "Use deep, formal regional vocabulary (e.g., 'mabulakon' not 'nindot' in Cebuano, "
        "'mapagmahal' not 'mahal' in Tagalog). "
        "Absolutely zero Taglish or slang. Use full, grammatically complete sentences."
    ),
    "street": (
        "Inject tropa-slang naturally: use 'omsim', 'lodi', 'petmalu', 'lels', 'mars', 'bes', "
        "'grabe', 'charot', 'gets mo?', 'pak ganern' as appropriate for the regional language. "
        "Sound like a teenager from Manila or Cebu streets."
    ),
    "taglish": (
        "Use natural Filipino code-switching: mix English nouns/verbs with Filipino affixes "
        "(e.g., 'i-print mo', 'na-receive ko na', 'mag-check ka'). "
        "English for technical terms, Filipino for connectors. Sound natural, not forced."
    ),
    "respectful": (
        "For Tagalog: force Po/Opo honorifics in every sentence. "
        "For Cebuano/Hiligaynon: use soft, indirect phrasing — avoid direct commands. "
        "Add 'kung maaari', 'nais kong', 'kung pwede po', 'pakisuyo'. Sound gentle and deferential."
    ),
    "direct": (
        "Maximum brevity — use the fewest words possible. "
        "Imperatives only: no pleasantries, no filler words. "
        "Ideal for emergencies and urgent commands. Every word must carry weight."
    ),
}

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
                # Inject cultural strategy if available
                strategy = TONE_STRATEGIES.get(tone)
                if strategy:
                    parts.append(f"STRATEGY: {strategy}")
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
            # Phase 7.1: Retry once with neutral tone before giving up
            if tone and tone != "neutral":
                logger.info("Retrying with neutral tone as fallback...")
                try:
                    return TranslationService.translate_text(
                        text=text,
                        source_lang=source_lang,
                        target_lang=target_lang,
                        tone=None,
                        community_phrases=community_phrases,
                    )
                except Exception as e2:
                    logger.error(f"Fallback also failed: {e2}")
            return {
                "input_text": text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "output_text": "(Try again)",  # Phase 7.2: user-friendly error
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

    # ────────────────── Refinement (Phase 12.1) ──────────────────

    @staticmethod
    def refine_and_translate(
        original_text: str,
        source_lang: str,
        target_langs: List[str],
        new_tone: str,
    ) -> dict:
        """
        Phase 12.1 Refinement Pipeline:
        Rewrite source text to match new_tone, then translate to target_langs.
        """
        api_key = TranslationService._get_api_key()
        if not api_key:
            res = TranslationService.translate_multi(original_text, source_lang, target_langs, new_tone)
            return {
                "original_text": original_text,
                "refined_text": original_text,
                "source_lang": source_lang,
                "target_langs": target_langs,
                "output_texts": res["output_texts"],
                "tone": new_tone,
            }

        try:
            strategy = TONE_STRATEGIES.get(new_tone, "natural expression")
            src_name = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
            tgt_names = [SUPPORTED_LANGUAGES.get(l, l) for l in target_langs]

            prompt = (
                f"SOURCE_LANG: {src_name}\n"
                f"TONE_STRATEGY: {strategy}\n"
                f"TEXT: {original_text}\n"
                f"TARGET_LANGS: {', '.join(tgt_names)}\n\n"
                "TASK:\n"
                f"1. Rewrite the TEXT in {src_name} to perfectly match the TONE_STRATEGY.\n"
                f"2. Translate that rewritten text into each of the TARGET_LANGS using the SAME strategy.\n\n"
                "Reply ONLY with JSON: {\"refined\": \"...\", \"translations\": {\"lang_code\": \"text\", ...}}\n"
                "Use provided lang_codes (tl, ceb, hil, en) as keys."
            )

            url = f"{API_BASE}/models/{MODEL}:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 512,
                    "responseMimeType": "application/json",
                },
            }

            with httpx.Client(timeout=15.0) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
                raw = response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                parsed = json.loads(raw)
                
                refined = parsed.get("refined", original_text)
                trans_map = parsed.get("translations", {})
                
                output_texts = []
                for lang in target_langs:
                    output_texts.append(trans_map.get(lang, "(Translation failed)"))

                return {
                    "original_text": original_text,
                    "refined_text": refined,
                    "source_lang": source_lang,
                    "target_langs": target_langs,
                    "output_texts": output_texts,
                    "tone": new_tone,
                }
        except Exception as e:
            logger.error(f"Refinement error: {e}")
            res = TranslationService.translate_multi(original_text, source_lang, target_langs, new_tone)
            return {
                "original_text": original_text,
                "refined_text": original_text,
                "source_lang": source_lang,
                "target_langs": target_langs,
                "output_texts": res["output_texts"],
                "tone": new_tone,
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
