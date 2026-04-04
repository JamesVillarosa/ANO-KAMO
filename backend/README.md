# Ano-Kamo Backend

FastAPI server that powers the Ano-Kamo translation application. Handles text translation, voice transcription, OCR, dictionary lookups, conversation sessions, and community phrase submissions. All AI features are backed by Google Gemini and Groq Whisper.

---

## Prerequisites

- Python 3.11 or higher
- A Google Gemini API key (required for translation, OCR, and dictionary)
- A Groq API key (required for speech-to-text via Whisper)
- An Azure Cognitive Services speech key (required for text-to-speech)

---

## Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install the package and its dependencies
pip install -e .

# Create your environment file from the template
cp .env.example .env
# Edit .env and fill in your API keys

# Apply database migrations
alembic upgrade head

# Start the development server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

Interactive documentation is served at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                     # FastAPI app, CORS middleware, lifespan hooks
│   ├── api/v1/
│   │   ├── router.py               # Combines all v1 endpoint routers
│   │   └── endpoints/
│   │       ├── health.py           # Health check
│   │       ├── translate.py        # Single and multi-target translation
│   │       ├── conversation.py     # Session-based conversation and tone refinement
│   │       ├── history.py          # Translation and conversation history
│   │       ├── community.py        # Community phrase submissions and voting
│   │       ├── dictionary.py       # Word lookup
│   │       ├── ocr.py              # Image OCR and translation
│   │       └── speech.py           # Speech-to-text and text-to-speech
│   ├── core/
│   │   ├── config.py               # Settings loaded from .env via Pydantic
│   │   └── logging.py              # Rotating file + console logging setup
│   ├── db/
│   │   ├── base.py                 # SQLAlchemy declarative base
│   │   ├── session.py              # Engine, session factory, and init_db()
│   │   ├── models.py               # ORM models (11 entities)
│   │   ├── schemas.py              # Pydantic request/response schemas
│   │   └── crud.py                 # Database access functions
│   ├── services/
│   │   ├── translation_service.py  # Gemini translation, tone detection, refinement
│   │   ├── speech_service.py       # Groq Whisper STT + Azure/gTTS TTS
│   │   ├── ocr_service.py          # Gemini Vision OCR with bounding boxes
│   │   ├── dictionary_service.py   # Gemini dictionary lookup with DB caching
│   │   └── community_service.py    # Linguistic Gatekeeper + Evolution Loop
│   └── migrations/                 # Alembic migration scripts
├── tests/
│   ├── conftest.py
│   ├── test_health.py
│   └── test_translate.py
├── pyproject.toml                  # Package metadata and dependencies
├── alembic.ini                     # Alembic configuration
└── .env.example                    # Environment variable template
```

---

## Database Models

The database contains 14 tables. The main entities are:

| Model | Description |
|---|---|
| `Device` | Identifies a mobile device by UUID |
| `Translation` | One translation request (input text, language, method) |
| `TranslationOutput` | One translated result per target language |
| `Conversation` | A two-way or three-way conversation session |
| `Participant` | A speaker within a conversation with their preferred language |
| `Message` | A single message within a conversation |
| `Tone` | A reusable tone label (neutral, formal, casual, etc.) |
| `OcrRequest` | An OCR session linked to a device |
| `OcrText` | Extracted text from an OCR request |
| `DictionaryEntry` | A cached word entry with definition, pronunciation, and examples |
| `DictionaryLookup` | A record of a word lookup event |
| `CommunitySubmission` | A user-submitted phrase with proposed translation |
| `TranslationCache` | In-database cache for translation results |
| `TranslationFeedback` | Like/dislike feedback on a translation output |

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns server status and current timestamp |

### Translation

| Method | Path | Description |
|---|---|---|
| POST | `/translate` | Translate text to a single target language |
| POST | `/translate/multi` | Translate text to up to two target languages simultaneously |

Supported language codes: `tl` (Tagalog), `ceb` (Cebuano), `hil` (Hiligaynon), `en` (English).

```bash
# Single translation
curl -X POST http://localhost:8000/api/v1/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Kumusta ka?", "source_lang": "tl", "target_lang": "en", "tone": "casual"}'

