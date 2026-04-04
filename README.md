# Ano-Kamo?

Ano-Kamo? is a mobile translation application for Philippine languages. It supports text translation, real-time voice conversation, and camera-based OCR translation across Tagalog, Cebuano, Hiligaynon, and English. Translation is powered by Google Gemini with community-contributed glossary augmentation.

The name comes from the Cebuano and Hiligaynon greeting meaning "How are you?" — reflecting the app's focus on enabling natural communication across Filipino language groups.

---

## Supported Languages

| Code | Language |
|---|---|
| `tl` | Tagalog |
| `ceb` | Cebuano |
| `hil` | Hiligaynon |
| `en` | English |

---

## Features

**Text Translation**
- Translate between any pair of the four supported languages
- 2-way mode: one source to one target
- 3-way mode: one source to two targets simultaneously
- 12 tone options (Neutral, Formal, Respectful, Casual, Street, Taglish, Playful, Sarcastic, and more)
- Custom tone input validated via Gemini
- Community-verified phrase glossary injected into translation prompts (RAG)

**Voice Conversation**
- Real-time speech-to-text via Groq Whisper
- Two-speaker and three-speaker conversation modes with automatic translation per turn
- Text-to-speech playback via Azure Cognitive Services (Filipino neural voice)
- Tone refinement: rewrite and retranslate a message in a different register

**Camera / OCR**
- Capture or select an image to extract and translate visible text
- Text overlay with bounding boxes positioned on the original photo
- Language switching retranslates without recapturing the image

**Dictionary**
- Tap any translated word to look up its definition, pronunciation, part of speech, synonyms, root word, and an example sentence
- Results are cached in the database after the first lookup

**History**
- Full translation history grouped by date, filterable by device
- Conversation session history with per-message breakdown
- Favorite and star individual entries

**Community**
- Submit Filipino slang and regional phrases with a proposed translation
- AI-powered Linguistic Gatekeeper (Gemini) evaluates cultural relevance on submission
- Background Evolution Loop periodically re-evaluates rising terms and graduates them to the verified glossary
- Community voting: submissions reaching 10 net upvotes are auto-approved

---

## Architecture

The project is split into two independent services:

```
ANOKAMO/
├── backend/        # FastAPI REST API (Python)
└── frontend/       # React Native + Expo mobile app (TypeScript)
```

The mobile app communicates with the backend over HTTP. During development, the backend is exposed to the device via a local network IP or a tunnel (ngrok/localtunnel).

---

## Tech Stack

### Backend
- Python 3.11+
- FastAPI with Uvicorn
- SQLAlchemy 2.0 (ORM) + Alembic (migrations)
- SQLite for development, compatible with PostgreSQL for production
- Pydantic v2 for request/response validation
- httpx for external API calls
- Google Gemini 2.5 Flash-Lite (translation, OCR, dictionary, tone validation)
- Groq Cloud Whisper large-v3-turbo (speech-to-text)
- Azure Cognitive Services (text-to-speech, Filipino neural voice)
- gTTS as fallback TTS when Azure is unavailable

### Frontend
- React Native 0.81 with Expo 54
- TypeScript 5.3
- Expo Router 6 (file-based navigation)
- React Native Paper 5 (Material Design components)
- Axios (HTTP client)
- Expo Camera, Image Picker, AV (media access)
- Expo Blur (native blur effects on iOS)
- React Context for conversation and theme state

---

## Getting Started

### Requirements

- Python 3.11+
- Node.js 18+ and npm
- A Google Gemini API key
- A Groq API key (for speech-to-text)
- An Azure Cognitive Services speech key (for text-to-speech)

### Backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -e .

cp .env.example .env
# Edit .env and add your API keys

alembic upgrade head

uvicorn app.main:app --reload --port 8000
```

The API runs at `http://localhost:8000`. Documentation is available at `/docs`.

### Frontend

