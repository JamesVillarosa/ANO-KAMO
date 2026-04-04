import sqlite3
import os

db_path = r"c:\Users\Yayay Villarosa\Downloads\SP Passed Cutie!!!\Coding Implementation\ANOKAMO\backend\app.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM community_submission LIMIT 10;")
    rows = cursor.fetchall()
    print("Community Submissions:")
    for row in rows:
        print(row)
    
    cursor.execute("SELECT * FROM translation_feedback LIMIT 10;")
    rows = cursor.fetchall()
    print("\nTranslation Feedback:")
    for row in rows:
        print(row)
    
    conn.close()
else:
    print(f"File not found: {db_path}")
