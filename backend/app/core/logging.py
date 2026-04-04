import logging
import logging.config
from datetime import datetime

from app.core.config import settings

LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": LOG_FORMAT,
        },
        "detailed": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(pathname)s:%(lineno)d - %(message)s",
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
        },
        "file": {
            "formatter": "detailed",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": f"logs/ano-kamo-{datetime.now().strftime('%Y-%m-%d')}.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
        },
    },
    "root": {
        "level": settings.LOG_LEVEL,
        "handlers": ["default", "file"],
    },
}


def setup_logging():
    """Initialize logging"""
    logging.config.dictConfig(LOGGING_CONFIG)
    return logging.getLogger(__name__)
