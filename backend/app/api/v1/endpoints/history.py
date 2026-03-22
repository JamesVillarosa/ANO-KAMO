"""
History & Favorites Endpoints
"""
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from pydantic import BaseModel
from typing import List, Optional

from app.db.crud import (
    get_all_translations, toggle_favorite,
    get_favorites, delete_translation, clear_all_history,
    create_translation_with_outputs,
    get_conversations_for_device,
)
from app.db.session import get_db
from app.db.schemas import HistoryItemResponse, FavoriteToggleRequest


class TranslationOutputIn(BaseModel):
    target_language: str
    output_text: str
    detected_tone: Optional[str] = None


class CreateTranslationRequest(BaseModel):
    input_text: str
    input_language: str
    outputs: List[TranslationOutputIn]
    method: str = "text"
    multi_target: bool = False
    device_id: Optional[str] = None
    translation_type: str = "text"

router = APIRouter()


@router.post("/history")
async def create_history_entry(request: CreateTranslationRequest, db: Session = Depends(get_db)):
    """Create one Translation + N TranslationOutput rows in one call (used for 3-way bundled saves)."""
    t = create_translation_with_outputs(
        db,
        input_text=request.input_text,
        input_language=request.input_language,
        outputs=[o.model_dump() for o in request.outputs],
        method=request.method,
        multi_target=request.multi_target,
        device_id=request.device_id,
        translation_type=request.translation_type,
    )
    return {
        "translation_id": t.translation_id,
        "outputs": [
            {"output_id": o.output_id, "target_language": o.target_language, "output_text": o.output_text}
            for o in t.outputs
        ],
    }


@router.get("/history", response_model=list[HistoryItemResponse])
async def get_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    device_id: str = Query(None),
    db: Session = Depends(get_db),
):
    """Get all translation history with outputs, optionally filtered by device_id."""
    translations = get_all_translations(db, skip=skip, limit=limit, device_id=device_id)
    results = []
    for t in translations:
        results.append({
            "translation_id": t.translation_id,
            "input_text": t.input_text,
            "input_language": t.input_language,
            "method": t.method,
            "translation_type": t.translation_type or "text",
            "multi_target": t.multi_target,
            "timestamp": t.timestamp,
            "outputs": [
                {
                    "output_id": o.output_id,
                    "target_language": o.target_language,
                    "output_text": o.output_text,
                    "detected_tone": o.detected_tone,
                    "is_favorite": o.is_favorite,
                }
                for o in t.outputs
            ],
        })
    return results


@router.post("/favorites/toggle")
async def toggle_fav(request: FavoriteToggleRequest, db: Session = Depends(get_db)):
    """Toggle favorite status on a translation output."""
    output = toggle_favorite(db, request.output_id)
    if not output:
        raise HTTPException(status_code=404, detail="Output not found")
    return {"output_id": output.output_id, "is_favorite": output.is_favorite}


@router.get("/favorites", response_model=list)
async def get_favorites_list(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    device_id: str = Query(None),
    db: Session = Depends(get_db),
):
    """Get all favorited translation outputs, optionally filtered by device_id."""
    favs = get_favorites(db, skip=skip, limit=limit, device_id=device_id)
    results = []
    for o in favs:
        t = o.translation
        results.append({
            "output_id": o.output_id,
            "translation_id": t.translation_id if t else None,
            "target_language": o.target_language,
            "output_text": o.output_text,
            "input_text": t.input_text if t else "",
            "input_language": t.input_language if t else "",
            "is_favorite": True,
        })
    return results


def _parse_msg_translations(translated_text: str | None) -> list:
    """Parse translated_text: if JSON array return it, otherwise return empty list."""
    if not translated_text:
        return []
    try:
        data = json.loads(translated_text)
        if isinstance(data, list):
            return data
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return []


@router.get("/history/conversations")
async def get_conversation_history(
    device_id: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get all conversation sessions with their messages, grouped by conversation_id."""
    convs = get_conversations_for_device(db, device_id=device_id, skip=skip, limit=limit)
    results = []
    for c in convs:
        if not c.messages:
            continue
        results.append({
            "conversation_id": c.conversation_id,
            "mode": c.mode,
            "started_at": c.started_at,
            "participants": [
                {"speaker_label": p.speaker_label, "preferred_language": p.preferred_language}
                for p in c.participants
            ],
            "messages": [
                {
                    "message_id": m.message_id,
                    "speaker_abc": m.speaker_abc,
                    "text": m.text,
                    "translated_text": m.translated_text,
                    "translations": _parse_msg_translations(m.translated_text),
                    "language": m.language,
                    "timestamp": m.timestamp,
                }
                for m in sorted(c.messages, key=lambda x: x.timestamp)
            ],
        })
    return results


@router.delete("/history/clear-all")
async def clear_all(
    device_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """Delete all translation history, optionally filtered by device_id."""
    count = clear_all_history(db, device_id=device_id)
    return {"deleted": count}


@router.delete("/history/{translation_id}", status_code=204)
async def delete_history(
    translation_id: str,
    device_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """Delete a translation from history, optionally filtered by device_id."""
    deleted = delete_translation(db, translation_id, device_id=device_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Translation not found")
    return None
