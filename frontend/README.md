# Ano-Kamo Frontend

React Native + Expo app for AI-powered Filipino language translation.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- iOS Simulator (macOS) or Android Emulator
- Expo Go app on physical device (optional)

### Installation & Running

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Update EXPO_PUBLIC_API_BASE_URL if needed
# (default: http://localhost:8000)

# Start Expo development server
npx expo start

# Press 'i' for iOS simulator
# Press 'a' for Android emulator
# Scan QR code with Expo Go app on physical device
```

## 📁 Project Structure

```
frontend/
├── app/                         # Expo Router screens
│   ├── _layout.tsx             # Root layout
│   ├── index.tsx               # Home/landing
│   ├── translate.tsx           # Text translation screen
│   ├── conversation.tsx        # Voice conversation screen
│   ├── ocr.tsx                 # OCR translation screen
│   ├── history.tsx             # Translation history
│   ├── community.tsx           # Community submissions
│   └── settings.tsx            # Settings
├── src/
│   ├── components/
│   │   ├── LanguagePicker.tsx     # Language selector
│   │   ├── TranslationPanel.tsx   # Translation output panel
│   │   ├── ToneSelector.tsx       # Tone selector
│   │   └── MessageBubble.tsx      # Chat bubble component
│   ├── lib/
│   │   ├── api.ts               # API client
│   │   └── types.ts             # TypeScript types
│   └── state/
│       └── useHistoryStore.ts   # History state management
├── assets/                       # Images, fonts, etc.
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🎨 Screens

### Translate
Single and dual-output text translation with language selection and tone control.

### Conversation
Chat-style interface for real-time conversation translation with automatic tone detection.

### OCR
Extract text from images and translate (simulated OCR for now - integrate with ML Kit later).

### History & Favorites
View past translations, mark as favorites, and manage history.

### Community
Submit phrase translations and view community submissions.

### Settings
Configure API URL and view app information.

## 🔧 Configuration

Edit `.env` to configure backend URL:

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

For Android emulator (if backend runs on host machine):
```
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
```

## 📦 Dependencies

- `expo` - React Native framework
- `expo-router` - File-based routing
- `react-native-paper` - Material Design UI
- `axios` - HTTP client
- `zustand` - State management (alternative to Redux)
- `TypeScript` - Type safety

## 🧪 Development

### Hot Reload

Expo provides fast refresh - changes auto-reload in the app.

### Debug Mode

```bash
# With verbose logging
npx expo start --verbose
```

### Clear Cache

```bash
# Reset and clear cache
npx expo start --clear
```

## 🚢 Building for Production

### iOS Build

```bash
npx eas build --platform ios
```

### Android Build

```bash
npx eas build --platform android
```

(Requires EAS account setup)

## 📡 API Integration

The frontend communicates with the backend via `lib/api.ts`.

Example:
```typescript
import { api } from '@/lib/api';

// Translate text
const result = await api.translate({
  text: "Hello",
  source_lang: "en",
  target_lang: "tl",
  tone: "friendly"
});
```

## 🔮 Future Enhancements

- [ ] ML Kit integration for real OCR
- [ ] Real Whisper API for STT/TTS
- [ ] User authentication
- [ ] Offline translation (on-device ML models)
- [ ] Dark mode
- [ ] Multi-language UI
- [ ] Accessibility improvements
- [ ] Performance optimizations

## 🐛 Troubleshooting

### Port Already in Use

```bash
npx expo start --port 19001
```

### Cache Issues

```bash
npx expo start --clear
```

### Connection Issues

Make sure backend is running and EXPO_PUBLIC_API_BASE_URL is correct in `.env`.

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [Expo Router](https://expo.github.io/router/introduction/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
