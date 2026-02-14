# Ano-Kamo Backend

FastAPI server for AI-powered Filipino language translation.

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- pip

### Installation & Running

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e .

# Create .env file from example
cp .env.example .env

# Run database migrations
alembic upgrade head

# Start server (development with auto-reload)
uvicorn app.main:app --reload --port 8000
```

Server will be available at:
- **API**: `http://localhost:8000`
- **Docs (Swagger UI)**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 📁 Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app setup
│   ├── api/
│   │   └── v1/
│   │       ├── router.py       # API v1 routes
│   │       └── endpoints/
│   │           ├── health.py
│   │           ├── translate.py
│   │           ├── conversation.py
│   │           ├── history.py
│   │           └── community.py
│   ├── core/
│   │   ├── config.py           # Config & env variables
│   │   └── logging.py          # Logging setup
│   ├── services/
│   │   ├── translation_service.py   # Gemini integration
│   │   └── speech_service.py        # Whisper integration
│   ├── db/
│   │   ├── session.py          # Database session
│   │   ├── base.py             # Declarative base
│   │   ├── models.py           # SQLAlchemy models
│   │   ├── schemas.py          # Pydantic schemas
│   │   └── crud.py             # CRUD operations
│   └── migrations/             # Alembic migrations
├── tests/
│   ├── test_health.py
│   └── test_translate.py
├── pyproject.toml              # Project metadata & dependencies
├── .env.example                # Environment template
└── README.md                   # This file
```

## 🗄️ Database Models

### TranslationHistory
Stores all translations performed by users.

```python
class TranslationHistory(Base):
    id: int                      # Primary key
    source_lang: str            # Source language code (e.g., "tl", "en")
    target_langs: list[str]     # Target language codes (JSON)
    input_text: str             # Original text
    output_texts: list[str]     # Translated texts (JSON)
    tone: str | None            # Tone used in translation
    detected_tone: str | None   # Auto-detected tone
    created_at: datetime
    is_favorite: bool = False
```

### CommunitySubmission
User-submitted phrase translations for community review.

```python
class CommunitySubmission(Base):
    id: int
    phrase: str                 # Original phrase
    source_lang: str
    target_lang: str
    proposed_translation: str
    notes: str | None           # Optional notes from submitter
    created_at: datetime
    status: str = "pending"     # pending, approved, rejected
```

## 📡 API Endpoints

### Health Check
```bash
curl http://localhost:8000/api/v1/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Translate Single Language
```bash
curl -X POST http://localhost:8000/api/v1/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, how are you?",
    "source_lang": "en",
    "target_lang": "tl",
    "tone": "friendly"
  }'
```

Response:
```json
{
  "input_text": "Hello, how are you?",
  "source_lang": "en",
  "target_lang": "tl",
  "output_text": "Halo, paano ka?",
  "tone": "friendly",
  "detected_tone": "friendly"
}
```

### Translate Multiple Languages
```bash
curl -X POST http://localhost:8000/api/v1/translate/multi \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, how are you?",
    "source_lang": "en",
    "target_langs": ["tl", "ceb"],
    "tone": "neutral"
  }'
```

Response:
```json
{
  "input_text": "Hello, how are you?",
  "source_lang": "en",
  "target_langs": ["tl", "ceb"],
  "output_texts": [
    "Halo, paano ka?",
    "Halo, paano ka?"
  ],
  "tone": "neutral",
  "detected_tone": "neutral"
}
```

### Conversation Turn
```bash
curl -X POST http://localhost:8000/api/v1/conversation/turn \
  -H "Content-Type: application/json" \
  -d '{
    "text": "How are you doing today?",
    "source_lang": "en",
    "target_lang": "tl",
    "tone": null
  }'
```

Response:
```json
{
  "input_text": "How are you doing today?",
  "source_lang": "en",
  "target_lang": "tl",
  "output_text": "Paano ka ngayon?",
  "detected_tone": "casual",
  "tone": "casual"
}
```

### Get History
```bash
curl http://localhost:8000/api/v1/history
```

### Save to History
```bash
curl -X POST http://localhost:8000/api/v1/history \
  -H "Content-Type: application/json" \
  -d '{
    "source_lang": "en",
    "target_langs": ["tl"],
    "input_text": "Hello",
    "output_texts": ["Halo"],
    "tone": "neutral"
  }'
```

### Add to Favorites
```bash
curl -X POST http://localhost:8000/api/v1/favorites \
  -H "Content-Type: application/json" \
  -d '{"history_id": 1}'
```

### Get Favorites
```bash
curl http://localhost:8000/api/v1/favorites
```

### Remove from Favorites
```bash
curl -X DELETE http://localhost:8000/api/v1/favorites/1
```

### Submit Community Phrase
```bash
curl -X POST http://localhost:8000/api/v1/community/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "phrase": "Mahal kita",
    "source_lang": "tl",
    "target_lang": "en",
    "proposed_translation": "I love you",
    "notes": "Common Filipino expression"
  }'
```

### Get Community Submissions
```bash
curl http://localhost:8000/api/v1/community/submissions
```

## 🛠️ Development

### Run Tests
```bash
pytest tests/ -v
```

### Check Coverage
```bash
pytest tests/ --cov=app --cov-report=html
```

### Format Code
```bash
# Using black
black app/

# Using isort for imports
isort app/
```

### Lint
```bash
# Using flake8
flake8 app/

# Using pylint
pylint app/
```

## 🔧 Configuration

All configuration comes from environment variables in `.env`:

```ini
# Database
DATABASE_URL=sqlite:///./app.db

# Debugging
DEBUG=False
LOG_LEVEL=INFO

# CORS (for frontend)
CORS_ORIGINS=["http://localhost:3000","http://localhost:19000"]

# External APIs (placeholder - add real keys when ready)
GEMINI_API_KEY=your-key-here
WHISPER_API_KEY=your-key-here
```

See `.env.example` for all available options.

## 🗄️ Database Migrations

Using Alembic for migrations:

```bash
# Create a new migration
alembic revision --autogenerate -m "Add new field"

# Apply migrations
alembic upgrade head

# Revert last migration
alembic downgrade -1
```

## 🔮 Future Enhancements

- [ ] Real Gemini API integration for translations
- [ ] Whisper API integration for STT/TTS
- [ ] User authentication (JWT)
- [ ] Rate limiting
- [ ] Caching (Redis)
- [ ] WebSocket for real-time conversation
- [ ] Advanced tone detection with ML models
- [ ] Support for more Filipino dialects
- [ ] Admin dashboard for community submissions

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Change port
uvicorn app.main:app --reload --port 8001
```

### Database Locked
```bash
# Delete database and restart
rm app.db
alembic upgrade head
```

### Import Errors
```bash
# Reinstall in editable mode
pip install -e .
```

## 📝 Notes

- All endpoints return JSON
- Use standard HTTP status codes (200, 201, 400, 404, 500)
- Timestamps are in ISO 8601 format
- Language codes follow ISO 639-1 standard (tl=Tagalog, ceb=Cebuano, etc.)

## 📚 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.0 Docs](https://docs.sqlalchemy.org/20/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [Pydantic v2 Docs](https://docs.pydantic.dev/2.0/)
