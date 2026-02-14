"""
Health Check Endpoint
"""
from datetime import datetime

from fastapi import APIRouter

from app.db.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Returns server status and current timestamp
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
    }
