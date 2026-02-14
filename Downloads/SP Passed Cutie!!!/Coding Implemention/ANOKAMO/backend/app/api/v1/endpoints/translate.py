"""
Translation Endpoints
Single and multi-language translation
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.crud import create_history
from app.db.session import get_db
from app.db.schemas import (
    TranslateRequest,
    TranslateResponse,
    TranslateMultiRequest,
    TranslateMultiResponse,
)
from app.services.translation_service import TranslationService

router = APIRouter()


@router.post("/translate", response_model=TranslateResponse)
async def translate_single(request: TranslateRequest, db: Session = Depends(get_db)):
    """
    Translate text to a single target language
    
    - **text**: Text to translate (required, 1-5000 chars)
    - **source_lang**: Source language code (e.g., "en", "tl")
    - **target_lang**: Target language code (e.g., "tl", "ceb")
    - **tone**: Optional tone (neutral, formal, casual, friendly)
    """
    result = TranslationService.translate_text(
        text=request.text,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
        tone=request.tone,
    )

    # Save to history
    from app.db.schemas import HistorySaveRequest

    history_request = HistorySaveRequest(
        source_lang=request.source_lang,
        target_langs=[request.target_lang],
        input_text=request.text,
        output_texts=[result["output_text"]],
        tone=request.tone,
    )
    create_history(db, history_request)

    return result


@router.post("/translate/multi", response_model=TranslateMultiResponse)
async def translate_multi(request: TranslateMultiRequest, db: Session = Depends(get_db)):
    """
    Translate text to multiple target languages (up to 2)
    
    - **text**: Text to translate (required, 1-5000 chars)
    - **source_lang**: Source language code
    - **target_langs**: List of target language codes (1-2 languages)
    - **tone**: Optional tone for translation
    """
    result = TranslationService.translate_multi(
        text=request.text,
        source_lang=request.source_lang,
        target_langs=request.target_langs,
        tone=request.tone,
    )

    # Save to history
    from app.db.schemas import HistorySaveRequest

    history_request = HistorySaveRequest(
        source_lang=request.source_lang,
        target_langs=request.target_langs,
        input_text=request.text,
        output_texts=result["output_texts"],
        tone=request.tone,
    )
    create_history(db, history_request)

    return result
