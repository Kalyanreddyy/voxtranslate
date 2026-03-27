"""Application configuration using Pydantic Settings."""

import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Core settings
    APP_NAME: str = "VoxTranslate"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "dev-secret-key-change-in-production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://voxtranslate:voxtranslate@localhost:5432/voxtranslate"
    DATABASE_ECHO: bool = False

    # Redis/Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # External APIs
    ELEVENLABS_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    # Storage
    STORAGE_PATH: str = "/data/voxtranslate"
    TEMP_PATH: str = "/tmp/voxtranslate"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost", "http://localhost:80"]

    # Celery
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: list[str] = ["json"]
    CELERY_TIMEZONE: str = "UTC"
    CELERY_WORKER_CONCURRENCY: int = 4

    # Feature flags
    ENABLE_VIDEO_DOWNLOAD: bool = True
    ENABLE_TRANSCRIPTION: bool = True
    ENABLE_OST_DETECTION: bool = True
    ENABLE_TRANSLATION: bool = True
    ENABLE_EXPORT: bool = True

    # Timeouts (in seconds)
    DOWNLOAD_TIMEOUT: int = 3600
    TRANSCRIPTION_TIMEOUT: int = 3600
    TRANSLATION_TIMEOUT: int = 1800

    # Video constraints
    MAX_VIDEO_DURATION_SECONDS: int = 300

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

    def __init__(self, **data):
        super().__init__(**data)
        # Create required directories
        Path(self.STORAGE_PATH).mkdir(parents=True, exist_ok=True)
        Path(self.TEMP_PATH).mkdir(parents=True, exist_ok=True)


# Global settings instance
settings = Settings()
