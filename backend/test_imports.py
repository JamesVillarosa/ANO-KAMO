#!/usr/bin/env python3
"""Quick import test for all backend services."""
import sys

print("Testing imports...")

try:
    from app.services.translation_service import TranslationService
    print("  translation_service: OK")
except Exception as e:
    print(f"  translation_service: FAILED - {e}")

try:
    from app.services.speech_service import SpeechService
    print("  speech_service: OK")
except Exception as e:
    print(f"  speech_service: FAILED - {e}")

try:
    from app.main import app
    print("  app.main: OK")
except Exception as e:
    print(f"  app.main: FAILED - {e}")

print("Import test complete.")
