"""
SQLAlchemy Models for Ano-Kamo Backend
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON
from sqlalchemy.sql import func

from app.db.base import Base


class TranslationHistory(Base):
    """
    Stores all translation history for users
    """

    __tablename__ = "translation_history"

    id = Column(Integer, primary_key=True, index=True)
    source_lang = Column(String(10), nullable=False)
    target_langs = Column(JSON, nullable=False)  # List of target languages
    input_text = Column(Text, nullable=False)
    output_texts = Column(JSON, nullable=False)  # List of translations
    tone = Column(String(50), nullable=True)  # User-specified tone
    detected_tone = Column(String(50), nullable=True)  # Auto-detected tone
    is_favorite = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self):
        return f"<TranslationHistory {self.id}: {self.source_lang}->{self.target_langs}>"


class CommunitySubmission(Base):
    """
    Community-submitted phrase translations
    """

    __tablename__ = "community_submission"

    id = Column(Integer, primary_key=True, index=True)
    phrase = Column(Text, nullable=False)
    source_lang = Column(String(10), nullable=False)
    target_lang = Column(String(10), nullable=False)
    proposed_translation = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(20), default="pending", index=True)  # pending, approved, rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self):
        return f"<CommunitySubmission {self.id}: {self.phrase} ({self.status})>"
