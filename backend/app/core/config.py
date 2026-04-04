from typing import Any

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Ano-Kamo Backend"
    VERSION: str = "0.1.0"

    DATABASE_URL: str = "sqlite:///./app.db"

    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Allow all origins in development. Restrict this in production deployment.
    CORS_ORIGINS: list[str] = ["*"]

    GEMINI_API_KEY: str = ""
    WHISPER_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    AZURE_SPEECH_KEY: str = ""
    AZURE_SPEECH_REGION: str = "southeastasia"

    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **data: Any) -> None:
        super().__init__(**data)


settings = Settings()
