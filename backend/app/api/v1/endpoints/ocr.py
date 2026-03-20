"""
OCR Endpoints — Text extraction, scanning, and full OCR processing with translation
"""
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session
from app.services.ocr_service import OcrService
from app.db.session import get_db
from app.db.crud import create_translation, create_translation_output

logger = logging.getLogger(__name__)
router = APIRouter()


# ──────────────── Request / Response Schemas ────────────────

class OcrScanRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    source_lang: str = Field("tl", description="Source language code")


class OcrScanTranslateRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    source_lang: str = Field("tl", description="Source language code")
    target_lang: str = Field("en", description="Target language code for translation")


class TextBlockOut(BaseModel):
    text: str
    translated_text: str = ""
    x: int
    y: int
    width: int
    height: int
    confidence: float = 0.0


class OcrScanResponse(BaseModel):
    blocks: List[dict]
    image_width: int
    image_height: int
    error: Optional[str] = None


class OcrScanTranslateResponse(BaseModel):
    blocks: List[TextBlockOut]
    image_width: int
    image_height: int
    error: Optional[str] = None


class OcrProcessFullRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    source_lang: Optional[str] = Field(None, description="Source language code (null = auto-detect)")
    target_lang: str = Field(..., description="Target language code for translation")
    device_id: Optional[str] = None


class OcrFullBlock(BaseModel):
    text: str
    translated_text: str
    box: List[int] = Field(..., description="[x, y, width, height]")
    confidence: float = 0.0


class OcrProcessFullResponse(BaseModel):
    blocks: List[OcrFullBlock]
    image_width: int
    image_height: int
    full_extracted_text: str = ""
    full_translated_text: str = ""
    error: Optional[str] = None


class OcrExtractRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    source_lang: Optional[str] = None
    target_lang: str = Field(..., min_length=2, max_length=10)
    device_id: Optional[str] = None


# ──────────────── Endpoints ────────────────

@router.post("/ocr/scan", response_model=OcrScanResponse)
async def ocr_scan(request: OcrScanRequest):
    """Scan image for text blocks with bounding boxes (Tesseract). No translation."""
    result = OcrService.scan_text_blocks(
        image_base64=request.image_base64,
        source_lang=request.source_lang,
    )
    return result


@router.post("/ocr/scan-translate", response_model=OcrScanTranslateResponse)
async def ocr_scan_translate(request: OcrScanTranslateRequest):
    """
    Scan image for text blocks with bounding boxes (Tesseract)
    AND translate each block using Gemini. For real-time live scan.
    """
    result = OcrService.scan_and_translate(
        image_base64=request.image_base64,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
    )
    return result


@router.post("/ocr/process-full", response_model=OcrProcessFullResponse)
async def ocr_process_full(request: OcrProcessFullRequest, db: Session = Depends(get_db)):
    """
    Full OCR processing for captured/gallery images.
    Returns extracted text, translated text, and bounding box coordinates.
    """
    result = OcrService.process_full_ocr(
        image_base64=request.image_base64,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
    )
    # Save extracted + translated text to history
    if result.get("full_extracted_text"):
        try:
            t = create_translation(
                db,
                input_text=result["full_extracted_text"],
                input_language=request.source_lang or "auto",
                method="ocr",
                multi_target=False,
                device_id=request.device_id,
                translation_type="ocr",
            )
            create_translation_output(
                db,
                translation_id=t.translation_id,
                target_language=request.target_lang,
                output_text=result.get("full_translated_text", ""),
            )
        except Exception as e:
            logger.warning(f"OCR history save skipped: {e}")
    return result


class OcrTranslateBlocksRequest(BaseModel):
    blocks: List[dict] = Field(..., description="Pre-extracted OCR blocks with text and box")
    source_lang: str = Field("tl")
    target_lang: str = Field("en")
    device_id: Optional[str] = None


class OcrTranslateBlocksResponse(BaseModel):
    blocks: List[OcrFullBlock]
    error: Optional[str] = None


@router.post("/ocr/translate-blocks", response_model=OcrTranslateBlocksResponse)
async def ocr_translate_blocks(request: OcrTranslateBlocksRequest):
    """Translate pre-extracted OCR blocks without re-running Tesseract."""
    if not request.blocks:
        return {"blocks": []}

    texts = [b.get("text", "") for b in request.blocks]

    if request.source_lang == request.target_lang:
        return {"blocks": [
            {"text": b.get("text", ""), "translated_text": b.get("text", ""),
             "box": b.get("box", [0, 0, 0, 0]), "confidence": b.get("confidence", 0)}
            for b in request.blocks
        ]}

    try:
        translated_texts = OcrService._batch_translate(
            texts=texts,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            context="signage, menu, label, or document",
        )
    except Exception as e:
        logger.error(f"translate-blocks error: {e}")
        translated_texts = texts[:]

    result_blocks = []
    for i, block in enumerate(request.blocks):
        result_blocks.append({
            "text": block.get("text", ""),
            "translated_text": translated_texts[i] if i < len(translated_texts) else block.get("text", ""),
            "box": block.get("box", [0, 0, 0, 0]),
            "confidence": block.get("confidence", 0),
        })
    return {"blocks": result_blocks}


@router.post("/ocr/extract")
async def ocr_extract(request: OcrExtractRequest):
    """
    Legacy: Extract text from image and translate it (Gemini Vision).
    """
    result = OcrService.extract_and_translate(
        image_base64=request.image_base64,
        target_lang=request.target_lang,
        source_lang=request.source_lang,
    )
    return {
        "ocr_id": "0",
        "extracted_text": result.get("extracted_text", ""),
        "translated_text": result.get("translated_text", ""),
        "detected_language": result.get("detected_language"),
    }
