"""
CRUD Operations for all database models
"""
from datetime import datetime
from typing import Optional, List

from sqlalchemy.orm import Session

from app.db.models import (
    Device, Translation, TranslationOutput,
    Conversation, Participant, Message, Tone,
    OcrRequest, OcrText,
    DictionaryEntry, DictionaryLookup,
    CommunitySubmission,
)


# ──────────────────── Device ────────────────────
def get_or_create_device(db: Session, device_type: str, os_version: str = None) -> Device:
    device = Device(device_type=device_type, os_version=os_version)
    db.add(device)
    db.commit()
    db.refresh(device)
    return device

def get_device(db: Session, device_id: str) -> Optional[Device]:
    return db.query(Device).filter(Device.device_id == device_id).first()


# ──────────────────── Tone ──────────────────────
def get_or_create_tone(db: Session, label: str) -> Tone:
    tone = db.query(Tone).filter(Tone.tone_label == label).first()
    if not tone:
        tone = Tone(tone_label=label)
        db.add(tone)
        db.commit()
        db.refresh(tone)
    return tone


# ──────────────────── Translation ───────────────
def create_translation(
    db: Session,
    input_text: str,
    input_language: str,
    method: str = "text",
    multi_target: bool = False,
    device_id: str = None,
) -> Translation:
    t = Translation(
        input_text=input_text,
        input_language=input_language,
        method=method,
        multi_target=multi_target,
        device_id=device_id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

def create_translation_output(
    db: Session,
    translation_id: str,
    target_language: str,
    output_text: str,
    detected_tone: str = None,
) -> TranslationOutput:
    o = TranslationOutput(
        translation_id=translation_id,
        target_language=target_language,
        output_text=output_text,
        detected_tone=detected_tone,
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    return o

def get_all_translations(db: Session, skip: int = 0, limit: int = 100) -> List[Translation]:
    return (
        db.query(Translation)
        .order_by(Translation.timestamp.desc())
        .offset(skip).limit(limit).all()
    )

def get_favorites(db: Session, skip: int = 0, limit: int = 100) -> List[TranslationOutput]:
    return (
        db.query(TranslationOutput)
        .filter(TranslationOutput.is_favorite == True)
        .offset(skip).limit(limit).all()
    )

def toggle_favorite(db: Session, output_id: str) -> Optional[TranslationOutput]:
    o = db.query(TranslationOutput).filter(TranslationOutput.output_id == output_id).first()
    if o:
        o.is_favorite = not o.is_favorite
        db.commit()
        db.refresh(o)
    return o

def delete_translation(db: Session, translation_id: str) -> bool:
    t = db.query(Translation).filter(Translation.translation_id == translation_id).first()
    if t:
        db.delete(t)
        db.commit()
        return True
    return False

def clear_all_history(db: Session) -> int:
    """Delete all translations and their outputs. Returns count deleted."""
    count = db.query(Translation).count()
    db.query(TranslationOutput).delete()
    db.query(Translation).delete()
    db.commit()
    return count


# ──────────────────── Conversation ──────────────
def create_conversation(
    db: Session,
    mode: str,
    view_mode: str,
    participants: list,
    device_id: str = None,
) -> Conversation:
    conv = Conversation(mode=mode, view_mode=view_mode, device_id=device_id)
    db.add(conv)
    db.flush()
    for p in participants:
        part = Participant(
            conversation_id=conv.conversation_id,
            speaker_label=p["speaker_label"],
            preferred_language=p["preferred_language"],
        )
        db.add(part)
    db.commit()
    db.refresh(conv)
    return conv

def get_conversation(db: Session, conversation_id: str) -> Optional[Conversation]:
    return db.query(Conversation).filter(Conversation.conversation_id == conversation_id).first()

def add_message(
    db: Session,
    conversation_id: str,
    speaker_abc: str,
    text: str,
    translated_text: str,
    language: str,
    detected_language: str = None,
    tone_id: str = None,
) -> Message:
    msg = Message(
        conversation_id=conversation_id,
        speaker_abc=speaker_abc,
        text=text,
        translated_text=translated_text,
        language=language,
        detected_language=detected_language,
        tone_id=tone_id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def get_messages(db: Session, conversation_id: str) -> List[Message]:
    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.timestamp.asc())
        .all()
    )


# ──────────────────── OCR ───────────────────────
def create_ocr_request(
    db: Session,
    device_id: str = None,
    source_image_path: str = None,
    detected_language: str = None,
) -> OcrRequest:
    ocr = OcrRequest(
        device_id=device_id,
        source_image_path=source_image_path,
        detected_language=detected_language,
    )
    db.add(ocr)
    db.commit()
    db.refresh(ocr)
    return ocr

def create_ocr_text(
    db: Session,
    ocr_id: str,
    extracted_text: str,
    translated_text: str = None,
) -> OcrText:
    txt = OcrText(
        ocr_id=ocr_id,
        extracted_text=extracted_text,
        translated_text=translated_text,
    )
    db.add(txt)
    db.commit()
    db.refresh(txt)
    return txt


# ──────────────────── Dictionary ────────────────
def find_dictionary_entry(db: Session, word: str, language: str) -> Optional[DictionaryEntry]:
    return (
        db.query(DictionaryEntry)
        .filter(DictionaryEntry.word == word, DictionaryEntry.language == language)
        .first()
    )

def create_dictionary_entry(
    db: Session,
    word: str,
    language: str,
    definition: str = None,
    example_sentence: str = None,
    pronunciation: str = None,
    part_of_speech: str = None,
    synonyms: str = None,
    root: str = None,
    example_translation: str = None,
) -> DictionaryEntry:
    entry = DictionaryEntry(
        word=word,
        language=language,
        definition=definition,
        example_sentence=example_sentence,
        pronunciation=pronunciation,
        part_of_speech=part_of_speech,
        synonyms=synonyms,
        root=root,
        example_translation=example_translation,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

def create_dictionary_lookup(
    db: Session,
    entry_id: str,
    device_id: str = None,
    translation_id: str = None,
) -> DictionaryLookup:
    lookup = DictionaryLookup(
        device_id=device_id,
        translation_id=translation_id,
        entry_id=entry_id,
    )
    db.add(lookup)
    db.commit()
    db.refresh(lookup)
    return lookup


# ──────────────────── Community ─────────────────
def create_submission(db: Session, **kwargs) -> CommunitySubmission:
    sub = CommunitySubmission(**kwargs)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub

def get_all_submissions(
    db: Session, skip: int = 0, limit: int = 100, status: str = None
) -> List[CommunitySubmission]:
    q = db.query(CommunitySubmission).order_by(CommunitySubmission.created_at.desc())
    if status:
        q = q.filter(CommunitySubmission.status == status)
    return q.offset(skip).limit(limit).all()

def vote_submission(db: Session, submission_id: int, direction: int = 1) -> Optional[CommunitySubmission]:
    sub = db.query(CommunitySubmission).filter(CommunitySubmission.id == submission_id).first()
    if sub:
        sub.votes = (sub.votes or 0) + direction
        # Auto-verify when votes reach +10
        if sub.votes >= 10 and not sub.is_verified:
            sub.is_verified = True
            sub.status = "approved"
        db.commit()
        db.refresh(sub)
    return sub


def get_verified_phrases(
    db: Session, source_lang: str = None, target_lang: str = None
) -> List[CommunitySubmission]:
    """Get community-verified phrases, optionally filtered by language pair."""
    q = db.query(CommunitySubmission).filter(CommunitySubmission.is_verified == True)
    if source_lang:
        q = q.filter(CommunitySubmission.source_lang == source_lang)
    if target_lang:
        q = q.filter(CommunitySubmission.target_lang == target_lang)
    return q.all()
