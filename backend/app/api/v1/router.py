"""
API v1 Router
Combines all v1 endpoints
"""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    health,
    translate,
    conversation,
    history,
    community,
)

router = APIRouter()

# Include endpoint routers
router.include_router(health.router, tags=["health"])
router.include_router(translate.router, tags=["translation"])
router.include_router(conversation.router, tags=["conversation"])
router.include_router(history.router, tags=["history"])
router.include_router(community.router, tags=["community"])
