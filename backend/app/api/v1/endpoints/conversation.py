"""
Conversation Endpoints — Session management + messages with tone detection
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import logging
import httpx
from app.core.config import settings
from app.db.crud import (
    create_conversation, get_conversation,
    add_message, get_messages,
    get_or_create_tone,
    create_translation, create_translation_output,
)

logger = logging.getLogger(__name__)
from app.db.session import get_db
from app.db.schemas import (
    ConversationCreateRequest, ConversationResponse,
    MessageSendRequest, MessageResponse,
    ConversationTurnRequest, ConversationTurnResponse,
    RefineRequest, RefineResponse,
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

    # Also save to translation history so it appears in the History screen
    try:
        t = create_translation(
            db,
            input_text=request.text,
            input_language=request.language,
            method="text",
            multi_target=False,
            device_id=conv.device_id,
            translation_type="chat",
        )
        create_translation_output(
            db,
            translation_id=t.translation_id,
            target_language=request.target_lang,
            output_text=result["output_text"],
            detected_tone=tone_to_use,
        )
    except Exception as e:
        logger.warning(f"Chat history save skipped: {e}")

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

@router.post("/conversation/refine", response_model=RefineResponse)
async def refine_message(
    request: RefineRequest,
    db: Session = Depends(get_db),
):
    """
    Phase 12.1: Refinement Endpoint.
    Rewrites source and regenerates all translations based on new tone.
    """
    result = TranslationService.refine_and_translate(
        original_text=request.original_text,
        source_lang=request.source_lang,
        target_langs=request.target_langs,
        new_tone=request.new_tone,
    )
    return result


class ValidateToneRequest(BaseModel):
    tone: str


@router.post("/tone/validate")
async def validate_custom_tone(request: ValidateToneRequest):
    """Validate a custom tone string using Gemini AI."""
    tone = request.tone.strip()
    if not tone:
        return {"valid": False, "message": "Tone cannot be empty"}
    if len(tone) > 60:
        return {"valid": False, "message": "Tone must be 60 characters or less"}

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        # Fallback: basic word-count check
        return {"valid": len(tone.split()) <= 5}

    prompt = (
        "You are evaluating whether a word or short phrase describes a speech style or emotional tone "
        "suitable for adjusting how a translation sounds. "
        "Valid tones are adjectives or short phrases describing style or emotion, "
        "such as 'Poetic', 'Excited', 'Formal', 'Sarcastic', 'Disgusted', 'Childlike', 'Dramatic'. "
        "Invalid inputs are random nouns, gibberish, full sentences, instructions, or words unrelated to speech style. "
        f"Does the following input qualify as a valid tone? Input: \"{tone}\"\n"
        "Reply with exactly one word: YES or NO."
    )

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash-lite:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 8},
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload)
        if resp.status_code != 200:
            raise Exception(f"Gemini error {resp.status_code}")
        answer = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip().upper()
        valid = answer.startswith("YES")
        return {"valid": valid}
    except Exception as e:
        logger.warning(f"Tone validation Gemini call failed: {e}")
        return {"valid": False}


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
