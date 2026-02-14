# Testing Frontend-Backend Connectivity on Expo Go

This guide provides step-by-step instructions to test the connection between the Expo Go frontend and FastAPI backend.

## Prerequisites

1. **Python 3.11+** installed
2. **Node.js 18+** and npm installed
3. **Expo Go app** installed on your mobile device (available on iOS App Store or Google Play Store)
4. **Git** installed (optional, for cloning)

## Step 1: Set Up the Backend

### 1.1 Navigate to backend directory
```bash
cd backend
```

### 1.2 Create and activate virtual environment
```bash
# Create virtual environment
python3 -m venv .venv

# Activate it
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
# .venv\Scripts\activate
```

### 1.3 Install dependencies
```bash
pip install -e .
```

### 1.4 Set up environment variables
```bash
cp .env.example .env
# Edit .env if needed (defaults work for local development)
```

### 1.5 Run database migrations
```bash
# Make sure you're in the backend directory
cd backend

# Run the migration
alembic upgrade head
```

**Note:** If you get an error about "driver" URL, the alembic configuration has been fixed. Make sure you have the latest code.

### 1.6 Start the backend server (accessible from network)
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output:**
```
🚀 Starting Ano-Kamo Backend...
✅ Database initialized
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**Important:** Use `--host 0.0.0.0` to make the server accessible from other devices on your network.

### 1.7 Verify backend is running
Open your browser and visit:
- **API Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/api/v1/health

You should see a JSON response:
```json
{"status":"healthy","timestamp":"2025-01-15T10:30:00Z"}
```

## Step 2: Set Up the Frontend

### 2.1 Navigate to frontend directory
```bash
cd ../frontend
```

### 2.2 Install dependencies
```bash
npm install
```

**If you get dependency errors**, try:
```bash
npm install --legacy-peer-deps
```

### 2.3 Configure environment
The `.env` file is already created with:
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

**Important:** For Android emulator or physical device, you may need to change this to:
- **Android Emulator:** `http://10.0.2.2:8000`
- **Physical device on same network:** `http://YOUR_COMPUTER_IP:8000`

### 2.4 Start Expo development server
```bash
npx expo start
```

**Expected output:**
```
Starting project at /path/to/frontend
Expo DevTools is running at http://localhost:8082
Starting Metro Bundler
› Metro waiting on exp://192.168.1.100:19000
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

## Step 3: Test on Expo Go

### 3.1 Connect with Expo Go app

1. **Open Expo Go app** on your mobile device
2. **Scan the QR code** shown in the terminal or browser
3. **Wait for the app to load** - you'll see the "Frontend-Backend Connection Test" screen

### 3.2 Test the connection

#### Option A: Health Check (Simplest)
1. Tap the **"Health Check"** button
2. Tap **"Test Connection"**
3. You should see: **"✅ Connection Successful!"** with status 200

#### Option B: Translation Test
1. Tap the **"Translate"** button
2. Enter text in the input field (e.g., "Hello")
3. Tap **"Test Connection"**
4. You should see a successful response with translation data

### 3.3 Troubleshooting connection issues

#### If you see "Connection Failed":
1. **Check backend is running:** Ensure `uvicorn` is still running in the backend terminal
2. **Check IP address:** 
   - For physical device: Use your computer's IP address instead of localhost
   - Update `.env` file: `EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_IP:8000`
3. **Check firewall:** Ensure port 8000 is not blocked
4. **Check network:** Device and computer must be on same network

#### To find your computer's IP address:
- **macOS/Linux:** `ifconfig | grep "inet " | grep -v 127.0.0.1`
- **Windows:** `ipconfig | findstr IPv4`

## Step 4: Test Different Scenarios

### 4.1 Test with different endpoints
The test screen allows you to switch between:
- **Health Check** (`GET /api/v1/health`) - Simple connectivity test
- **Translate** (`POST /api/v1/translate`) - Test actual translation functionality

### 4.2 Test with different input
Try entering different text for translation:
- "Hello, how are you?"
- "Good morning"
- "Thank you"

### 4.3 Monitor backend logs
Watch the backend terminal for incoming requests:
```
INFO:     127.0.0.1:12345 - "GET /api/v1/health HTTP/1.1" 200 OK
INFO:     127.0.0.1:12345 - "POST /api/v1/translate HTTP/1.1" 200 OK
```

## Common Issues and Solutions

### Issue 1: "Network Error" on physical device
**Solution:** Use computer's IP address instead of localhost

### Issue 2: Backend not accessible from mobile
**Solution:** 
1. Ensure both devices are on same Wi-Fi network
2. Check if your computer firewall allows port 8000
3. Try disabling firewall temporarily for testing

### Issue 3: Expo Go can't load the app
**Solution:**
1. Ensure Metro bundler is running (`npx expo start`)
2. Try clearing cache: `npx expo start --clear`
3. Restart Expo: Stop with `Ctrl+C` and restart

### Issue 4: Database errors
**Solution:**
```bash
cd backend
# Recreate database
rm app.db
alembic upgrade head
```

## Advanced Testing

### Test with Android Emulator
If using Android emulator:
1. Update `.env` to: `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000`
2. Start emulator before running `npx expo start`
3. Press `a` in Expo terminal to open in emulator

### Test with iOS Simulator (macOS only)
1. Press `i` in Expo terminal to open in iOS simulator

### Test API endpoints directly with curl
```bash
# Health check
curl http://localhost:8000/api/v1/health

# Translation
curl -X POST http://localhost:8000/api/v1/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello", "source_lang": "en", "target_lang": "tl", "tone": "neutral"}'
```

## Success Indicators

1. ✅ Frontend loads in Expo Go without errors
2. ✅ "Health Check" returns "Connection Successful!"
3. ✅ Backend logs show incoming requests
4. ✅ Translation endpoint returns valid JSON response
5. ✅ Response data is displayed correctly in the app

## Next Steps After Successful Test

1. **Explore the full app:** The test screen is just one screen - explore other features
2. **Modify the code:** Try making changes to see hot reload in action
3. **Add new features:** Extend the test screen with more functionality
4. **Deploy:** Consider deploying backend to cloud services like Railway, Render, or AWS

## Support

If you encounter issues:
1. Check the terminal logs for both backend and frontend
2. Verify all prerequisites are installed correctly
3. Ensure ports 8000 (backend) and 19000 (Expo) are not blocked
4. Consult the project README files for additional guidance

---

**Congratulations!** You've successfully tested frontend-backend connectivity on Expo Go. The basic infrastructure is working, and you can now build upon this foundation.
