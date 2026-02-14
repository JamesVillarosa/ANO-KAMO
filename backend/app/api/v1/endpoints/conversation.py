"""
Conversation Endpoints
Real-time conversation with tone detection
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.crud import create_history
from app.db.session import get_db
from app.db.schemas import (
    ConversationTurnRequest,
    ConversationTurnResponse,
    HistorySaveRequest,
)
from app.services.translation_service import TranslationService

router = APIRouter()


@router.post("/conversation/turn", response_model=ConversationTurnResponse)
async def conversation_turn(request: ConversationTurnRequest, db: Session = Depends(get_db)):
    """
    Process a single conversation turn with automatic tone detection
    
    - **text**: User message (required, 1-5000 chars)
    - **source_lang**: Source language code
    - **target_lang**: Target language code  
    - **tone**: Optional tone override (if None, will be auto-detected)
    """
    # Detect tone if not provided
    detected_tone = TranslationService.detect_tone(request.text)
    tone_to_use = request.tone or detected_tone

    # Translate
    result = TranslationService.translate_text(
        text=request.text,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
        tone=tone_to_use,
    )

    # Save to history
    history_request = HistorySaveRequest(
        source_lang=request.source_lang,
        target_langs=[request.target_lang],
        input_text=request.text,
        output_texts=[result["output_text"]],
        tone=tone_to_use,
    )
    create_history(db, history_request)

    return {
        "input_text": request.text,
        "source_lang": request.source_lang,
        "target_lang": request.target_lang,
        "output_text": result["output_text"],
        "detected_tone": detected_tone,
        "tone": tone_to_use,
    }
