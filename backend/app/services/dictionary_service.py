"""
Dictionary Service — Word lookup via Gemini with DB caching
Provides pronunciation, definition, part of speech, example sentences, and synonyms.
"""
import json
import logging
from typing import Optional

import google.generativeai as genai
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.crud import find_dictionary_entry, create_dictionary_entry
from app.services.translation_service import SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)


class DictionaryService:
    """Dictionary lookup with Gemini AI and database caching"""

    @staticmethod
    def lookup(
        db: Session,
        word: str,
        source_lang: str,
        target_lang: str,
    ) -> dict:
        """
        Look up a word's details. First check DB cache, then query Gemini.
        Returns: word, pronunciation, definition, part_of_speech, example_sentence, synonyms
        """
        # Check cache
        cached = find_dictionary_entry(db, word.lower(), source_lang)
        if cached and cached.definition:
            return DictionaryService._entry_to_dict(cached)

        # Query Gemini
        result = DictionaryService._gemini_lookup(word, source_lang, target_lang)

        # Cache in DB
        if result.get("definition"):
            entry = create_dictionary_entry(
                db,
                word=word.lower(),
                language=source_lang,
                definition=result.get("definition", ""),
                example_sentence=result.get("example_sentence", ""),
                pronunciation=result.get("pronunciation", ""),
            )
            result["entry_id"] = entry.entry_id
        else:
            result["entry_id"] = ""

        return result

    @staticmethod
    def _gemini_lookup(word: str, source_lang: str, target_lang: str) -> dict:
        """Query Gemini for word details"""
        if not settings.GEMINI_API_KEY:
            return DictionaryService._mock_lookup(word, source_lang)

        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            src = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
            tgt = SUPPORTED_LANGUAGES.get(target_lang, target_lang)

            prompt = (
                f'Provide a dictionary entry for the {src} word "{word}".\n'
                f"Include its meaning in both {src} and {tgt}.\n\n"
                f"Return a JSON object with EXACTLY these keys:\n"
                f'{{"word": "...", "pronunciation": "/.../" , '
                f'"part_of_speech": "...", "definition": "... (in {tgt})", '
                f'"synonyms": ["...", "..."], '
                f'"example_sentence": "... (in {src})"}}\n\n'
                f"Return ONLY the JSON, no markdown, no explanation."
            )

            response = model.generate_content(prompt)
            text = response.text.strip()
            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                text = text.rsplit("```", 1)[0]

            data = json.loads(text)
            return {
                "word": data.get("word", word),
                "pronunciation": data.get("pronunciation", ""),
                "part_of_speech": data.get("part_of_speech", ""),
                "definition": data.get("definition", ""),
                "synonyms": data.get("synonyms", []),
                "example_sentence": data.get("example_sentence", ""),
                "language": source_lang,
            }
        except Exception as e:
            logger.error(f"Dictionary Gemini error: {e}")
            return DictionaryService._mock_lookup(word, source_lang)

    @staticmethod
    def _mock_lookup(word: str, language: str) -> dict:
        return {
            "word": word,
            "pronunciation": f"/{word.lower()}/",
            "part_of_speech": "Noun",
            "definition": f'The meaning of "{word}" in context.',
            "synonyms": [],
            "example_sentence": f'Ginamit niya ang "{word}" sa pangungusap.',
            "language": language,
        }

    @staticmethod
    def _entry_to_dict(entry) -> dict:
        return {
            "entry_id": entry.entry_id,
            "word": entry.word,
            "language": entry.language,
            "pronunciation": entry.pronunciation or "",
            "definition": entry.definition or "",
            "example_sentence": entry.example_sentence or "",
            "part_of_speech": "",
            "synonyms": [],
        }
