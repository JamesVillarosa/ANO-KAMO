"""
Dictionary Service — Word lookup via Gemini REST API with DB caching
Uses direct httpx REST calls to Gemini 2.0 Flash-Lite (v1beta) for reliability.
Provides pronunciation, definition, part of speech, example sentences, synonyms, and root word.
"""
import json
import logging
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.crud import find_dictionary_entry, create_dictionary_entry
from app.services.translation_service import SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash-lite"
API_BASE = "https://generativelanguage.googleapis.com/v1beta"

SYSTEM_INSTRUCTION = (
    "You are a Filipino-language dictionary expert specializing in Tagalog, Cebuano, "
    "Hiligaynon, and English. You provide accurate, rich dictionary entries."
)


class DictionaryService:
    """Dictionary lookup with Gemini REST API and database caching"""

    @staticmethod
    def lookup(
        db: Session,
        word: str,
        source_lang: str,
        target_lang: str,
    ) -> dict:
        """
        Look up a word's details. First check DB cache, then query Gemini.
        Returns: word, root, pronunciation, definition, part_of_speech, example_sentence, synonyms
        ONLY saves to DB if the API returns a valid, non-mock response.
        """
        # Check cache
        cached = find_dictionary_entry(db, word.lower(), source_lang)
        if cached and cached.definition:
            return DictionaryService._entry_to_dict(cached)

        # Query Gemini via REST
        result = DictionaryService._gemini_lookup(word, source_lang, target_lang)

        # Cache in DB ONLY if we got a real API response (not mock/error)
        if result.get("_from_api") and result.get("definition"):
            entry = create_dictionary_entry(
                db,
                word=word.lower(),
                language=source_lang,
                definition=result.get("definition", ""),
                example_sentence=result.get("example_sentence", ""),
                pronunciation=result.get("pronunciation", ""),
                part_of_speech=result.get("part_of_speech", ""),
                synonyms=json.dumps(result.get("synonyms", [])),
                root=result.get("root", ""),
            )
            result["entry_id"] = entry.entry_id
        else:
            result["entry_id"] = ""

        # Remove internal flag before returning
        result.pop("_from_api", None)
        return result

    @staticmethod
    def _gemini_lookup(word: str, source_lang: str, target_lang: str) -> dict:
        """Query Gemini for word details via direct REST API"""
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.error("GEMINI_API_KEY is empty — returning transient error")
            return DictionaryService._transient_error(word, source_lang)

        try:
            src = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
            tgt = SUPPORTED_LANGUAGES.get(target_lang, target_lang)

            prompt = (
                f'Provide a detailed dictionary entry for the {src} word "{word}".\n'
                f"The definition should be written in {tgt}.\n\n"
                f"Return a JSON object with EXACTLY these keys:\n"
                f'{{"word": "{word}", '
                f'"root": "the root/base word if applicable, otherwise same as word", '
                f'"pronunciation": "syllable-separated with interpuncts e.g. sho · kot", '
                f'"part_of_speech": "e.g. Adjective (Slang/Colloquial) or Noun or Verb etc.", '
                f'"definition": "full numbered definition in {tgt}, can be multi-sentence", '
                f'"synonyms": ["synonym1", "synonym2"], '
                f'"example_sentence": "a natural example sentence using the word in {src}"}}\n\n'
                f"Return ONLY the JSON, no markdown, no explanation."
            )

            url = f"{API_BASE}/models/{MODEL}:generateContent?key={api_key}"
            payload = {
                "system_instruction": {
                    "parts": [{"text": SYSTEM_INSTRUCTION}]
                },
                "contents": [
                    {"parts": [{"text": prompt}]}
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 512,
                    "responseMimeType": "application/json",
                },
            }

            with httpx.Client(timeout=15.0) as client:
                response = client.post(url, json=payload)

            if response.status_code != 200:
                error_body = response.text
                logger.error(f"Dictionary Gemini API error {response.status_code}: {error_body[:300]}")
                return DictionaryService._transient_error(word, source_lang)

            result = response.json()
            raw = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            logger.info(f"Dictionary Gemini raw: {raw}")

            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1]
                raw = raw.rsplit("```", 1)[0]

            data = json.loads(raw)
            return {
                "word": data.get("word", word),
                "root": data.get("root", word),
                "pronunciation": data.get("pronunciation", ""),
                "part_of_speech": data.get("part_of_speech", ""),
                "definition": data.get("definition", ""),
                "synonyms": data.get("synonyms", []),
                "example_sentence": data.get("example_sentence", ""),
                "language": source_lang,
                "_from_api": True,
            }
        except Exception as e:
            logger.error(f"Dictionary Gemini error: {e}")
            return DictionaryService._transient_error(word, source_lang)

    @staticmethod
    def _transient_error(word: str, language: str) -> dict:
        """Return a transient error response — NOT saved to DB"""
        return {
            "word": word,
            "root": word,
            "pronunciation": "",
            "part_of_speech": "",
            "definition": f"(Dictionary temporarily unavailable. Please try again.)",
            "synonyms": [],
            "example_sentence": "",
            "language": language,
            "_from_api": False,
        }

    @staticmethod
    def _entry_to_dict(entry) -> dict:
        synonyms = []
        if hasattr(entry, 'synonyms') and entry.synonyms:
            try:
                synonyms = json.loads(entry.synonyms)
            except (json.JSONDecodeError, TypeError):
                synonyms = []

        return {
            "entry_id": entry.entry_id,
            "word": entry.word,
            "language": entry.language,
            "pronunciation": entry.pronunciation or "",
            "definition": entry.definition or "",
            "example_sentence": entry.example_sentence or "",
            "part_of_speech": getattr(entry, 'part_of_speech', '') or "",
            "root": getattr(entry, 'root', entry.word) or entry.word,
            "synonyms": synonyms,
        }
