"""
Speech Service
Handles STT (Speech-to-Text) and TTS (Text-to-Speech) via Whisper API (placeholder)
"""
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class SpeechService:
    """Service for handling speech-to-text and text-to-speech"""

    @staticmethod
    def transcribe_audio(audio_data: bytes, language: str = "en") -> dict:
        """
        Convert audio to text using Whisper API
        
        TODO: Integrate with Whisper API when ready
        Currently returns mock transcription
        
        Args:
            audio_data: Audio bytes to transcribe
            language: Language code (e.g., "en", "tl")
            
        Returns:
            Dictionary with transcribed text
        """
        logger.info(f"Transcribing audio in {language}...")

        if not settings.WHISPER_API_KEY or settings.WHISPER_API_KEY.startswith("sk-placeholder"):
            logger.warning(
                "Using mock transcription (Whisper API not configured). "
                "Configure WHISPER_API_KEY in .env to use real transcription."
            )
            return {
                "text": "[Mock transcription] Please configure WHISPER_API_KEY",
                "language": language,
                "confidence": 0.0,
            }

        # TODO: Call real Whisper API
        return {
            "text": "[Mock transcription]",
            "language": language,
            "confidence": 0.0,
        }

    @staticmethod
    def synthesize_speech(text: str, language: str = "tl") -> Optional[bytes]:
        """
        Convert text to speech using Whisper or similar API
        
        TODO: Integrate with TTS API (e.g., Google Cloud TTS, Whisper)
        Currently returns None/mock
        
        Args:
            text: Text to convert to speech
            language: Target language code
            
        Returns:
            Audio bytes or None if not configured
        """
        logger.info(f"Synthesizing speech in {language}: {text}")

        if not settings.WHISPER_API_KEY or settings.WHISPER_API_KEY.startswith("sk-placeholder"):
            logger.warning(
                "TTS not configured (Whisper API key missing). "
                "Configure WHISPER_API_KEY in .env to enable TTS."
            )
            return None

        # TODO: Call real TTS API
        return None
