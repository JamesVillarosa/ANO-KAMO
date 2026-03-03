"""
OCR Endpoints — Image text extraction, translation, and scanning
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session

from app.db.crud import create_ocr_request, create_ocr_text
from app.db.session import get_db
from app.db.schemas import OcrExtractRequest, OcrExtractResponse
from app.services.ocr_service import OcrService

router = APIRouter()


# ─── Scan (real-time overlay — Tesseract) ───

class OcrScanRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded image")
    source_lang: str = Field("tl", description="Source language: tl, en, ceb, hil")

class TextBlockResponse(BaseModel):
    text: str
    x: int
    y: int
    width: int
    height: int
    confidence: float

class OcrScanResponse(BaseModel):
    blocks: List[TextBlockResponse]
    image_width: int
    image_height: int
    error: Optional[str] = None


@router.post("/ocr/scan", response_model=OcrScanResponse)
async def scan_text_blocks(request: OcrScanRequest):
    """
    Scan image for text blocks with bounding boxes.
    Uses Tesseract OCR — fast, free, returns coordinates for overlay.
    No translation, no DB save — designed for real-time camera scanning.
    """
    result = OcrService.scan_text_blocks(
        image_base64=request.image_base64,
        source_lang=request.source_lang,
    )
    return result


# ─── Extract + Translate (existing — Gemini Vision) ───

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
