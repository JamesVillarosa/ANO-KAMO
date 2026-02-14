"""
OCR Endpoints — Image text extraction and translation
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.crud import create_ocr_request, create_ocr_text
from app.db.session import get_db
from app.db.schemas import OcrExtractRequest, OcrExtractResponse
from app.services.ocr_service import OcrService

router = APIRouter()


@router.post("/ocr/extract", response_model=OcrExtractResponse)
async def extract_and_translate(request: OcrExtractRequest, db: Session = Depends(get_db)):
    """
    Extract text from an image and translate it.
    Accepts base64-encoded image. Uses Gemini Vision for OCR.
    """
    result = OcrService.extract_and_translate(
        image_base64=request.image_base64,
        target_lang=request.target_lang,
        source_lang=request.source_lang,
    )

    # Persist to DB
    ocr = create_ocr_request(
        db,
        device_id=request.device_id,
        detected_language=result.get("detected_language"),
    )
    create_ocr_text(
        db,
        ocr_id=ocr.ocr_id,
        extracted_text=result["extracted_text"],
        translated_text=result.get("translated_text"),
    )

    return {
        "ocr_id": ocr.ocr_id,
        "extracted_text": result["extracted_text"],
        "translated_text": result.get("translated_text", ""),
        "detected_language": result.get("detected_language"),
    }
