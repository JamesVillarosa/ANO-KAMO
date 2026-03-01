"""
Speech Service
STT via Groq Cloud (Whisper V3) — free tier, high accuracy for Filipino languages
TTS via Azure Cognitive Services — natural Filipino voice (BlessicaNeural)
"""
import io
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Map app language codes to Whisper language codes
WHISPER_LANG_MAP = {
    "tl": "tl",      # Tagalog
    "en": "en",      # English
    "ceb": "ceb",    # Cebuano (Whisper supports it natively)
    "hil": "tl",     # Hiligaynon → closest: Tagalog
}

# Map app language codes to Azure voice names
AZURE_VOICE_MAP = {
    "tl": "fil-PH-BlessicaNeural",   # Filipino female (natural Pinoy accent)
    "en": "en-PH-RosaNeural",        # English with Filipino accent
    "ceb": "fil-PH-BlessicaNeural",  # Cebuano → use Filipino voice
    "hil": "fil-PH-BlessicaNeural",  # Hiligaynon → use Filipino voice
}

# Azure TTS language locale mapping
AZURE_LANG_MAP = {
    "tl": "fil-PH",
    "en": "en-PH",
    "ceb": "fil-PH",
    "hil": "fil-PH",
}


class SpeechService:
    """Service for handling speech-to-text and text-to-speech"""

    @staticmethod
    async def transcribe_audio(audio_data: bytes, language: str = "tl", filename: str = "audio.webm") -> dict:
        """
        Transcribe audio using Groq Cloud Whisper V3.
        """
        logger.info(f"Transcribing audio in {language} via Groq Whisper...")

        if not settings.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not set. Cannot transcribe.")
            return {
                "text": "[Error] Please configure GROQ_API_KEY in .env",
                "language": language,
            }

        whisper_lang = WHISPER_LANG_MAP.get(language, "tl")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={
                        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    },
                    data={
                        "model": "whisper-large-v3-turbo",
                        "language": whisper_lang,
                        "response_format": "json",
                    },
                    files={
                        "file": (filename, audio_data),
                    },
                )

                if response.status_code != 200:
                    logger.error(f"Groq API error {response.status_code}: {response.text}")
                    return {
                        "text": f"[Transcription error: {response.status_code}]",
                        "language": language,
                    }

                result = response.json()
                text = result.get("text", "").strip()
                logger.info(f"Transcribed: {text[:100]}")
                return {
                    "text": text,
                    "language": language,
                }

        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return {
                "text": f"[Transcription error: {str(e)}]",
                "language": language,
            }

    @staticmethod
    async def synthesize_speech(text: str, language: str = "tl") -> Optional[bytes]:
        """
        Convert text to speech using Azure Cognitive Services.
        Uses BlessicaNeural for natural Filipino accent.
        
        Returns MP3 audio bytes, or None on failure.
        """
        if not text or not text.strip():
            return None

        if not settings.AZURE_SPEECH_KEY:
            logger.warning("AZURE_SPEECH_KEY not set. Cannot synthesize speech.")
            return None

        voice_name = AZURE_VOICE_MAP.get(language, "fil-PH-BlessicaNeural")
        lang_locale = AZURE_LANG_MAP.get(language, "fil-PH")
        region = settings.AZURE_SPEECH_REGION or "southeastasia"

        logger.info(f"Synthesizing speech with Azure voice {voice_name}: {text[:50]}...")

        # SSML for Azure TTS
        ssml = f"""<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='{lang_locale}'>
    <voice name='{voice_name}'>
        <prosody rate='0%' pitch='0%'>{text}</prosody>
    </voice>
</speak>"""

        tts_url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    tts_url,
                    headers={
                        "Ocp-Apim-Subscription-Key": settings.AZURE_SPEECH_KEY,
                        "Content-Type": "application/ssml+xml",
                        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
                        "User-Agent": "AnoKamo",
                    },
                    content=ssml,
                )

                if response.status_code != 200:
                    logger.error(f"Azure TTS error {response.status_code}: {response.text[:200]}")
                    return None

                logger.info(f"Azure TTS success, {len(response.content)} bytes")
                return response.content

        except Exception as e:
            logger.error(f"Azure TTS failed: {e}")
            return None
