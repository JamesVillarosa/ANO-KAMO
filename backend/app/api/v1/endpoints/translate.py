"""
Translation Endpoints — Text and Multi-target translation
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.crud import (
    create_translation, create_translation_output,
    get_verified_phrases,
)
from app.db.session import get_db
from app.db.schemas import (
    TranslateRequest, TranslateResponse,
    TranslateMultiRequest, TranslateMultiResponse,
)
from app.services.translation_service import TranslationService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/translate", response_model=TranslateResponse)
async def translate_single(request: TranslateRequest, db: Session = Depends(get_db)):
    """
    Single target translation with context-aware AI.
    Checks community-submitted phrases first.
    """
    # Validate input text
    if not request.text or not request.text.strip():
        raise HTTPException(
            status_code=422,
            detail="Input text is required and cannot be empty."
        )

    # RAG: Get community-verified phrases for this language pair
    community_phrases = []
    try:
        verified = get_verified_phrases(db, source_lang=request.source_lang, target_lang=request.target_lang)
        community_phrases = [
            {"phrase": c.phrase, "proposed_translation": c.proposed_translation}
            for c in verified
        ]
    except Exception as e:
        logger.warning(f"Community query skipped: {e}")

    try:
        result = TranslationService.translate_text(
            text=request.text,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            tone=request.tone,
            community_phrases=community_phrases or None,
        )
    except Exception as e:
        logger.error(f"Translation service error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Translation service is temporarily unavailable. Please try again."
        )

    # Check if translation failed
    if result.get("output_text") == "(Try again)":
        raise HTTPException(
            status_code=503,
            detail="Translation service is temporarily unavailable. Please try again."
        )

    # Persist to DB (gracefully handle schema drift)
    translation_id = None
    try:
        t = create_translation(
            db,
            input_text=request.text,
            input_language=request.source_lang,
            method="text",
            multi_target=False,
            device_id=request.device_id,
            translation_type="text",
        )
        translation_id = t.translation_id
        create_translation_output(
            db,
            translation_id=t.translation_id,
            target_language=request.target_lang,
            output_text=result["output_text"],
            detected_tone=result.get("detected_tone"),
        )
    except Exception as e:
        logger.warning(f"DB persist skipped: {e}")

    return {
        "translation_id": translation_id or 0,
        "input_text": request.text,
        "source_lang": request.source_lang,
        "target_lang": request.target_lang,
        "output_text": result["output_text"],
        "detected_tone": result.get("detected_tone"),
        "is_favorite": False,
    }


@router.post("/translate/multi", response_model=TranslateMultiResponse)
async def translate_multi(request: TranslateMultiRequest, db: Session = Depends(get_db)):
    """
    Multi-target translation (one input → up to 2 outputs).
    """
    # Validate input text
    if not request.text or not request.text.strip():
        raise HTTPException(
            status_code=422,
            detail="Input text is required and cannot be empty."
        )

    # RAG: Get community-verified phrases
    community_phrases = []
    try:
        verified = get_verified_phrases(db, source_lang=request.source_lang)
        community_phrases = [
            {"phrase": c.phrase, "proposed_translation": c.proposed_translation}
            for c in verified
        ]
    except Exception as e:
        logger.warning(f"Community query skipped: {e}")

    try:
        result = TranslationService.translate_multi(
            text=request.text,
            source_lang=request.source_lang,
            target_langs=request.target_langs,
            tone=request.tone,
            community_phrases=community_phrases or None,
        )
    except Exception as e:
        logger.error(f"Translation service error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Translation service is temporarily unavailable. Please try again."
        )

    # Check if any translation failed
    if any(text == "(Try again)" for text in result.get("output_texts", [])):
        raise HTTPException(
            status_code=503,
            detail="Translation service is temporarily unavailable. Please try again."
        )

    # Persist (gracefully handle schema drift)
    translation_id = None
    try:
        t = create_translation(
            db,
            input_text=request.text,
            input_language=request.source_lang,
            method="text",
            multi_target=True,
            device_id=request.device_id,
            translation_type="text",
        )
        translation_id = t.translation_id
        for lang, text_out in zip(request.target_langs, result["output_texts"]):
            create_translation_output(
                db,
                translation_id=t.translation_id,
                target_language=lang,
                output_text=text_out,
                detected_tone=result.get("detected_tone"),
            )
    except Exception as e:
        logger.warning(f"DB persist skipped: {e}")

    return {
        "translation_id": translation_id or 0,
        "input_text": request.text,
        "source_lang": request.source_lang,
        "target_langs": request.target_langs,
        "output_texts": result["output_texts"],
        "detected_tone": result.get("detected_tone"),
    }
