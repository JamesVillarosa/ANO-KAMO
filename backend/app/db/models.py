"""
SQLAlchemy Models for Ano-Kamo Backend
Matches the ERD from the academic paper with all 11 entities.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Text, DateTime, Boolean, Integer,
    ForeignKey, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


def gen_uuid():
    return str(uuid.uuid4())


# ──────────────────────────── DEVICE ────────────────────────────
class Device(Base):
    __tablename__ = "device"

    device_id = Column(String(36), primary_key=True, default=gen_uuid)
    device_type = Column(String(20), nullable=False)          # iOS / Android
    os_version = Column(String(50), nullable=True)

    translations = relationship("Translation", back_populates="device")
    conversations = relationship("Conversation", back_populates="device")
    ocr_requests = relationship("OcrRequest", back_populates="device")
    dictionary_lookups = relationship("DictionaryLookup", back_populates="device")
    community_submissions = relationship("CommunitySubmission", back_populates="device")


# ──────────────────────────── TONE ──────────────────────────────
class Tone(Base):
    __tablename__ = "tone"

    tone_id = Column(String(36), primary_key=True, default=gen_uuid)
    tone_label = Column(String(50), nullable=False, unique=True)
    # neutral, polite, angry, joking, sarcastic, playful, formal, informal

    messages = relationship("Message", back_populates="tone")


# ──────────────────────────── TRANSLATION ───────────────────────
class Translation(Base):
    __tablename__ = "translation"

    translation_id = Column(String(36), primary_key=True, default=gen_uuid)
    device_id = Column(String(36), ForeignKey("device.device_id"), nullable=True)
    input_text = Column(Text, nullable=False)
    input_language = Column(String(10), nullable=False)
    method = Column(String(10), nullable=False, default="text")   # text, voice, ocr
    multi_target = Column(Boolean, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    device = relationship("Device", back_populates="translations")
    outputs = relationship("TranslationOutput", back_populates="translation", cascade="all, delete-orphan")
    dictionary_lookups = relationship("DictionaryLookup", back_populates="translation")


# ──────────────────────────── TRANSLATION OUTPUT ────────────────
class TranslationOutput(Base):
    __tablename__ = "translation_output"

    output_id = Column(String(36), primary_key=True, default=gen_uuid)
    translation_id = Column(String(36), ForeignKey("translation.translation_id"), nullable=False)
    target_language = Column(String(10), nullable=False)
    output_text = Column(Text, nullable=False)
    detected_tone = Column(String(50), nullable=True)
    is_favorite = Column(Boolean, default=False)

    translation = relationship("Translation", back_populates="outputs")


# ──────────────────────────── CONVERSATION ──────────────────────
class Conversation(Base):
    __tablename__ = "conversation"

    conversation_id = Column(String(36), primary_key=True, default=gen_uuid)
    device_id = Column(String(36), ForeignKey("device.device_id"), nullable=True)
    mode = Column(String(20), nullable=False, default="two_way")        # two_way / three_way
    view_mode = Column(String(20), nullable=False, default="face_to_face")  # face_to_face / side_by_side
    started_at = Column(DateTime(timezone=True), server_default=func.now())

    device = relationship("Device", back_populates="conversations")
    participants = relationship("Participant", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


# ──────────────────────────── PARTICIPANT ───────────────────────
class Participant(Base):
    __tablename__ = "participant"

    participant_id = Column(String(36), primary_key=True, default=gen_uuid)
    conversation_id = Column(String(36), ForeignKey("conversation.conversation_id"), nullable=False)
    speaker_label = Column(String(1), nullable=False)  # A, B, C
    preferred_language = Column(String(10), nullable=False)

    conversation = relationship("Conversation", back_populates="participants")


# ──────────────────────────── MESSAGE ───────────────────────────
class Message(Base):
    __tablename__ = "message"

    message_id = Column(String(36), primary_key=True, default=gen_uuid)
    conversation_id = Column(String(36), ForeignKey("conversation.conversation_id"), nullable=False)
    speaker_abc = Column(String(1), nullable=False)       # A, B, C
    text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=True)
    language = Column(String(10), nullable=False)
    detected_language = Column(String(10), nullable=True)
    tone_id = Column(String(36), ForeignKey("tone.tone_id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("Conversation", back_populates="messages")
    tone = relationship("Tone", back_populates="messages")


# ──────────────────────────── OCR REQUEST ───────────────────────
class OcrRequest(Base):
    __tablename__ = "ocr_request"

    ocr_id = Column(String(36), primary_key=True, default=gen_uuid)
    device_id = Column(String(36), ForeignKey("device.device_id"), nullable=True)
    source_image_path = Column(Text, nullable=True)
    detected_language = Column(String(10), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    device = relationship("Device", back_populates="ocr_requests")
    texts = relationship("OcrText", back_populates="ocr_request", cascade="all, delete-orphan")


# ──────────────────────────── OCR TEXT ──────────────────────────
class OcrText(Base):
    __tablename__ = "ocr_text"

    text_id = Column(String(36), primary_key=True, default=gen_uuid)
    ocr_id = Column(String(36), ForeignKey("ocr_request.ocr_id"), nullable=False)
    extracted_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=True)

    ocr_request = relationship("OcrRequest", back_populates="texts")


# ──────────────────────────── DICTIONARY ENTRY ──────────────────
class DictionaryEntry(Base):
    __tablename__ = "dictionary_entry"

    entry_id = Column(String(36), primary_key=True, default=gen_uuid)
    word = Column(String(200), nullable=False, index=True)
    language = Column(String(10), nullable=False)
    definition = Column(Text, nullable=True)
    example_sentence = Column(Text, nullable=True)
    pronunciation = Column(String(200), nullable=True)
    part_of_speech = Column(String(100), nullable=True)
    synonyms = Column(Text, nullable=True)  # JSON array as string
    root = Column(String(200), nullable=True)
    example_translation = Column(Text, nullable=True)

    lookups = relationship("DictionaryLookup", back_populates="entry")


# ──────────────────────────── DICTIONARY LOOKUP ─────────────────
class DictionaryLookup(Base):
    __tablename__ = "dictionary_lookup"

    lookup_id = Column(String(36), primary_key=True, default=gen_uuid)
    device_id = Column(String(36), ForeignKey("device.device_id"), nullable=True)
    translation_id = Column(String(36), ForeignKey("translation.translation_id"), nullable=True)
    entry_id = Column(String(36), ForeignKey("dictionary_entry.entry_id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    device = relationship("Device", back_populates="dictionary_lookups")
    translation = relationship("Translation", back_populates="dictionary_lookups")
    entry = relationship("DictionaryEntry", back_populates="lookups")


# ──────────────────────────── COMMUNITY SUBMISSION ──────────────
class CommunitySubmission(Base):
    __tablename__ = "community_submission"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(36), ForeignKey("device.device_id"), nullable=True)
    phrase = Column(Text, nullable=False)
    source_lang = Column(String(10), nullable=False)
    target_lang = Column(String(10), nullable=False)
    proposed_translation = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    origin = Column(String(100), nullable=True)          # Regional origin: Metro Manila, Cebu, etc.
    context = Column(String(20), default="informal")      # formal / informal
    status = Column(String(20), default="pending", index=True)
    votes = Column(Integer, default=0)
    is_verified = Column(Boolean, default=False, index=True)  # Auto-set True when votes >= 10
    popularity_tier = Column(String(20), default="rising", index=True)  # popular / rising / inactive
    ai_reasoning = Column(Text, nullable=True)          # Gemini's analysis of cultural presence
    last_scanned = Column(DateTime(timezone=True), nullable=True)  # Last Evolution Loop scan
    sample_sentence = Column(Text, nullable=True)       # Example usage from contributor
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    device = relationship("Device", back_populates="community_submissions")


# ──────────────────────────── TRANSLATION FEEDBACK ──────────────
class TranslationFeedback(Base):
    __tablename__ = "translation_feedback"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    translation_id = Column(String(36), ForeignKey("translation.translation_id"), nullable=False)
    device_id = Column(String(36), ForeignKey("device.device_id"), nullable=True)
    feedback_type = Column(String(10), nullable=False, index=True)  # "like" or "dislike"
    suggested_text = Column(Text, nullable=True)          # Better translation suggestion
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    translation = relationship("Translation")
