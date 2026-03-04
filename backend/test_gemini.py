"""Quick test to verify google.genai SDK works with gemini-2.5-flash-lite."""
from google import genai
from google.genai import types

API_KEY = "AIzaSyD4lEtbxzJKqoJbQbowEO_XeDjT6O2NKi4"

client = genai.Client(api_key=API_KEY)
print("Client created OK")

# Test: with system_instruction and response_mime_type
try:
    response = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents='Tagalog→Cebuano|Magandang umaga',
        config=types.GenerateContentConfig(
            system_instruction='You are a translator. Reply ONLY with JSON: {"t":"<translated>","tone":"neutral"}',
            temperature=0.2,
            max_output_tokens=256,
            response_mime_type="application/json",
        ),
    )
    print("SUCCESS:", response.text)
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
