"""
Pydantic Schemas for Request/Response Validation
Covers all ERD entities for the Ano-Kamo application.
"""
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# ──────────────────── Device ────────────────────
class DeviceRegisterRequest(BaseModel):
    device_type: str = Field(..., description="iOS or Android")
    os_version: Optional[str] = None

class DeviceResponse(BaseModel):
    device_id: str
    device_type: str
    os_version: Optional[str]
    class Config:
        from_attributes = True


# ──────────────────── Translation ───────────────
class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    source_lang: str = Field(..., min_length=2, max_length=10)
    target_lang: str = Field(..., min_length=2, max_length=10)
    tone: Optional[str] = None
    device_id: Optional[str] = None

class TranslateResponse(BaseModel):
    translation_id: str
    input_text: str
    source_lang: str
    target_lang: str
    output_text: str
    detected_tone: Optional[str]
    is_favorite: bool = False

class TranslateMultiRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    source_lang: str = Field(..., min_length=2, max_length=10)
    target_langs: List[str] = Field(..., min_length=1, max_length=2)
    tone: Optional[str] = None
    device_id: Optional[str] = None

class TranslateMultiResponse(BaseModel):
    translation_id: str
    input_text: str
    source_lang: str
    target_langs: List[str]
    output_texts: List[str]
    detected_tone: Optional[str]


class RefineRequest(BaseModel):
    original_text: str = Field(..., min_length=1, max_length=5000)
    source_lang: str = Field(..., min_length=2, max_length=10)
    target_langs: List[str] = Field(..., min_length=1, max_length=2)
    new_tone: str
    device_id: Optional[str] = None

class RefineResponse(BaseModel):
    original_text: str
    refined_text: str
    source_lang: str
    target_langs: List[str]
    output_texts: List[str]
    tone: str


# ──────────────────── Conversation ──────────────
class ConversationCreateRequest(BaseModel):
    mode: str = Field("two_way", description="two_way or three_way")
    view_mode: str = Field("face_to_face", description="face_to_face or side_by_side")
    participants: List[dict] = Field(..., description="List of {speaker_label, preferred_language}")
    device_id: Optional[str] = None

class ConversationResponse(BaseModel):
    conversation_id: str
    mode: str
    view_mode: str
    started_at: datetime
    participants: List[dict]
    class Config:
        from_attributes = True

class MessageSendRequest(BaseModel):
    speaker_abc: str = Field(..., max_length=1, description="A, B, or C")
    text: str = Field(..., min_length=1, max_length=5000)
    language: str = Field(..., min_length=2, max_length=10)
    target_lang: str = Field(..., min_length=2, max_length=10)
    tone: Optional[str] = None

class MessageResponse(BaseModel):
    message_id: str
    speaker_abc: str
    text: str
    translated_text: Optional[str]
    language: str
    detected_tone: Optional[str]
    timestamp: datetime
    class Config:
        from_attributes = True

class ConversationTurnRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    source_lang: str
    target_lang: str
    tone: Optional[str] = None

class ConversationTurnResponse(BaseModel):
    input_text: str
    source_lang: str
    target_lang: str
    output_text: str
    detected_tone: Optional[str]
    tone: str


# ──────────────────── OCR ───────────────────────
class OcrExtractRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    source_lang: Optional[str] = None
    target_lang: str = Field(..., min_length=2, max_length=10)
    device_id: Optional[str] = None

class OcrExtractResponse(BaseModel):
    ocr_id: str
    extracted_text: str
    translated_text: str
    detected_language: Optional[str]


# ──────────────────── Dictionary ────────────────
class DictionaryLookupRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=200)
    source_lang: str = Field(..., min_length=2, max_length=10)
    target_lang: str = Field(..., min_length=2, max_length=10)
    device_id: Optional[str] = None
    translation_id: Optional[str] = None

class DictionaryEntryResponse(BaseModel):
    entry_id: str
    word: str
    language: str
    pronunciation: Optional[str]
    definition: Optional[str]
    example_sentence: Optional[str]
    part_of_speech: Optional[str] = None
    synonyms: Optional[List[str]] = None
    root: Optional[str] = None
    example_translation: Optional[str] = None
    class Config:
        from_attributes = True


# ──────────────────── History ───────────────────
class HistoryItemResponse(BaseModel):
    translation_id: str
    input_text: str
    input_language: str
    method: str
    multi_target: bool
    timestamp: datetime
    outputs: List[dict]
    class Config:
        from_attributes = True

class HistorySaveRequest(BaseModel):
    source_lang: str
    target_langs: List[str]
    input_text: str
    output_texts: List[str]
    tone: Optional[str] = None


# ──────────────────── Favorites ─────────────────
class FavoriteToggleRequest(BaseModel):
    output_id: str


# ──────────────────── Community ─────────────────
class CommunitySubmissionRequest(BaseModel):
    phrase: str = Field(..., min_length=1, max_length=500)
    source_lang: str = Field(..., min_length=2, max_length=10)
    target_lang: str = Field(..., min_length=2, max_length=10)
    proposed_translation: str = Field(..., min_length=1, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    origin: Optional[str] = Field(None, max_length=100, description="Regional origin: Metro Manila, Cebu, etc.")
    context: Optional[str] = Field("informal", description="formal or informal")
    sample_sentence: Optional[str] = Field(None, max_length=500, description="Example sentence using this term")
    device_id: Optional[str] = None

class CommunitySubmissionResponse(BaseModel):
    id: int
    phrase: str
    source_lang: str
    target_lang: str
    proposed_translation: str
    notes: Optional[str]
    origin: Optional[str]
    context: Optional[str]
    sample_sentence: Optional[str]
    status: str
    votes: int
    is_verified: bool
    popularity_tier: Optional[str]
    ai_reasoning: Optional[str]
    last_scanned: Optional[datetime]
    created_at: datetime
    class Config:
        from_attributes = True


# ──────────────────── Translation Feedback ──────
class TranslationFeedbackRequest(BaseModel):
    translation_id: str = Field(..., description="ID of the translation being rated")
    feedback_type: str = Field(..., pattern="^(like|dislike)$", description="'like' or 'dislike'")
    suggested_text: Optional[str] = Field(None, max_length=1000, description="Suggested better translation")
    device_id: Optional[str] = None

class TranslationFeedbackResponse(BaseModel):
    id: int
    translation_id: str
    feedback_type: str
    suggested_text: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True


# ──────────────────── Health ────────────────────
class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
