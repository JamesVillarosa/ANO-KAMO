"""
Speech Endpoints — STT (Groq Whisper) and TTS (gTTS)
"""
from fastapi import APIRouter, File, UploadFile, Query
from fastapi.responses import Response

from app.services.speech_service import SpeechService

router = APIRouter()


@router.post("/speech/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Query("tl", description="Language code: tl, en, ceb, hil"),
):
    """
    Transcribe audio to text using Groq Whisper V3.
    Accepts audio file (webm, wav, mp3, m4a, etc.)
    """
    audio_data = await file.read()
    result = await SpeechService.transcribe_audio(
        audio_data=audio_data,
        language=language,
        filename=file.filename or "audio.webm",
    )
    return result


@router.get("/speech/tts")
async def text_to_speech(
    text: str = Query(..., description="Text to speak"),
    lang: str = Query("tl", description="Language code: tl, en, ceb, hil"),
):
    """
    Convert text to speech using Azure Cognitive Services (BlessicaNeural).
    Returns MP3 audio stream.
    """
    audio_bytes = await SpeechService.synthesize_speech(text=text, language=lang)

    if audio_bytes is None:
        return Response(content=b"", status_code=204)

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=speech.mp3",
            "Cache-Control": "public, max-age=3600",
        },
    )
