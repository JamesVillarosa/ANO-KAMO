"""
Seed Script — Migrate schema + seed verified Filipino slang/idioms.
Run: python3 seed_community.py   (from /backend directory)
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.db.session import SessionLocal, engine
from app.db.models import CommunitySubmission
from app.db.base import Base


def migrate_schema():
    """Add new columns to existing community_submission table if missing."""
    migrations = [
        ("origin", "ALTER TABLE community_submission ADD COLUMN origin VARCHAR(100)"),
        ("context", "ALTER TABLE community_submission ADD COLUMN context VARCHAR(20) DEFAULT 'informal'"),
        ("is_verified", "ALTER TABLE community_submission ADD COLUMN is_verified BOOLEAN DEFAULT 0"),
    ]
    with engine.connect() as conn:
        for col_name, sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"  + Added column '{col_name}'")
            except Exception as e:
                if "duplicate column" in str(e).lower():
                    print(f"  = Column '{col_name}' already exists")
                else:
                    print(f"  = Column '{col_name}': {e}")


SEED_DATA = [
    {
        "phrase": "Werpa",
        "proposed_translation": "Power (reversed slang, expression of strength/support)",
        "source_lang": "tl",
        "target_lang": "en",
        "notes": "Gen Z slang - reversed word for power",
        "origin": "Metro Manila",
        "context": "informal",
        "votes": 15,
        "is_verified": True,
        "status": "approved",
    },
    {
        "phrase": "Charot",
        "proposed_translation": "Just kidding / I am joking",
        "source_lang": "tl",
        "target_lang": "en",
        "notes": "Gay lingo that became mainstream - used to soften a statement",
        "origin": "Metro Manila",
        "context": "informal",
        "votes": 25,
        "is_verified": True,
        "status": "approved",
    },
    {
        "phrase": "Dasurv",
        "proposed_translation": "Deserved (you deserve it, well-earned)",
        "source_lang": "tl",
        "target_lang": "en",
        "notes": "Gen Z slang - playful spelling of deserve",
        "origin": "Metro Manila",
        "context": "informal",
        "votes": 18,
        "is_verified": True,
        "status": "approved",
    },
    {
        "phrase": "Ambot",
        "proposed_translation": "I dont know (expression of uncertainty or frustration)",
        "source_lang": "ceb",
        "target_lang": "en",
        "notes": "Common Cebuano expression",
        "origin": "Cebu",
        "context": "informal",
        "votes": 22,
        "is_verified": True,
        "status": "approved",
    },
    {
        "phrase": "Pakal",
        "proposed_translation": "Fake / bootleg / counterfeit",
        "source_lang": "ceb",
        "target_lang": "en",
        "notes": "Visayan slang for counterfeit goods",
        "origin": "Visayas",
        "context": "informal",
        "votes": 12,
        "is_verified": True,
        "status": "approved",
    },
]


def seed():
    # Step 1: Ensure tables exist
    Base.metadata.create_all(bind=engine)

    # Step 2: Migrate missing columns
    print("Migrating schema...")
    migrate_schema()

    # Step 3: Seed data
    print("\nSeeding data...")
    db = SessionLocal()
    added = 0
    try:
        for entry in SEED_DATA:
            exists = (
                db.query(CommunitySubmission)
                .filter(
                    CommunitySubmission.phrase == entry["phrase"],
                    CommunitySubmission.source_lang == entry["source_lang"],
                    CommunitySubmission.target_lang == entry["target_lang"],
                )
                .first()
            )
            if exists:
                print(f"  SKIP: '{entry['phrase']}' (already exists)")
                continue

            sub = CommunitySubmission(**entry)
            db.add(sub)
            added += 1
            print(f"  ADDED: '{entry['phrase']}' ({entry['source_lang']}->{entry['target_lang']})")

        db.commit()
        print(f"\nDone! Seeded {added} phrases ({len(SEED_DATA) - added} skipped)")

        # Verify
        verified = db.query(CommunitySubmission).filter(CommunitySubmission.is_verified == True).count()
        total = db.query(CommunitySubmission).count()
        print(f"Total in DB: {total} | Verified: {verified}")
    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=== Community Seed Script ===\n")
    seed()
