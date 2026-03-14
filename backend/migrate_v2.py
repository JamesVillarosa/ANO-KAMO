import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Add example_translation column
    existing_cols = [row[1] for row in cursor.execute("PRAGMA table_info(dictionary_entry)").fetchall()]
    
    if "example_translation" not in existing_cols:
        cursor.execute("ALTER TABLE dictionary_entry ADD COLUMN example_translation TEXT")
        print("  ✓ Added column: example_translation")
    else:
        print("  – Column already exists: example_translation")

    # Purge old cache to force new format
    cursor.execute("DELETE FROM dictionary_entry")
    print(f"  ✓ Purged {cursor.rowcount} dictionary entries to refresh cache with new Pivot logic")

    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
