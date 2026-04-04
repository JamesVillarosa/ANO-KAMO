import logging
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.crud import (
    create_submission, get_all_submissions, vote_submission,
    create_feedback, get_feedback_counts,
)
from app.db.session import get_db
from app.db.schemas import (
    CommunitySubmissionRequest, CommunitySubmissionResponse,
    TranslationFeedbackRequest, TranslationFeedbackResponse,
)
from app.services.community_service import CommunityService

logger = logging.getLogger(__name__)
router = APIRouter()


def _run_ai_scan(submission_id: int, term: str, meaning: str, origin: str, sample: str):
    """Background task: run Gemini popularity scan and update submission."""
    from app.db.session import SessionLocal
    from app.db.models import CommunitySubmission
    from datetime import datetime

    result = CommunityService.scan_term(term, meaning, origin, sample)
    popularity = result.get("popularity", "rising")
    reasoning = result.get("reasoning", "")

    db = SessionLocal()
    try:
        sub = db.query(CommunitySubmission).filter(CommunitySubmission.id == submission_id).first()
        if sub:
            sub.popularity_tier = popularity
            sub.ai_reasoning = reasoning
            sub.last_scanned = datetime.utcnow()

            if popularity == "popular":
                # Widely used terms are auto-approved immediately.
                sub.is_verified = True
                sub.status = "approved"
                logger.info(f"AI SCAN: '{term}' -> POPULAR (auto-verified)")
            else:
                # Rising or unknown terms enter the Evolution Loop for periodic re-evaluation.
                sub.popularity_tier = "rising"
                logger.info(f"AI SCAN: '{term}' -> RISING ({reasoning})")

            db.commit()
    finally:
        db.close()


@router.post("/community/submissions", response_model=CommunitySubmissionResponse)
async def submit_phrase(
    request: CommunitySubmissionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Submit a new community phrase. Triggers AI popularity scan in background."""
    sub = create_submission(
        db,
        phrase=request.phrase,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
        proposed_translation=request.proposed_translation,
        notes=request.notes,
        origin=request.origin,
        context=request.context,
        sample_sentence=request.sample_sentence,
        device_id=request.device_id,
    )

    background_tasks.add_task(
        _run_ai_scan,
        sub.id,
        request.phrase,
        request.proposed_translation,
        request.origin or "",
        request.sample_sentence or "",
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


# ──────────────────── Translation Feedback ──────────────────
@router.post("/feedback", response_model=TranslationFeedbackResponse)
async def submit_feedback(
    request: TranslationFeedbackRequest,
    db: Session = Depends(get_db),
):
    """Submit feedback (like/dislike) on a translation, with optional suggested improvement."""
    fb = create_feedback(
        db,
        translation_id=request.translation_id,
        feedback_type=request.feedback_type,
        device_id=request.device_id,
        suggested_text=request.suggested_text,
    )
    return fb


@router.get("/feedback/{translation_id}/counts")
async def feedback_counts(
    translation_id: str,
    db: Session = Depends(get_db),
):
    """Get like/dislike counts for a translation."""
    return get_feedback_counts(db, translation_id)
