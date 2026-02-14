"""
CRUD Operations for Database Models
"""
from datetime import datetime
from sqlalchemy.orm import Session

from app.db.models import TranslationHistory, CommunitySubmission
from app.db.schemas import HistorySaveRequest, CommunitySubmissionRequest


# ============ TranslationHistory CRUD ============


def create_history(db: Session, request: HistorySaveRequest) -> TranslationHistory:
    """Create a new translation history record"""
    history = TranslationHistory(
        source_lang=request.source_lang,
        target_langs=request.target_langs,
        input_text=request.input_text,
        output_texts=request.output_texts,
        tone=request.tone,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


def get_history(db: Session, history_id: int) -> TranslationHistory | None:
    """Get a history record by ID"""
    return db.query(TranslationHistory).filter(TranslationHistory.id == history_id).first()


def get_all_history(db: Session, skip: int = 0, limit: int = 100) -> list[TranslationHistory]:
    """Get all history records"""
    return db.query(TranslationHistory).offset(skip).limit(limit).all()


def get_favorites(db: Session, skip: int = 0, limit: int = 100) -> list[TranslationHistory]:
    """Get all favorited translations"""
    return (
        db.query(TranslationHistory)
        .filter(TranslationHistory.is_favorite == True)
        .offset(skip)
        .limit(limit)
        .all()
    )


def mark_favorite(db: Session, history_id: int) -> TranslationHistory | None:
    """Mark a translation as favorite"""
    history = get_history(db, history_id)
    if history:
        history.is_favorite = True
        db.commit()
        db.refresh(history)
    return history


def unmark_favorite(db: Session, history_id: int) -> TranslationHistory | None:
    """Unmark a translation as favorite"""
    history = get_history(db, history_id)
    if history:
        history.is_favorite = False
        db.commit()
        db.refresh(history)
    return history


# ============ CommunitySubmission CRUD ============


def create_submission(
    db: Session, request: CommunitySubmissionRequest
) -> CommunitySubmission:
    """Create a new community submission"""
    submission = CommunitySubmission(
        phrase=request.phrase,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
        proposed_translation=request.proposed_translation,
        notes=request.notes,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


def get_submission(db: Session, submission_id: int) -> CommunitySubmission | None:
    """Get a submission by ID"""
    return db.query(CommunitySubmission).filter(CommunitySubmission.id == submission_id).first()


def get_all_submissions(
    db: Session, skip: int = 0, limit: int = 100, status: str = None
) -> list[CommunitySubmission]:
    """Get all submissions, optionally filtered by status"""
    query = db.query(CommunitySubmission)
    if status:
        query = query.filter(CommunitySubmission.status == status)
    return query.offset(skip).limit(limit).all()


def update_submission_status(
    db: Session, submission_id: int, status: str
) -> CommunitySubmission | None:
    """Update submission status"""
    submission = get_submission(db, submission_id)
    if submission:
        submission.status = status
        db.commit()
        db.refresh(submission)
    return submission