```bash
cd frontend

npm install

# Set the backend URL to your machine's local IP address
echo "EXPO_PUBLIC_API_BASE_URL=http://<your-ip>:8000" > .env

npx expo start
```

On the Expo developer menu, press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR code with the Expo Go app on a physical device.

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server status and timestamp |

### Translation

| Method | Endpoint | Description |
|---|---|---|
| POST | `/translate` | Translate to a single target language |
| POST | `/translate/multi` | Translate to up to two target languages |

```json
// POST /translate
{
  "text": "Kamusta ka?",
  "source_lang": "tl",
  "target_lang": "ceb",
  "tone": "casual",
  "device_id": "optional-uuid"
}
```

### Conversation

| Method | Endpoint | Description |
|---|---|---|
| POST | `/conversation` | Start a new conversation session |
| POST | `/conversation/{id}/message` | Send a message and receive translations |
| GET | `/conversation/{id}/messages` | Get all messages in a session |
| POST | `/conversation/refine` | Rewrite a message in a new tone and retranslate |
| POST | `/conversation/turn` | Single-turn translation without a session |
| POST | `/tone/validate` | Validate a custom tone string |

### History

| Method | Endpoint | Description |
|---|---|---|
| GET | `/history` | List translation history (filter by `?device_id=`) |
| POST | `/history` | Save a translation with one or more outputs |
| DELETE | `/history/{id}` | Delete one translation |
| DELETE | `/history/clear-all` | Delete all translation history |
| GET | `/history/conversations` | List conversation sessions with messages |
| DELETE | `/history/conversations/{id}` | Delete a conversation session |
| DELETE | `/history/conversations/clear-all` | Delete all conversation sessions |
| POST | `/history/conversations/{id}/star` | Toggle starred status |
| POST | `/favorites/toggle` | Toggle favorite on a translation output |
| GET | `/favorites` | List favorited outputs |

### Community

| Method | Endpoint | Description |
|---|---|---|
| POST | `/community/submissions` | Submit a phrase with a proposed translation |
| GET | `/community/submissions` | List submissions (filter by `?status=`) |
| POST | `/community/submissions/{id}/vote` | Vote on a submission (`?direction=1` or `-1`) |
| POST | `/feedback` | Submit like/dislike on a translation |
| GET | `/feedback/{id}/counts` | Get like and dislike counts |

### Dictionary

| Method | Endpoint | Description |
|---|---|---|
| POST | `/dictionary/lookup` | Look up a word with full lexical details |

### OCR

| Method | Endpoint | Description |
|---|---|---|
| POST | `/ocr/process-full` | Extract text from image, translate, return bounding boxes |
| POST | `/ocr/translate-blocks` | Retranslate stored OCR blocks to a new language |
| POST | `/ocr/extract` | Extract and translate text without bounding boxes (legacy) |

### Speech

| Method | Endpoint | Description |
|---|---|---|
| POST | `/speech/transcribe` | Transcribe audio file to text (multipart/form-data) |
| GET | `/speech/tts` | Convert text to speech, returns MP3 audio |

---

## Configuration

### Backend (.env)

```ini
DATABASE_URL=sqlite:///./app.db
DEBUG=False
LOG_LEVEL=INFO

# Restrict in production to your frontend domain
CORS_ORIGINS=["*"]

GEMINI_API_KEY=
GROQ_API_KEY=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=southeastasia
```

See `backend/.env.example` for the full template.

### Frontend (.env)

```ini
EXPO_PUBLIC_API_BASE_URL=http://<backend-host>:8000
```

---

## Development

### Running backend tests

```bash
cd backend
pytest tests/ -v
```

### Clearing the Expo cache

```bash
cd frontend
npx expo start --clear
```

### Resetting the database

```bash
cd backend
rm app.db
alembic upgrade head
```

---

## Documentation

- [Backend README](backend/README.md) — setup, models, full API reference with curl examples
- [Frontend README](frontend/README.md) — setup, screen descriptions, component overview, build instructions
