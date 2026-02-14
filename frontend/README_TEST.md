# Test Screen for Frontend-Backend Connectivity

This test screen allows you to verify that the Expo Go frontend can successfully communicate with the FastAPI backend.

## Features

1. **Health Check Test**: Simple GET request to `/api/v1/health` endpoint
2. **Translation Test**: POST request to `/api/v1/translate` endpoint with customizable input
3. **Real-time Response Display**: Shows success/error messages with detailed response data
4. **Configuration Display**: Shows current API base URL and endpoint

## How to Use

### 1. Start the Backend
```bash
cd backend
source .venv/bin/activate  # Activate virtual environment
pip install -e .           # Install dependencies

# Fix for alembic configuration if needed:
# The alembic.ini file has been updated to use sqlite:///./app.db
# If you still get errors, check that backend/alembic.ini has correct configuration

alembic upgrade head       # Setup database

# Start server accessible from network (important for physical device testing)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start the Frontend
```bash
cd frontend
npm install                # Install dependencies

# If you get dependency errors, try:
# npm install --legacy-peer-deps

npx expo start            # Start Expo dev server
```

### 3. Connect with Expo Go
1. Install **Expo Go** app on your mobile device
2. Scan the QR code shown in the terminal
3. Wait for the app to load

### 4. Test Connection
- Tap **"Health Check"** then **"Test Connection"** for basic connectivity test
- Tap **"Translate"**, enter text, then **"Test Connection"** for translation test

## Expected Results

### Successful Connection
- ✅ "Connection Successful!" message
- ✅ Status code 200
- ✅ Response data displayed in JSON format

### Failed Connection
- ❌ "Connection Failed" message
- ❌ Error details displayed
- ⚠️ Troubleshooting tips provided

## Troubleshooting

### Issue: "Network Error"
**Solution:** Update `.env` file with correct IP address:
- For physical device on same network: `http://YOUR_COMPUTER_IP:8000`
- For Android emulator: `http://10.0.2.2:8000`
- For iOS simulator: `http://localhost:8000`

### Issue: Backend not responding
**Solution:**
1. Verify backend is running: `curl http://localhost:8000/api/v1/health`
2. Check if port 8000 is blocked by firewall
3. Ensure both devices are on same network

### Issue: Expo Go can't load app
**Solution:**
1. Clear cache: `npx expo start --clear`
2. Restart Expo: Stop with `Ctrl+C` and restart
3. Check network connectivity

## Test Scripts

Use the provided test scripts to verify setup:

```bash
# Test backend setup
cd backend
./test_backend.sh

# Test frontend setup  
cd ../frontend
./test_frontend.sh
```

## API Endpoints Tested

1. **GET /api/v1/health**
   - Returns server status and timestamp
   - No authentication required

2. **POST /api/v1/translate**
   - Translates text between languages
   - Requires JSON body: `{"text": "Hello", "source_lang": "en", "target_lang": "tl", "tone": "neutral"}`

## Next Steps After Successful Test

1. Explore other screens in the app (translate, conversation, OCR, etc.)
2. Modify the test screen to add more functionality
3. Implement error handling and loading states
4. Add authentication if needed
5. Deploy backend to cloud service

## Support

If you encounter issues:
1. Check terminal logs for both backend and frontend
2. Verify all prerequisites are installed
3. Consult the main `TEST_GUIDE.md` for detailed instructions
4. Check project README files for additional guidance

---

**Note:** This test screen is intentionally simple to demonstrate basic frontend-backend connectivity. The actual Ano-Kamo app has more comprehensive features for Filipino language translation.
