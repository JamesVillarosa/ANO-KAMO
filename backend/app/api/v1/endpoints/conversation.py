"""
Conversation Endpoints — Session management + messages with tone detection
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.crud import (
    create_conversation, get_conversation,
    add_message, get_messages,
    get_or_create_tone,
)
from app.db.session import get_db
from app.db.schemas import (
    ConversationCreateRequest, ConversationResponse,
    MessageSendRequest, MessageResponse,
    ConversationTurnRequest, ConversationTurnResponse,
)
from app.services.translation_service import TranslationService

router = APIRouter()


@router.post("/conversation", response_model=ConversationResponse)
async def create_new_conversation(
    request: ConversationCreateRequest, db: Session = Depends(get_db)
):
    """Create a new conversation session (2-way or 3-way)."""
    conv = create_conversation(
        db,
        mode=request.mode,
        view_mode=request.view_mode,
        participants=request.participants,
        device_id=request.device_id,
    )
    return {
        "conversation_id": conv.conversation_id,
        "mode": conv.mode,
        "view_mode": conv.view_mode,
        "started_at": conv.started_at,
        "participants": [
            {"speaker_label": p.speaker_label, "preferred_language": p.preferred_language}
            for p in conv.participants
        ],
    }


@router.post("/conversation/{conversation_id}/message", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    request: MessageSendRequest,
    db: Session = Depends(get_db),
):
    """Send a message in a conversation. Auto-detects tone and translates."""
    conv = get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Detect tone
    detected_tone = TranslationService.detect_tone(request.text)
    tone_to_use = request.tone or detected_tone

    # Translate
    result = TranslationService.translate_text(
        text=request.text,
        source_lang=request.language,
        target_lang=request.target_lang,
        tone=tone_to_use,
    )

    # Get/create tone record
    tone_record = get_or_create_tone(db, tone_to_use)

    msg = add_message(
        db,
        conversation_id=conversation_id,
        speaker_abc=request.speaker_abc,
        text=request.text,
        translated_text=result["output_text"],
        language=request.language,
        tone_id=tone_record.tone_id,
    )

    return {
        "message_id": msg.message_id,
        "speaker_abc": msg.speaker_abc,
        "text": msg.text,
        "translated_text": msg.translated_text,
        "language": msg.language,
        "detected_tone": tone_to_use,
        "timestamp": msg.timestamp,
    }


@router.get("/conversation/{conversation_id}/messages", response_model=list[MessageResponse])
async def get_conversation_messages(
    conversation_id: str, db: Session = Depends(get_db)
):
    """Get all messages in a conversation."""
    msgs = get_messages(db, conversation_id)
    results = []
    for m in msgs:
        results.append({
            "message_id": m.message_id,
            "speaker_abc": m.speaker_abc,
            "text": m.text,
            "translated_text": m.translated_text,
            "language": m.language,
            "detected_tone": m.tone.tone_label if m.tone else None,
            "timestamp": m.timestamp,
        })
    return results


# Legacy endpoint for simple conversation turns (no session)
@router.post("/conversation/turn", response_model=ConversationTurnResponse)
async def conversation_turn(request: ConversationTurnRequest, db: Session = Depends(get_db)):
    """Quick single conversation turn without session management."""
    detected_tone = TranslationService.detect_tone(request.text)
    tone_to_use = request.tone or detected_tone

    result = TranslationService.translate_text(
        text=request.text,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
        tone=tone_to_use,
    )

    return {
        "input_text": request.text,
        "source_lang": request.source_lang,
        "target_lang": request.target_lang,
        "output_text": result["output_text"],
        "detected_tone": detected_tone,
        "tone": tone_to_use,
    }
