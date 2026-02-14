"""
Community Endpoints
Submit and retrieve community-driven phrase translations
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.crud import (
    create_submission,
    get_all_submissions,
)
from app.db.session import get_db
from app.db.schemas import (
    CommunitySubmissionRequest,
    CommunitySubmissionResponse,
)

router = APIRouter()


@router.post("/community/submissions", response_model=CommunitySubmissionResponse)
async def submit_phrase(request: CommunitySubmissionRequest, db: Session = Depends(get_db)):
    """
    Submit a community phrase translation
    
    - **phrase**: Original phrase
    - **source_lang**: Source language code
    - **target_lang**: Target language code
    - **proposed_translation**: Suggested translation
    - **notes**: Optional notes about the translation
    """
    submission = create_submission(db, request)
    return submission


@router.get("/community/submissions", response_model=list[CommunitySubmissionResponse])
async def get_submissions(
    status: str = Query(None, regex="^(pending|approved|rejected)?$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """
    Get community submissions
    
    - **status**: Filter by status (pending, approved, rejected) - optional
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    """
    return get_all_submissions(db, skip=skip, limit=limit, status=status)
