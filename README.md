# Ano-Kamo? 🎤🌍

**An AI-powered multimodal Filipino language translation app**

Translate between Tagalog, Cebuano, and Hiligaynon with text, voice, and OCR capabilities. Powered by AI with community-driven phrase submissions and history tracking.

## 🎯 Project Overview

Ano-Kamo? is a full-stack application designed to break language barriers within the Philippines by providing seamless translation across three major Filipino languages:
- **Tagalog** (Filipino)
- **Cebuano** (Bisaya)
- **Hiligaynon** (Ilonggo)

### Key Features

- **Text Translation**: Single or dual output translations
- **Voice Conversation**: Real-time speech-to-text, translate, text-to-speech
- **OCR Translation**: Extract text from images and translate
- **Community Submissions**: Users can propose and vote on translations
- **History & Favorites**: Track past translations and save favorites
- **Tone/Sentiment Awareness**: Auto-detect or manually select translation tone

## 📁 Repository Structure

```
ano-kamo/
├── README.md (this file)
├── backend/              # FastAPI server
│   ├── README.md
│   ├── pyproject.toml
│   ├── .env.example
│   ├── app/
│   │   ├── main.py
│   │   ├── api/v1/
│   │   │   ├── router.py
│   │   │   └── endpoints/
│   │   │       ├── translate.py
│   │   │       ├── conversation.py
│   │   │       ├── community.py
│   │   │       ├── history.py
│   │   │       └── health.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── logging.py
│   │   ├── services/
│   │   │   ├── translation_service.py
│   │   │   └── speech_service.py
│   │   ├── db/
│   │   │   ├── session.py
│   │   │   ├── base.py
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   └── crud.py
│   │   └── migrations/ (Alembic)
│   └── tests/
│
└── frontend/             # React Native Expo app
    ├── README.md
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    ├── app/ (Expo Router)
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── translate.tsx
    │   ├── conversation.tsx
    │   ├── ocr.tsx
    │   ├── history.tsx
    │   ├── community.tsx
    │   └── settings.tsx
    ├── src/
    │   ├── components/
    │   │   ├── LanguagePicker.tsx
    │   │   ├── TranslationPanel.tsx
    │   │   ├── ToneSelector.tsx
    │   │   └── MessageBubble.tsx
    │   ├── lib/
    │   │   ├── api.ts
    │   │   └── types.ts
    │   └── state/
    │       └── useHistoryStore.ts
    ├── assets/
    └── .gitignore
```

## 🛠 Tech Stack

### Backend
- **Python 3.11+**
- **FastAPI** - Modern web framework
- **Uvicorn** - ASGI server
- **Pydantic v2** - Data validation
- **SQLAlchemy 2.0** - ORM
- **Alembic** - Database migrations
- **SQLite** - Development database (easily swap to PostgreSQL)
- **httpx** - Async HTTP client for external APIs
- **pytest** - Testing framework

### Frontend
- **React Native with Expo** - Cross-platform mobile
- **TypeScript** - Type safety
- **Expo Router** - Navigation
- **axios** - HTTP client
- **react-native-paper** - UI components
- **iOS/Android support**

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- Git

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e .

# Set up environment variables
cp .env.example .env
# Edit .env if needed (defaults should work for local dev)

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --port 8000
```

Server runs at `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Update EXPO_PUBLIC_API_BASE_URL if backend is not at localhost:8000

# Start Expo
npx expo start
```

Then:
- Press `i` for iOS simulator (macOS only)
- Press `a` for Android emulator
- Scan QR code with Expo Go app on physical device

## 📚 API Endpoints

### Health
- `GET /api/v1/health` - Server status

### Translation
- `POST /api/v1/translate` - Translate text to one language
  ```json
  {
    "text": "Hello",
    "source_lang": "en",
    "target_lang": "tl",
    "tone": "neutral"
  }
  ```

- `POST /api/v1/translate/multi` - Translate to multiple languages
  ```json
  {
    "text": "Hello",
    "source_lang": "en",
    "target_langs": ["tl", "ceb"],
    "tone": "neutral"
  }
  ```

### Conversation
- `POST /api/v1/conversation/turn` - Single conversation turn with tone detection
  ```json
  {
    "text": "How are you?",
    "source_lang": "en",
    "target_lang": "tl",
    "tone": null
  }
  ```

### History & Favorites
- `GET /api/v1/history` - Get translation history
- `POST /api/v1/history` - Save translation to history
- `POST /api/v1/favorites` - Add to favorites
- `GET /api/v1/favorites` - Get favorited translations
- `DELETE /api/v1/favorites/{id}` - Remove from favorites

### Community
- `GET /api/v1/community/submissions` - Get submissions
- `POST /api/v1/community/submissions` - Submit a translation

See [backend/README.md](backend/README.md) for detailed documentation and curl examples.

## 🔐 Environment Configuration

Both backend and frontend use `.env.example` files (never commit real `.env` files):

**Backend (.env.example):**
```
DATABASE_URL=sqlite:///./app.db
DEBUG=False
LOG_LEVEL=INFO
CORS_ORIGINS=["http://localhost:3000","http://localhost:19000"]
# API keys for external services (e.g., Gemini, Whisper)
GEMINI_API_KEY=your-key-here
WHISPER_API_KEY=your-key-here
```

**Frontend (.env.example):**
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest tests/ -v
```

### Frontend Testing

Coming soon with Jest/React Native Testing Library setup.

## 📖 Documentation

- [Backend README](backend/README.md) - Setup, architecture, API details, curl examples
- [Frontend README](frontend/README.md) - Setup, screens, components, build instructions

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

Built to celebrate and preserve Filipino languages through technology.

---

**Questions or Issues?** Open an issue or check the individual README files in backend/ and frontend/.
