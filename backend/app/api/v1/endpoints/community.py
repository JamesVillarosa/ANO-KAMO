"""
Community Endpoints — Submit and vote on phrase translations
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.crud import create_submission, get_all_submissions, vote_submission
from app.db.session import get_db
from app.db.schemas import CommunitySubmissionRequest, CommunitySubmissionResponse

router = APIRouter()


@router.post("/community/submissions", response_model=CommunitySubmissionResponse)
async def submit_phrase(request: CommunitySubmissionRequest, db: Session = Depends(get_db)):
    """Submit a new community phrase translation."""
    sub = create_submission(
        db,
        phrase=request.phrase,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
        proposed_translation=request.proposed_translation,
        notes=request.notes,
        origin=request.origin,
        context=request.context,
        device_id=request.device_id,
    )
    return sub


@router.get("/community/submissions", response_model=list[CommunitySubmissionResponse])
async def get_submissions(
    status: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Get community submissions, optionally filtered by status."""
    return get_all_submissions(db, skip=skip, limit=limit, status=status)


@router.post("/community/submissions/{submission_id}/vote")
async def vote_on_submission(
    submission_id: int,
    direction: int = Query(1, ge=-1, le=1),
    db: Session = Depends(get_db),
):
    """Vote on a submission (+1 upvote, -1 downvote). Auto-verifies at +10 votes."""
    sub = vote_submission(db, submission_id, direction)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {"id": sub.id, "votes": sub.votes, "is_verified": sub.is_verified}
