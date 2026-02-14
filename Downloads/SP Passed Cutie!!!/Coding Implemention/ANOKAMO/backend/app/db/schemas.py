"""
Pydantic Schemas for Request/Response Validation
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ============ Translation Schemas ============


class TranslateRequest(BaseModel):
    """Single language translation request"""

    text: str = Field(..., min_length=1, max_length=5000, description="Text to translate")
    source_lang: str = Field(..., min_length=2, max_length=10, description="Source language code")
    target_lang: str = Field(..., min_length=2, max_length=10, description="Target language code")
    tone: Optional[str] = Field(None, description="Translation tone (e.g., formal, casual, friendly)")


class TranslateResponse(BaseModel):
    """Single language translation response"""

    input_text: str
    source_lang: str
    target_lang: str
    output_text: str
    tone: Optional[str]
    detected_tone: Optional[str]


class TranslateMultiRequest(BaseModel):
    """Multiple language translation request"""

    text: str = Field(..., min_length=1, max_length=5000, description="Text to translate")
    source_lang: str = Field(..., min_length=2, max_length=10, description="Source language code")
    target_langs: list[str] = Field(..., min_items=1, max_items=2, description="Target language codes")
    tone: Optional[str] = Field(None, description="Translation tone")


class TranslateMultiResponse(BaseModel):
    """Multiple language translation response"""

    input_text: str
    source_lang: str
    target_langs: list[str]
    output_texts: list[str]
    tone: Optional[str]
    detected_tone: Optional[str]


# ============ Conversation Schemas ============


class ConversationTurnRequest(BaseModel):
    """Single conversation turn request"""

    text: str = Field(..., min_length=1, max_length=5000, description="Message text")
    source_lang: str = Field(..., description="Source language code")
    target_lang: str = Field(..., description="Target language code")
    tone: Optional[str] = Field(None, description="Optional tone override")


class ConversationTurnResponse(BaseModel):
    """Single conversation turn response"""

    input_text: str
    source_lang: str
    target_lang: str
    output_text: str
    detected_tone: Optional[str]
    tone: str


# ============ History Schemas ============


class HistorySaveRequest(BaseModel):
    """Save translation to history"""

    source_lang: str
    target_langs: list[str]
    input_text: str
    output_texts: list[str]
    tone: Optional[str] = None


class HistoryResponse(BaseModel):
    """History item response"""

    id: int
    source_lang: str
    target_langs: list[str]
    input_text: str
    output_texts: list[str]
    tone: Optional[str]
    detected_tone: Optional[str]
    is_favorite: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Favorites Schemas ============


class FavoriteRequest(BaseModel):
    """Add to favorites"""

    history_id: int


class FavoriteResponse(BaseModel):
    """Favorite item response"""

    id: int
    history_item: HistoryResponse


# ============ Community Schemas ============


class CommunitySubmissionRequest(BaseModel):
    """Submit a community translation"""

    phrase: str = Field(..., min_length=1, max_length=500)
    source_lang: str = Field(..., min_length=2, max_length=10)
    target_lang: str = Field(..., min_length=2, max_length=10)
    proposed_translation: str = Field(..., min_length=1, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)


class CommunitySubmissionResponse(BaseModel):
    """Community submission response"""

    id: int
    phrase: str
    source_lang: str
    target_lang: str
    proposed_translation: str
    notes: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Health Schemas ============


class HealthResponse(BaseModel):
    """Health check response"""

    status: str
    timestamp: datetime