# Multi-target translation
curl -X POST http://localhost:8000/api/v1/translate/multi \
  -H "Content-Type: application/json" \
  -d '{"text": "Kumusta ka?", "source_lang": "tl", "target_langs": ["ceb", "hil"]}'
```

### Conversation

| Method | Path | Description |
|---|---|---|
| POST | `/conversation` | Create a new conversation session |
| POST | `/conversation/{id}/message` | Send a message and receive translations |
| GET | `/conversation/{id}/messages` | Retrieve all messages in a session |
| POST | `/conversation/refine` | Rewrite a message in a new tone and retranslate |
| POST | `/conversation/turn` | Single-turn translation without a session |
| POST | `/tone/validate` | Validate a custom tone string |

### History

| Method | Path | Description |
|---|---|---|
| GET | `/history` | List translation history, optionally filtered by `device_id` |
| POST | `/history` | Create a history entry with one or more outputs |
| DELETE | `/history/{id}` | Delete a single translation from history |
| DELETE | `/history/clear-all` | Delete all translation history |
| GET | `/history/conversations` | List conversation sessions with their messages |
| DELETE | `/history/conversations/{id}` | Delete a conversation and all its messages |
| DELETE | `/history/conversations/clear-all` | Delete all conversations |
| POST | `/history/conversations/{id}/star` | Toggle starred status on a conversation |
| POST | `/favorites/toggle` | Toggle favorite status on a translation output |
| GET | `/favorites` | List favorited translation outputs |

### Community

| Method | Path | Description |
|---|---|---|
| POST | `/community/submissions` | Submit a new phrase with a proposed translation |
| GET | `/community/submissions` | List submissions, optionally filtered by status |
| POST | `/community/submissions/{id}/vote` | Upvote or downvote a submission |
| POST | `/feedback` | Submit like/dislike feedback on a translation |
| GET | `/feedback/{id}/counts` | Get like and dislike counts for a translation |

### Dictionary

| Method | Path | Description |
|---|---|---|
| POST | `/dictionary/lookup` | Look up a word's definition, pronunciation, synonyms, and examples |

### OCR

| Method | Path | Description |
|---|---|---|
| POST | `/ocr/process-full` | Extract text from an image, translate, and return bounding boxes |
| POST | `/ocr/translate-blocks` | Retranslate existing OCR blocks to a different language |
| POST | `/ocr/extract` | Legacy: extract and translate without bounding boxes |

### Speech

| Method | Path | Description |
|---|---|---|
| POST | `/speech/transcribe` | Transcribe audio to text via Groq Whisper |
| GET | `/speech/tts` | Convert text to speech via Azure (MP3 response) |

---

## Configuration

Copy `.env.example` to `.env` and set the following variables:

```ini
DATABASE_URL=sqlite:///./app.db

DEBUG=False
LOG_LEVEL=INFO

# Allow all origins during development. Restrict in production.
CORS_ORIGINS=["*"]

# Required for translation, OCR, and dictionary features
GEMINI_API_KEY=

# Required for speech-to-text (Groq Cloud Whisper)
GROQ_API_KEY=

# Required for text-to-speech (Azure Cognitive Services)
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=southeastasia
```

---

## Database Migrations

The project uses Alembic for schema migrations.

```bash
# Apply all pending migrations
alembic upgrade head

# Create a new migration after modifying models.py
alembic revision --autogenerate -m "description of change"

# Revert the most recent migration
alembic downgrade -1
```

On startup, `init_db()` is called automatically. It runs `CREATE TABLE IF NOT EXISTS` for all models and applies any additive schema patches (e.g., adding columns) gracefully.

---

## Running Tests

```bash
pytest tests/ -v
```

---

## Troubleshooting

**Port already in use**
```bash
uvicorn app.main:app --reload --port 8001
```

**Database locked or corrupted**
```bash
rm app.db
alembic upgrade head
```

**Import errors after installing a new dependency**
```bash
pip install -e .
```
