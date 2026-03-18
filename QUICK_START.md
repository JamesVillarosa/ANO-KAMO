# ANO-KAMO? - Quick Start Guide

## 🚀 Test the New Changes RIGHT NOW

### 30-Second Test

**What Was Fixed:**
- ✅ Fast Refresh (hot reload)
- ✅ Input validation (no more JSON errors)
- ✅ Smart translation (no unnecessary re-translations)

---

## 📱 Platform 1: Web (Windows Localhost)

### Start the App:
```bash
# Terminal 1: Backend
cd backend
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend
expo start
```

Press `w` for web, or scan QR code with iPhone 13 Expo Go app.

---

## ✅ Quick Test Sequence (5 Minutes)

### Test 1: Fast Refresh (30 seconds)
1. Open app in browser or iPhone
2. Open `/frontend/app/index.tsx` in VS Code
3. Find line 398: `"2 Way Translate"`
4. Change to: `"2 Way Translation"`
5. Save (Ctrl+S)
6. **PASS**: App updates in 1-2 seconds without full reload
7. **FAIL**: App doesn't update, or takes 10+ seconds

---

### Test 2: Empty Input Validation (1 minute)
1. In the app, clear all text
2. Type only spaces: `    ` (spacebar 4 times)
3. **PASS**: Output shows "Please enter a valid word or phrase to translate."
4. **FAIL**: Shows JSON like `{"t":"","tone":"neutral"}` or nothing

5. Clear input, type: `'''` (three apostrophes)
6. **PASS**: Same validation message
7. **FAIL**: Shows JSON or error

---

### Test 3: Translation Error Handling (1 minute)
1. Stop the backend server (Ctrl+C in backend terminal)
2. In app, type: "Kumusta"
3. Wait 1 second
4. **PASS**: Shows "Translation service is temporarily unavailable. Please try again."
5. **FAIL**: Shows raw error like "Translation Error: Exception"

6. Restart backend: `uvicorn app.main:app --reload`
7. Type new text
8. **PASS**: Translation works normally

---

### Test 4: Smart 2-Way → 3-Way Translation (2 minutes)
1. Select **"2 Way Translate"** mode
2. Source: Tagalog, Target1: Cebuano
3. Type: "Kumusta ka"
4. Wait for translation (e.g., "Kumusta ka pod")
5. **Write down or screenshot the exact Cebuano translation**

6. Switch to **"3 Way Translate"** mode
7. **PASS**: Panel 1 (Cebuano) shows EXACT SAME TEXT from step 5
8. **PASS**: Panel 1 does NOT show loading spinner
9. **PASS**: Panel 2 (Hiligaynon) shows loading, then new translation
10. **FAIL**: Panel 1 re-translates (shows loading spinner)

---

### Test 5: Independent Panel Translation (1 minute)
1. In 3-way mode, type: "Magandang umaga"
2. Wait for both panels to translate
3. Click Target Language 1 dropdown
4. Change from Cebuano to English
5. **PASS**: Only panel 1 re-translates (shows "Good morning")
6. **PASS**: Panel 2 stays the same (still shows Hiligaynon)
7. **FAIL**: Both panels re-translate

8. Click Target Language 2 dropdown
9. Change from Hiligaynon to English
10. **PASS**: Only panel 2 re-translates
11. **PASS**: Panel 1 stays the same
12. **FAIL**: Both panels re-translate

---

## 📊 Results

**If all 5 tests PASS**: ✅ Implementation is successful! All critical fixes are working.

**If any test FAILS**: Check the detailed debugging guide in `/TESTING_GUIDE.md`

---

## 🐛 Common Issues

### Fast Refresh Not Working:
```bash
# Clear Metro cache
expo start --clear

# Check .env file has:
EXPO_USE_FAST_REFRESH=true

# Restart expo and reload app
```

### Backend Not Running:
```bash
# Check if backend is running:
curl http://localhost:8000/docs

# Should see FastAPI Swagger UI
# If not, restart backend
```

### iPhone Not Connecting:
```bash
# Make sure iPhone and PC on same WiFi
# Shake iPhone → Reload
# Or scan QR code again
```

---

## 📁 What to Do Next

### If All Tests Pass:
1. Read `/COMPLETED_CHANGES.md` for full changelog
2. Read `/IMPLEMENTATION_STATUS.md` to implement remaining features
3. Follow guides for PROMPT 6 (device filtering) next

### If Tests Fail:
1. Check console logs (browser DevTools or Expo terminal)
2. Verify all files were saved correctly
3. See debugging section in `/TESTING_GUIDE.md`
4. Check that you're on the latest code version

---

## 🎯 Expected Behavior Summary

| Test | Expected Output | Wrong Output |
|------|----------------|--------------|
| Fast Refresh | App updates in 1-2 sec | Takes 10+ sec or full reload |
| Empty Input | "Please enter a valid word..." | `{"t":"","tone":"neutral"}` |
| API Error | "Translation service is temporarily unavailable..." | "Translation Error: Exception" |
| 2→3 Switch | Panel 1 unchanged, panel 2 loads | Panel 1 re-translates |
| Lang Change | Only changed panel re-translates | All panels re-translate |

---

## ⏱️ Total Time: 5 Minutes

**Run all 5 tests** → See if they pass → Read next steps based on results.

**Start testing now!** Open the app and follow Test 1 above. 🚀
