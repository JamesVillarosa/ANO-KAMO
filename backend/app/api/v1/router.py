from fastapi import APIRouter

from app.api.v1.endpoints import (
    health,
    translate,
    conversation,
    history,
    community,
    ocr,
    dictionary,
    speech,
)

router = APIRouter()

router.include_router(health.router, tags=["health"])
router.include_router(translate.router, tags=["translation"])
router.include_router(conversation.router, tags=["conversation"])
router.include_router(history.router, tags=["history"])
router.include_router(community.router, tags=["community"])
router.include_router(ocr.router, tags=["ocr"])
router.include_router(dictionary.router, tags=["dictionary"])
router.include_router(speech.router, tags=["speech"])

