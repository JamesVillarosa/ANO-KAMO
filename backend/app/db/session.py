"""
Database Session Management
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings
from app.db.base import Base

# Create engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=settings.DEBUG,
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Session:
    """Get database session for dependency injection"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database - create all tables and run column migrations"""
    Base.metadata.create_all(bind=engine)
    # Add translation_type column to existing databases that predate this column
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE translation ADD COLUMN translation_type VARCHAR(10) DEFAULT 'text'"
            ))
            conn.commit()
        except Exception:
            pass  # Column already exists
