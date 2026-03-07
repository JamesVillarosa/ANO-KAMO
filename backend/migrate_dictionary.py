"""
One-time migration script:
1. Adds new columns (part_of_speech, synonyms, root) to dictionary_entry table
2. Purges all "poisoned" cache entries with mock placeholder text
"""
import sqlite3
import sys
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Add new columns if they don't exist
    existing_cols = [row[1] for row in cursor.execute("PRAGMA table_info(dictionary_entry)").fetchall()]

    new_cols = {
        "part_of_speech": "VARCHAR(100)",
        "synonyms": "TEXT",
        "root": "VARCHAR(200)",
    }

    for col, col_type in new_cols.items():
        if col not in existing_cols:
            cursor.execute(f"ALTER TABLE dictionary_entry ADD COLUMN {col} {col_type}")
            print(f"  ✓ Added column: {col}")
        else:
            print(f"  – Column already exists: {col}")

    # 2. Purge poisoned entries (mock/placeholder data)
    cursor.execute("""
        DELETE FROM dictionary_entry
        WHERE definition LIKE 'The meaning of%'
           OR definition LIKE 'Mock%'
           OR definition LIKE 'Ang kahulugan ng%'
           OR definition LIKE '(Dictionary temporarily%'
    """)
    deleted = cursor.rowcount
    print(f"  ✓ Purged {deleted} poisoned dictionary entries")

    conn.commit()
    conn.close()
    print("Migration complete!")


if __name__ == "__main__":
    migrate()
