"""
Ano-Kamo Backend Main Application
FastAPI setup with CORS, routers, and middleware
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.core.config import settings
from app.db.session import init_db
from app.services.community_service import evolution_loop

# Setup logging
logger = logging.getLogger(__name__)

_evolution_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    global _evolution_task
    # Startup
    logger.info("Starting Ano-Kamo Backend...")
    init_db()
    logger.info("Database initialized")
    _evolution_task = asyncio.create_task(evolution_loop())
    logger.info("Evolution Loop background task started")
    yield
    # Shutdown
    if _evolution_task:
        _evolution_task.cancel()
        try:
            await _evolution_task
        except asyncio.CancelledError:
            pass
    logger.info("Shutting down Ano-Kamo Backend...")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered Filipino language translation API",
    version=settings.VERSION,
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_v1_router, prefix="/api/v1", tags=["v1"])


@app.get("/")
async def root():
    """Root endpoint - redirects to docs"""
    return {
        "message": "Welcome to Ano-Kamo Backend",
        "docs": "/docs",
        "redoc": "/redoc",
        "api_version": "v1",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
