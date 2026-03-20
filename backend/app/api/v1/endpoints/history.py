"""
History & Favorites Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.crud import (
    get_all_translations, toggle_favorite,
    get_favorites, delete_translation, clear_all_history,
)
from app.db.session import get_db
from app.db.schemas import HistoryItemResponse, FavoriteToggleRequest

router = APIRouter()


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
