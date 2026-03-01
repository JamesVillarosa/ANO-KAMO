"""
Application Configuration
Settings loaded from environment variables via Pydantic
"""
from typing import Any

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # App Info
    APP_NAME: str = "Ano-Kamo Backend"
    VERSION: str = "0.1.0"

    # Database
    DATABASE_URL: str = "sqlite:///./app.db"

    # Debug & Logging
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:19000",
        "http://10.0.2.2:8000",
    ]

    # External APIs
    GEMINI_API_KEY: str = ""
    WHISPER_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    AZURE_SPEECH_KEY: str = ""
    AZURE_SPEECH_REGION: str = "southeastasia"

    class Config:
        """Pydantic config"""

        env_file = ".env"
        case_sensitive = True

    def __init__(self, **data: Any) -> None:
        super().__init__(**data)


# Global settings instance
settings = Settings()
