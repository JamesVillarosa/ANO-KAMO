"""
Translation Endpoints — Text and Multi-target translation
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.crud import (
    create_translation, create_translation_output,
    get_all_submissions,
)
from app.db.session import get_db
from app.db.schemas import (
    TranslateRequest, TranslateResponse,
    TranslateMultiRequest, TranslateMultiResponse,
)
from app.services.translation_service import TranslationService

router = APIRouter()


@router.post("/translate", response_model=TranslateResponse)
async def translate_single(request: TranslateRequest, db: Session = Depends(get_db)):
    """
    Single target translation with context-aware AI.
    Checks community-submitted phrases first.
    """
    # Get community phrases for context
    community = get_all_submissions(db, limit=50, status="approved")
    community_phrases = [
        {"phrase": c.phrase, "proposed_translation": c.proposed_translation}
        for c in community
        if c.source_lang == request.source_lang and c.target_lang == request.target_lang
    ]

    result = TranslationService.translate_text(
        text=request.text,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
        tone=request.tone,
        community_phrases=community_phrases or None,
    )

    # Persist to DB
    t = create_translation(
        db,
        input_text=request.text,
        input_language=request.source_lang,
        method="text",
        multi_target=False,
        device_id=request.device_id,
    )
    o = create_translation_output(
        db,
        translation_id=t.translation_id,
        target_language=request.target_lang,
        output_text=result["output_text"],
        detected_tone=result.get("detected_tone"),
    )

    return {
        "translation_id": t.translation_id,
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
    community = get_all_submissions(db, limit=50, status="approved")

    result = TranslationService.translate_multi(
        text=request.text,
        source_lang=request.source_lang,
        target_langs=request.target_langs,
        tone=request.tone,
        community_phrases=[
            {"phrase": c.phrase, "proposed_translation": c.proposed_translation}
            for c in community
        ] or None,
    )

    # Persist
    t = create_translation(
        db,
        input_text=request.text,
        input_language=request.source_lang,
        method="text",
        multi_target=True,
        device_id=request.device_id,
    )
    for lang, text in zip(request.target_langs, result["output_texts"]):
        create_translation_output(
            db,
            translation_id=t.translation_id,
            target_language=lang,
            output_text=text,
            detected_tone=result.get("detected_tone"),
        )

    return {
        "translation_id": t.translation_id,
        "input_text": request.text,
        "source_lang": request.source_lang,
        "target_langs": request.target_langs,
        "output_texts": result["output_texts"],
        "detected_tone": result.get("detected_tone"),
    }
