"""
Seed Script -- Pre-populate community_submission with verified Filipino slang/idioms.
Also migrates existing DB schemas to add new columns.
Run: python3 seed_community.py   (from /backend directory)
"""
import sys
import os

# Ensure app modules are importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime
from sqlalchemy import text
from app.db.session import SessionLocal, engine
from app.db.base import Base

# Import all models so Base.metadata has them
from app.db.models import (  # noqa: F401
    Device, Translation, TranslationOutput,
    Conversation, Participant, Message, Tone,
    OcrRequest, OcrText,
    DictionaryEntry, DictionaryLookup,
    CommunitySubmission, TranslationFeedback,
)


def migrate_schema():
    """Add new columns via ALTER TABLE if they don't exist yet."""
    columns_to_add = [
        ("community_submission", "origin", "VARCHAR(100)"),
        ("community_submission", "context", "VARCHAR(20) DEFAULT 'informal'"),
        ("community_submission", "is_verified", "BOOLEAN DEFAULT 0"),
        ("community_submission", "popularity_tier", "VARCHAR(20) DEFAULT 'rising'"),
        ("community_submission", "ai_reasoning", "TEXT"),
        ("community_submission", "last_scanned", "DATETIME"),
        ("community_submission", "sample_sentence", "TEXT"),
    ]

    with engine.connect() as conn:
        for table, col, col_type in columns_to_add:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
                print(f"  Added column {table}.{col}")
            except Exception:
                # Column already exists
                pass

    # Create translation_feedback table if it doesn't exist
    Base.metadata.create_all(bind=engine, checkfirst=True)
    print("  Schema migration complete")


def seed():
    """Seed the database with community entries."""
    entries = [
        {
            "phrase": "Werpa",
            "source_lang": "tl",
            "target_lang": "en",
            "proposed_translation": "Power (reversed) -- expression of support",
            "origin": "Metro Manila",
            "context": "informal",
            "sample_sentence": "Werpa sa lahat ng nagtatrabaho!",
            "notes": "Gay lingo popularized on social media",
            "status": "approved",
            "votes": 25,
            "is_verified": True,
            "popularity_tier": "popular",
            "ai_reasoning": "Widely used across Filipino social media platforms",
        },
        {
            "phrase": "Charot",
            "source_lang": "tl",
            "target_lang": "en",
            "proposed_translation": "Just kidding / not serious",
            "origin": "Metro Manila",
            "context": "informal",
            "sample_sentence": "Ang pangit mo! Charot lang!",
            "notes": "Gay lingo, equivalent of 'char'",
            "status": "approved",
            "votes": 30,
            "is_verified": True,
            "popularity_tier": "popular",
            "ai_reasoning": "Extremely popular slang used nationwide",
        },
        {
            "phrase": "Dasurv",
            "source_lang": "tl",
            "target_lang": "en",
            "proposed_translation": "Deserved / well-deserved",
            "origin": "Metro Manila",
            "context": "informal",
            "sample_sentence": "Panalo siya sa contest, dasurv!",
            "notes": "Gen Z slang from 'deserve'",
            "status": "approved",
            "votes": 22,
            "is_verified": True,
            "popularity_tier": "popular",
            "ai_reasoning": "Viral Gen Z slang, widely used on Twitter PH and TikTok",
        },
        {
            "phrase": "Omsim",
            "source_lang": "tl",
            "target_lang": "en",
            "proposed_translation": "For sure / definitely (reversed 'mismo')",
            "origin": "Metro Manila",
            "context": "informal",
            "sample_sentence": "Omsim ka talaga, pare!",
            "notes": "Reversed slang from 'mismo', Gen Z",
            "status": "pending",
            "votes": 5,
            "is_verified": False,
            "popularity_tier": "rising",
            "ai_reasoning": "Gaining traction in Filipino online communities, currently rising",
        },
        {
            "phrase": "Gid",
            "source_lang": "hil",
            "target_lang": "en",
            "proposed_translation": "Very / really (intensifier word in Hiligaynon)",
            "origin": "Western Visayas",
            "context": "informal",
            "sample_sentence": "Maayo gid ang imo obra!",
            "notes": "Common Hiligaynon intensifier",
            "status": "approved",
            "votes": 18,
            "is_verified": True,
            "popularity_tier": "popular",
            "ai_reasoning": "Essential Hiligaynon word, universally understood in Western Visayas",
        },
        {
            "phrase": "Ambot",
            "source_lang": "ceb",
            "target_lang": "en",
            "proposed_translation": "I don't know",
            "origin": "Visayas",
            "context": "informal",
            "sample_sentence": "Ambot nimo, wa ko kabalo!",
            "notes": "Common Cebuano expression",
            "status": "approved",
            "votes": 20,
            "is_verified": True,
            "popularity_tier": "popular",
            "ai_reasoning": "Standard Cebuano expression used daily across Visayas",
        },
        {
            "phrase": "Pakal",
            "source_lang": "ceb",
            "target_lang": "en",
            "proposed_translation": "Pretending / faking it",
            "origin": "Cebu",
            "context": "informal",
            "sample_sentence": "Nagpakal ra na siya nga busy.",
            "notes": "Cebuano street slang",
            "status": "approved",
            "votes": 15,
            "is_verified": True,
            "popularity_tier": "popular",
            "ai_reasoning": "Common Cebuano colloquial term",
        },
    ]

    db = SessionLocal()
    added = 0
    skipped = 0
    try:
        for entry in entries:
            existing = (
                db.query(CommunitySubmission)
                .filter(
                    CommunitySubmission.phrase == entry["phrase"],
                    CommunitySubmission.source_lang == entry["source_lang"],
                    CommunitySubmission.target_lang == entry["target_lang"],
                )
                .first()
            )
            if existing:
                skipped += 1
                continue

            sub = CommunitySubmission(**entry)
            db.add(sub)
            added += 1

        db.commit()
        print(f"\n  Added {added} entries, skipped {skipped} duplicates")

    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding community submissions...\n")
    print("[1/2] Migrating schema...")
    migrate_schema()
    print("[2/2] Seeding data...")
    seed()
    print("\nDone!")
