"""
Translation Service — AI Translations via Google Gemini
Uses direct Gemini REST API (v1beta) for reliability.
Model: gemini-2.5-flash-lite (fast, cheap, accurate for Filipino languages)
"""
import hashlib
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
    "neutral", "formal", "respectful", "casual",
    "street", "taglish", "bisaya_casual", "hiligaynon_casual",
    "playful", "sarcastic", "angry", "urgent",
]

# ─── 12 Filipino Cultural Tone Strategy Injections ───
TONE_STRATEGIES: dict[str, str] = {
    "neutral": (
        "Translate naturally without any special tone. Plain, everyday Filipino."
    ),
    "formal": (
        "Use formal Filipino/Tagalog suited for professional or academic contexts. "
        "Deep, formal regional vocabulary (e.g., 'mabulakon' not 'nindot' in Cebuano, "
        "'mapagmahal' not 'mahal' in Tagalog). "
        "Absolutely zero Taglish or slang. Use full, grammatically complete sentences."
    ),
    "respectful": (
        "Use highly respectful Filipino with po, opo, and proper honorifics as Filipinos use when speaking to elders or authority figures. "
        "For Tagalog: force Po/Opo honorifics in every sentence. "
        "For Cebuano/Hiligaynon: use soft, indirect phrasing — avoid direct commands. "
        "Add 'kung maaari', 'nais kong', 'kung pwede po', 'pakisuyo'. Sound gentle and deferential."
    ),
    "casual": (
        "Use casual, relaxed Filipino as used between friends. "
        "Natural everyday conversation without excessive formality or slang."
    ),
    "street": (
        "Use Metro Manila street Filipino slang, including common Bekimon or Jejemon-influenced casual language. "
        "Inject tropa-slang naturally: use 'omsim', 'lodi', 'petmalu', 'lels', 'mars', 'bes', "
        "'grabe', 'charot', 'gets mo?', 'pak ganern' as appropriate for the regional language. "
        "Sound like a teenager from Manila or Cebu streets."
    ),
    "taglish": (
        "Mix Tagalog and English naturally as educated urban Filipinos speak, inserting English words and phrases fluidly. "
        "Use natural Filipino code-switching: mix English nouns/verbs with Filipino affixes "
        "(e.g., 'i-print mo', 'na-receive ko na', 'mag-check ka'). "
        "English for technical terms, Filipino for connectors. Sound natural, not forced."
    ),
    "bisaya_casual": (
        "Use casual Cebuano tone with natural Bisaya expressions and flow. "
        "Sound like a friendly Cebuano speaker in everyday conversation."
    ),
    "hiligaynon_casual": (
        "Use casual Hiligaynon/Ilonggo tone with natural expressions. "
        "Sound like a friendly Ilonggo speaker in everyday conversation."
    ),
    "playful": (
        "Use a playful, light, teasing tone as Filipinos use when joking with close friends. "
        "Sound fun and lighthearted (makulit)."
    ),
    "sarcastic": (
        "Use a sarcastic or ironic Filipino tone, the kind used in dry humor."
    ),
    "angry": (
        "Use a direct, forceful, emotionally intense Filipino tone. "
        "Sound frustrated or upset, as Filipinos do when expressing strong emotions."
    ),
    "urgent": (
        "Use an urgent, pressing tone that conveys immediacy. "
        "Time-sensitive, direct, action-oriented (apurahan)."
    ),
}

SYSTEM_INSTRUCTION = (
    "You are a precise Filipino language translator.\n\n"
    "ABSOLUTE RULES — never break these under any circumstance:\n"
    "1. Output ONLY a JSON object: {\"t\":\"<translated text>\",\"tone\":\"<detected tone>\"}. Nothing else.\n"
    "   No explanations, no alternatives, no notes, no markdown, no quotation marks around the output.\n"
    "2. Translate into EXACTLY the specified target language.\n"
    "   If target is Cebuano, output ONLY Cebuano.\n"
    "   If target is Hiligaynon, output ONLY Hiligaynon.\n"
    "   If target is Tagalog, output ONLY Tagalog.\n"
    "   If target is English, output ONLY English.\n"
    "3. Do not mix languages in the output unless the tone is explicitly 'taglish'.\n"
    "4. Preserve the exact meaning — do not add, remove, or alter any meaning from the source text.\n"
    "5. For Cebuano: use authentic Bisaya vocabulary. Do not substitute Tagalog words.\n"
    "6. For Hiligaynon: use authentic Ilonggo vocabulary. Do not substitute Cebuano or Tagalog words.\n"
    "7. Never invent content not present in the source text.\n"
    "8. If a word has no direct translation, keep the original word — do not substitute random words.\n"
    "9. The output language must match the target language.\n"
    "Tones: neutral, formal, respectful, casual, street, taglish, bisaya_casual, hiligaynon_casual, playful, sarcastic, angry, urgent."
)

