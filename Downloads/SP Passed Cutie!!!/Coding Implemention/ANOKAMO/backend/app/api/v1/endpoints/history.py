"""
History Endpoints
Retrieve and manage translation history
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.crud import (
    create_history,
    get_all_history,
    mark_favorite,
    unmark_favorite,
    get_favorites,
)
from app.db.session import get_db
from app.db.schemas import (
    HistorySaveRequest,
    HistoryResponse,
    FavoriteRequest,
    FavoriteResponse,
)

router = APIRouter()


@router.get("/history", response_model=list[HistoryResponse])
async def get_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """
    Get translation history
    
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    """
    return get_all_history(db, skip=skip, limit=limit)


@router.post("/history", response_model=HistoryResponse)
async def save_history(request: HistorySaveRequest, db: Session = Depends(get_db)):
    """
    Save a translation to history
    
    - **source_lang**: Source language code
    - **target_langs**: List of target language codes
    - **input_text**: Original text
    - **output_texts**: Translated texts (must match target_langs length)
    - **tone**: Optional tone used
    """
    history = create_history(db, request)
    return history


@router.post("/favorites", response_model=HistoryResponse)
async def add_favorite(request: FavoriteRequest, db: Session = Depends(get_db)):
    """
    Add a translation to favorites
    
    - **history_id**: ID of the history record to favorite
    """
    history = mark_favorite(db, request.history_id)
    if not history:
        raise HTTPException(status_code=404, detail="History record not found")
    return history


@router.get("/favorites", response_model=list[HistoryResponse])
async def get_favorites_list(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """
    Get all favorited translations
    
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    """
    return get_favorites(db, skip=skip, limit=limit)


@router.delete("/favorites/{history_id}", status_code=204)
async def remove_favorite(history_id: int, db: Session = Depends(get_db)):
    """
    Remove a translation from favorites
    
    - **history_id**: ID of the history record to unfavorite
    """
    history = unmark_favorite(db, history_id)
    if not history:
        raise HTTPException(status_code=404, detail="History record not found")
    return None
