from datetime import datetime

from fastapi import APIRouter

from app.db.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Returns server status and current UTC timestamp."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
    }
