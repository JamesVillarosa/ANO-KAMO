# Ano-Kamo Frontend

React Native application built with Expo for the Ano-Kamo translation platform. Supports text translation, real-time conversation with speech recognition, camera-based OCR translation, history tracking, and community phrase submissions.

---

## Prerequisites

- Node.js 18 or higher
- npm
- Expo Go app on a physical device, or an iOS Simulator / Android Emulator
- A running instance of the Ano-Kamo backend

---

## Setup

```bash
cd frontend

# Install dependencies
npm install

# Create your environment file
# Copy the example or create .env manually
echo "EXPO_PUBLIC_API_BASE_URL=http://localhost:8000" > .env

# Start the Expo development server
npx expo start
```

Then:
- Press `i` to open the iOS Simulator (macOS only)
- Press `a` to open the Android Emulator
- Scan the QR code with Expo Go on a physical device

To run on a physical device over a tunnel (useful when the backend is not on the same LAN):

```bash
npx expo start --tunnel
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Base URL of the backend API (e.g., `http://192.168.1.10:8000`) |
| `REACT_NATIVE_PACKAGER_HOSTNAME` | Override Metro's advertised host (needed when running from WSL on Windows) |

For Android emulator pointing to a backend on the host machine, use `http://10.0.2.2:8000` as the base URL.

---

## Project Structure

```
frontend/
├── app/                            # Screens, routed by Expo Router
│   ├── _layout.tsx                 # Root navigator and shared header setup
│   ├── splash.tsx                  # Animated splash screen
│   ├── index.tsx                   # Text translation screen (2-way and 3-way)
│   ├── translate.tsx               # Camera and OCR translation screen
│   ├── conversation.tsx            # Real-time conversation screen
│   ├── history.tsx                 # Translation and conversation history
│   ├── community.tsx               # Community phrase submissions
│   └── settings.tsx                # App settings (theme, API URL, about)
├── src/
│   ├── components/
│   │   ├── BottomNav.tsx           # Persistent bottom navigation bar
│   │   ├── LanguagePicker.tsx      # Language selection modal
│   │   ├── ToneSelector.tsx        # Tone chip selector
│   │   ├── WordCardModal.tsx       # Dictionary word detail modal
│   │   ├── SentenceBreakdownSheet.tsx  # Sentence grammar breakdown
│   │   ├── TappableWord.tsx        # Tappable word that opens the dictionary
│   │   ├── DictionaryModal.tsx     # Dictionary lookup modal
│   │   ├── AnchoredPopoverMenu.tsx # Contextual action menu anchored to a button
│   │   ├── GlassNotification.tsx   # Transient notification overlay
│   │   ├── FluidAura.tsx           # Animated background aura effect
│   │   ├── GlassBlur.tsx           # Cross-platform blur container
│   │   ├── GlassCard.tsx           # Frosted glass card surface
│   │   ├── CoachmarkManager.tsx    # First-use tooltip walkthrough
│   │   ├── MessageBubble.tsx       # Chat bubble for conversation screen
│   │   ├── SelectableWord.tsx      # Word that can be selected for lookup
│   │   └── TranslationPanel.tsx    # Translation output panel
│   ├── context/
│   │   ├── ConversationContext.tsx # Global conversation and speaker state
│   │   └── ThemeContext.tsx        # Light/dark theme toggle
│   ├── hooks/
│   │   ├── useSpeechRecognition.ts # Microphone and Groq Whisper STT integration
│   │   ├── useTextToSpeech.ts      # Azure/gTTS text-to-speech playback
│   │   └── useLanguageSelection.ts # Language slot management with smart swap
│   ├── lib/
│   │   ├── api.ts                  # Typed API client (axios-based)
│   │   └── types.ts                # Shared TypeScript interfaces
│   ├── utils/
│   │   ├── device.ts               # Persistent device ID generation
│   │   └── validation.ts           # Input validation helpers
│   └── theme.ts                    # Colors, typography, and glass style constants
├── assets/                         # App icon, splash image, and adaptive icon
├── app.json                        # Expo app configuration
├── eas.json                        # EAS Build configuration
├── babel.config.js
├── metro.config.js
├── tsconfig.json
└── package.json
```

---

## Screens

### Text Translation (index.tsx)

The main screen. Supports 2-way mode (one source, one target) and 3-way mode (one source, two targets). Input can be typed or spoken via microphone. Each translation panel includes copy, speak, feedback, dictionary lookup, and a sentence breakdown option.

### Camera / OCR (translate.tsx)

Full-screen camera viewfinder with torch and front/rear camera controls. After capture or gallery pick, the image is processed by the backend (Gemini Vision) and translated text is overlaid on the photo with bounding boxes. Language can be changed to re-translate without re-capturing.

### Conversation (conversation.tsx)

Chat-style interface for live multi-speaker translation. Supports two-way and three-way modes. Each speaker taps a microphone, speaks in their language, and the message appears as a bubble with translations visible to the other speaker. Tone can be set per-session or adjusted per message.

### History (history.tsx)

Lists past translation records grouped by date, with separate tabs for text/OCR translations and conversation sessions. Supports starring, deleting, and replaying TTS.

### Community (community.tsx)

Allows users to submit Filipino slang and regional phrases with proposed translations. Submissions are scanned by Gemini and enter an automated Evolution Loop that promotes widely-used terms to the verified glossary used during translation.

### Settings (settings.tsx)

Configure the backend URL, toggle light/dark theme, and view app version information.

---

## Dependencies

| Package | Purpose |
|---|---|
| `expo ~54` | Core Expo SDK |
| `expo-router ~6` | File-based screen navigation |
| `react-native ^0.81` | Cross-platform UI runtime |
| `react-native-paper ^5` | Material Design UI components |
| `expo-camera ~17` | Camera access for OCR capture |
| `expo-image-picker ~17` | Gallery image selection |
| `expo-av ~16` | Audio recording for speech input |
| `expo-blur ~15` | Native blur effects (iOS) |
| `expo-linear-gradient ~15` | Gradient backgrounds |
| `expo-haptics ~15` | Tactile feedback |
| `expo-clipboard ~8` | Clipboard copy |
| `axios ^1.6` | HTTP client for API calls |
| `lucide-react-native ^0.563` | Icon set |
| `react-native-safe-area-context ~5.6` | Safe area insets |
| `@react-native-async-storage/async-storage ^2` | Persistent local storage |

---

## Building for Production

Builds are managed through EAS (Expo Application Services).

```bash
# Build for Android
npx eas build --platform android

# Build for iOS
npx eas build --platform ios

# Build for both
npx eas build --platform all
```

An EAS account is required. Configure project ID in `eas.json` before building.

---

## Development Notes

**Cache issues after dependency changes:**
```bash
npx expo start --clear
```

**Verbose logging:**
```bash
npx expo start --verbose
```

**Running on a physical device when the backend is on a different machine:**
Set `EXPO_PUBLIC_API_BASE_URL` to the machine's local IP address (e.g., `http://192.168.1.10:8000`) and ensure both devices are on the same network. Alternatively, use `--tunnel` mode with a localtunnel or ngrok URL.
