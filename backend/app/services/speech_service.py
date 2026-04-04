import io
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Map app language codes to Whisper language codes
# Whisper large-v3-turbo supports: tl (Tagalog), en (English)
# Cebuano and Hiligaynon are NOT natively supported by Whisper, so we use
# Filipino/Tagalog as the closest match for better accuracy
WHISPER_LANG_MAP = {
    "tl": "tl",      # Tagalog
    "en": "en",      # English
    "ceb": "tl",     # Cebuano → use Tagalog (closest supported)
    "hil": "tl",     # Hiligaynon → use Tagalog (closest supported)
}

# Whisper "prompt" hints — providing example phrases in the target language
# helps Whisper understand what domain/words to expect
WHISPER_PROMPTS = {
    "tl": "Magandang umaga, kumusta ka na, salamat po, magandang hapon, magandang gabi, paalam",
    "en": "Good morning, how are you, thank you, good afternoon, good evening, goodbye",
    "ceb": "Maayong buntag, kumusta ka, salamat, maayong hapon, maayong gabii, babay",
    "hil": "Maayong aga, kumusta ka, salamat gid, maayong hapon, maayong gab-i, paalam",
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
        logger.info(f"Transcribing audio in '{language}' ({len(audio_data)} bytes) via Groq Whisper...")

        if not settings.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not set. Cannot transcribe.")
            return {
                "text": "[Error] Please configure GROQ_API_KEY in .env",
                "language": language,
            }

        whisper_lang = WHISPER_LANG_MAP.get(language, "tl")
        prompt_hint = WHISPER_PROMPTS.get(language, "")
        logger.info(f"Whisper language code: '{whisper_lang}' (from app code '{language}'), prompt hint: '{prompt_hint[:60]}...'")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                form_data = {
                    "model": "whisper-large-v3-turbo",
                    "language": whisper_lang,
                    "response_format": "json",
                }
                # Add prompt hint for better accuracy
                if prompt_hint:
                    form_data["prompt"] = prompt_hint

                response = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={
                        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    },
                    data=form_data,
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
                logger.info(f"Transcribed ({language}): {text[:100]}")
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
        Convert text to speech.
        Strategy: Try Azure first, fall back to gTTS.
        """
        if not text or not text.strip():
            return None

        # Try Azure first
        audio = await SpeechService._azure_tts(text, language)
        if audio:
            return audio

        # Fallback to gTTS
        audio = await SpeechService._gtts_fallback(text, language)
        return audio

    @staticmethod
    async def _azure_tts(text: str, language: str) -> Optional[bytes]:
        """Azure Cognitive Services TTS."""
        if not settings.AZURE_SPEECH_KEY:
            logger.warning("AZURE_SPEECH_KEY not set, skipping Azure TTS.")
            return None

        voice_name = AZURE_VOICE_MAP.get(language, "fil-PH-BlessicaNeural")
        lang_locale = AZURE_LANG_MAP.get(language, "fil-PH")
        region = settings.AZURE_SPEECH_REGION or "southeastasia"

        logger.info(f"Azure TTS: voice={voice_name}, text='{text[:50]}...'")

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

    @staticmethod
    async def _gtts_fallback(text: str, language: str) -> Optional[bytes]:
        """
        gTTS fallback — uses Google Translate's TTS engine.
        Free, no API key needed, works for Filipino languages.
        """
        logger.info(f"gTTS fallback for '{text[:50]}...' in {language}")

        # gTTS language mapping
        gtts_lang_map = {
            "tl": "tl",    # Filipino/Tagalog
            "en": "en",    # English
            "ceb": "tl",   # Cebuano → Filipino (closest)
            "hil": "tl",   # Hiligaynon → Filipino (closest)
        }
        gtts_lang = gtts_lang_map.get(language, "tl")

        try:
            from gtts import gTTS
            tts = gTTS(text=text, lang=gtts_lang, slow=False)
            buf = io.BytesIO()
            tts.write_to_fp(buf)
            buf.seek(0)
            audio_bytes = buf.read()
            logger.info(f"gTTS success, {len(audio_bytes)} bytes")
            return audio_bytes
        except ImportError:
            logger.warning("gTTS not installed, cannot use fallback TTS")
            return None
        except Exception as e:
            logger.error(f"gTTS failed: {e}")
            return None