# Language markers for output validation
LANGUAGE_MARKERS = {
    "tl": ["ang", "ng", "mga", "sa", "ay", "na", "ko", "mo", "niya", "kami", "sila", "hindi", "ito"],
    "ceb": ["nga", "ko", "ni", "kamo", "siya", "ako", "nako", "nato", "wala", "dili", "kini", "kanato"],
    "hil": ["ang", "sang", "nga", "ko", "ikaw", "siya", "kita", "indi", "wala", "ini", "sina", "naton"],
    "en": ["the", "is", "are", "was", "were", "and", "that", "this", "have", "for", "not", "with"],
}


def _validate_output_language(text: str, target_lang: str) -> bool:
    """Check if translated text contains expected language markers."""
    markers = LANGUAGE_MARKERS.get(target_lang, [])
    if not markers:
        return True
    text_lower = text.lower()
    matches = sum(1 for m in markers if f" {m} " in f" {text_lower} ")
    return matches >= 2

MODEL = "gemini-2.5-flash-lite"
API_BASE = "https://generativelanguage.googleapis.com/v1beta"

# In-memory translation cache: same input → same output within a session
_translation_cache: dict[str, str] = {}


def _make_cache_key(source_lang: str, target_lang: str, tone: Optional[str], text: str) -> str:
    normalized = " ".join(text.lower().strip().split())
    payload = json.dumps(
        {"sl": source_lang, "tl": target_lang, "tone": tone or "", "text": normalized},
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


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
            # Check in-memory cache first
            cache_key = _make_cache_key(source_lang, target_lang, tone, text)
            if cache_key in _translation_cache:
                cached_text = _translation_cache[cache_key]
                logger.info(f"Cache hit for {source_lang}→{target_lang}")
                detected = TranslationService._heuristic_tone(text)
                return {
                    "input_text": text,
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                    "output_text": cached_text,
                    "tone": tone or detected,
                    "detected_tone": detected,
                }

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
                    "temperature": 0.0,
                    "top_p": 1,
                    "top_k": 1,
                    "maxOutputTokens": 256,
                    "responseMimeType": "application/json",
                },
            }

            def _call_gemini(payload_data):
                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(url, json=payload_data)
                if resp.status_code != 200:
                    raise Exception(f"API {resp.status_code}: {resp.text[:200]}")
                raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                logger.info(f"Gemini raw response: {raw_text}")
                parsed_data = _parse_response(raw_text)
                t_text = parsed_data.get("t", "")
                if not t_text:
                    t_text = raw_text
                    logger.warning(f"No 't' key in parsed response, using raw: {raw_text}")
                tone_val = parsed_data.get("tone", "neutral")
                if tone_val not in AVAILABLE_TONES:
                    tone_val = "neutral"
                return t_text, tone_val

            translated, detected = _call_gemini(payload)

            # Validate output language; retry once if wrong language detected
            tgt_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)
            if not _validate_output_language(translated, target_lang):
                logger.warning(f"Output language validation failed for {target_lang}, retrying...")
                retry_prompt = (
                    f"Translate the following text into {tgt_name} ONLY. "
                    f"Output exclusively in {tgt_name}.\nSource text: {text}"
                )
                retry_payload = {
                    "system_instruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
                    "contents": [{"parts": [{"text": f"{src}→{tgt}|{retry_prompt}"}]}],
                    "generationConfig": {"temperature": 0.0, "top_p": 1, "top_k": 1, "maxOutputTokens": 256, "responseMimeType": "application/json"},
                }
                try:
                    translated, detected = _call_gemini(retry_payload)
                except Exception as retry_err:
                    logger.warning(f"Retry also failed: {retry_err}")

            # Also retry if output is identical to source (no translation happened)
            if translated.strip().lower() == text.strip().lower() and source_lang != target_lang:
                logger.warning("Output identical to source, retrying...")
                retry_prompt = (
                    f"Translate the following text into {tgt_name} ONLY. "
                    f"Output exclusively in {tgt_name}.\nSource text: {text}"
                )
                retry_payload = {
                    "system_instruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
                    "contents": [{"parts": [{"text": f"{src}→{tgt}|{retry_prompt}"}]}],
                    "generationConfig": {"temperature": 0.0, "top_p": 1, "top_k": 1, "maxOutputTokens": 256, "responseMimeType": "application/json"},
                }
                try:
                    translated, detected = _call_gemini(retry_payload)
                except Exception as retry_err:
                    logger.warning(f"Identity retry also failed: {retry_err}")

            # Store in cache
            _translation_cache[cache_key] = translated

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
