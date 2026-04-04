from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import json

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
from app.utils.validation import is_valid_translation_input

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
    is_valid, error_msg = is_valid_translation_input(request.text)
    if not is_valid:
        raise HTTPException(status_code=422, detail=error_msg)

    conv = get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    detected_tone = TranslationService.detect_tone(request.text)
    tone_to_use = request.tone or detected_tone

    if request.target_langs:
        target_langs = request.target_langs
    elif request.target_lang:
        target_langs = [request.target_lang]
    else:
        raise HTTPException(status_code=400, detail="target_lang or target_langs is required")

    translations = []
    for tl in target_langs:
        result = TranslationService.translate_text(
            text=request.text,
            source_lang=request.language,
            target_lang=tl,
            tone=tone_to_use,
        )
        translations.append({"lang": tl, "text": result["output_text"]})

    # Store single target as plain string, multi-target as JSON array
    if len(translations) == 1:
        translated_text_stored = translations[0]["text"]
    else:
        translated_text_stored = json.dumps(translations, ensure_ascii=False)

    tone_record = get_or_create_tone(db, tone_to_use)

    msg = add_message(
        db,
        conversation_id=conversation_id,
        speaker_abc=request.speaker_abc,
        text=request.text,
        translated_text=translated_text_stored,
        language=request.language,
        tone_id=tone_record.tone_id,
    )

    # Save ONE translation record to history (not one per target)
    try:
        t = create_translation(
            db,
            input_text=request.text,
            input_language=request.language,
            method="text",
            multi_target=len(translations) > 1,
            device_id=conv.device_id,
            translation_type="chat",
        )
        for tr in translations:
            create_translation_output(
                db,
                translation_id=t.translation_id,
                target_language=tr["lang"],
                output_text=tr["text"],
                detected_tone=tone_to_use,
            )
    except Exception as e:
        logger.warning(f"Chat history save skipped: {e}")

    return {
        "message_id": msg.message_id,
        "speaker_abc": msg.speaker_abc,
        "text": msg.text,
        "translated_text": msg.translated_text,
        "translations": translations,
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
    Rewrite the source message in a new tone and regenerate all target translations.
    Used when a speaker wants to resend their message with a different register.
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
        # No API key available — fall back to a simple word-count heuristic.
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


@router.post("/conversation/turn", response_model=ConversationTurnResponse)
async def conversation_turn(request: ConversationTurnRequest, db: Session = Depends(get_db)):
    """Single-turn translation without a persistent conversation session."""
    is_valid, error_msg = is_valid_translation_input(request.text)
    if not is_valid:
        raise HTTPException(status_code=422, detail=error_msg)

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
