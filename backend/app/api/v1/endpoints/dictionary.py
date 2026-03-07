"""
Dictionary Endpoints — Word lookup with Gemini AI + DB caching
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.crud import create_dictionary_lookup
from app.db.session import get_db
from app.db.schemas import DictionaryLookupRequest, DictionaryEntryResponse
from app.services.dictionary_service import DictionaryService

router = APIRouter()


@router.post("/dictionary/lookup", response_model=DictionaryEntryResponse)
async def lookup_word(request: DictionaryLookupRequest, db: Session = Depends(get_db)):
    """
    Look up a word in the dictionary.
    Checks cache first, then queries Gemini for pronunciation, definition,
    part of speech, synonyms, root, and example sentences.
    """
    result = DictionaryService.lookup(
        db,
        word=request.word,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
    )

    # Record lookup
    if result.get("entry_id"):
        create_dictionary_lookup(
            db,
            entry_id=result["entry_id"],
            device_id=request.device_id,
            translation_id=request.translation_id,
        )

    return {
        "entry_id": result.get("entry_id", ""),
        "word": result["word"],
        "language": result.get("language", request.source_lang),
        "pronunciation": result.get("pronunciation", ""),
        "definition": result.get("definition", ""),
        "example_sentence": result.get("example_sentence", ""),
        "part_of_speech": result.get("part_of_speech", ""),
        "synonyms": result.get("synonyms", []),
        "root": result.get("root", result["word"]),
    }
