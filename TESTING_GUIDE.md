# ANO-KAMO? Testing Guide

## 🧪 Quick Test Checklist

### ✅ IMPLEMENTED FEATURES - Test These First

#### Test 1: Fast Refresh (PROMPT 1)
**Platforms**: Web (localhost), iPhone 13 (Expo Go)

**Steps**:
1. Run `cd frontend && expo start`
2. Open on both web and iPhone
3. Edit `/frontend/app/index.tsx` - change any text (e.g., line 398: "2 Way Translate" → "2 Way Translation")
4. Save file
5. **Expected**: App updates instantly without full restart
6. **Pass Criteria**: See text change within 1-2 seconds

---

#### Test 2: Empty Input Validation (PROMPT 5)
**Platforms**: Web, iPhone 13

**Steps**:
1. Open home screen (index)
2. Type only spaces: `    ` (spacebar 4 times)
3. **Expected**: Output panel shows "Please enter a valid word or phrase to translate."
4. **NOT Expected**: Should NOT show JSON like `{"t":"","tone":"neutral"}`
5. Clear input
6. Type only punctuation: `'''` or `...`
7. **Expected**: Same validation message
8. **Pass Criteria**: Validation message appears, no API call made (check network tab)

---

#### Test 3: Translation Error Handling (PROMPT 5)
**Platforms**: Web, iPhone 13

**Steps**:
1. Stop the backend server (Ctrl+C in backend terminal)
2. In app, type valid text: "Kumusta"
3. Wait 800ms for debounce
4. **Expected**: Output shows "Translation service is temporarily unavailable. Please try again."
5. **NOT Expected**: Should NOT show "Translation Error: Exception" or raw error
6. Restart backend
7. Type new text
8. **Expected**: Translation works normally
9. **Pass Criteria**: User-friendly error message, no raw exceptions

---

#### Test 4: Smart 2-Way to 3-Way Translation (PROMPT 7)
**Platforms**: Web, iPhone 13

**Steps**:
1. Select mode: **2 Way Translate**
2. Source: Tagalog, Target1: Cebuano
3. Type: "Kumusta ka"
4. **Expected**: Cebuano translation appears (e.g., "Kumusta ka pod")
5. Note the exact translated text in panel 1
6. Switch mode to: **3 Way Translate**
7. **Expected**:
   - Panel 1 (Cebuano) shows EXACT SAME TEXT (no loading, no re-translation)
   - Panel 2 (Hiligaynon) shows loading, then new translation
8. **Pass Criteria**: Panel 1 does NOT re-translate when switching to 3-way

---

#### Test 5: Independent Panel Translation (PROMPT 7)
**Platforms**: Web, iPhone 13

**Steps**:
1. Mode: **3 Way Translate**
2. Type: "Magandang umaga"
3. Wait for both panels to translate
4. Click Target Language 1 dropdown, change from Cebuano to English
5. **Expected**: Only panel 1 re-translates (shows "Good morning")
6. **Expected**: Panel 2 does NOT re-translate (still shows Hiligaynon)
7. Now click Target Language 2 dropdown, change from Hiligaynon to English
8. **Expected**: Only panel 2 re-translates
9. **Expected**: Panel 1 does NOT re-translate
10. **Pass Criteria**: Panels translate independently

---

### ⚠️ PARTIALLY WORKING FEATURES - Test But Expect Issues

#### Test 6: History Delete (PROMPT 6 - Partial)
**Platforms**: Web, iPhone 13

**Steps**:
1. Make several translations to populate history
2. Go to History screen
3. Tap delete (trash icon) on any entry
4. **Expected**: Confirmation dialog appears
5. Tap "Delete"
6. **Expected**: Entry is removed from list
7. **Known Issue**: Not yet filtered by device_id (all devices see all history)
8. **Pass Criteria**: Delete works, but device filtering missing

---

#### Test 7: History Clear All (PROMPT 6 - Partial)
**Platforms**: Web, iPhone 13

**Steps**:
1. Go to History screen with multiple entries
2. Tap "Clear All" button (should be in header)
3. **Expected**: Confirmation dialog: "Clear History? This will permanently delete ALL entries..."
4. Tap "Cancel" → Nothing happens
5. Tap "Clear All" again, then "Clear All" in dialog
6. **Expected**: All entries removed
7. **Known Issue**: Not yet filtered by device_id
8. **Pass Criteria**: Clear all works, but device filtering missing

---

### ❌ NOT YET WORKING - Don't Test Yet

#### Test 8: 3-Dot Menu Position (PROMPT 3 - Not Implemented)
**Status**: Known bug - menu appears in wrong position
**Fix**: See `/IMPLEMENTATION_STATUS.md` PROMPT 3

---

#### Test 9: Conversation Tone Adjustment (PROMPT 4 - Not Implemented)
**Status**: Tone button still at bottom input, not on message bubbles
**Fix**: See `/IMPLEMENTATION_STATUS.md` PROMPT 4

---

#### Test 10: 12 Filipino Cultural Tones (PROMPT 8 - Not Implemented)
**Status**: Tone list still shows old tones (neutral, formal, casual, etc.)
**Expected**: Should show 12 tones including "Respectful (Po/Opo)", "Street (Kalye)", "Taglish", etc.
**Fix**: See `/IMPLEMENTATION_STATUS.md` PROMPT 8

---

#### Test 11: Apple Glass Morphism UI (PROMPT 9 - Not Implemented)
**Status**: UI still uses old design
**Expected**: Apple-style glass morphism with blur effects, new colors, typography
**Fix**: See `/IMPLEMENTATION_STATUS.md` PROMPT 9

---

#### Test 12: ML Kit OCR (PROMPT 2 - Requires EAS Build)
**Status**: Current OCR uses backend Tesseract
**Expected**: On-device ML Kit with 800ms throttle
**Fix**: Requires custom dev client (not available in Expo Go)

---

## 📊 Test Results Template

Copy and fill this out after testing:

```
# ANO-KAMO Test Results - [Date] - [Platform: Web/iPhone 13]

## ✅ Passing Tests
- [ ] Test 1: Fast Refresh
- [ ] Test 2: Empty Input Validation
- [ ] Test 3: Translation Error Handling
- [ ] Test 4: Smart 2-Way to 3-Way Translation
- [ ] Test 5: Independent Panel Translation

## ⚠️ Partial Tests (Known Issues)
- [ ] Test 6: History Delete (works, but no device filtering)
- [ ] Test 7: History Clear All (works, but no device filtering)

## ❌ Not Tested (Not Implemented)
- Test 8: 3-Dot Menu Position
- Test 9: Conversation Tone Adjustment
- Test 10: 12 Filipino Cultural Tones
- Test 11: Apple Glass Morphism UI
- Test 12: ML Kit OCR

## 🐛 Issues Found
[List any bugs or unexpected behavior]

## 💬 Notes
[Any additional observations]
```

---

## 🔧 Debugging Tips

### If Fast Refresh Doesn't Work:
1. Check `.env` has `EXPO_USE_FAST_REFRESH=true`
2. Run `expo start --clear`
3. Check Metro bundler terminal for errors
4. Restart Expo Go app on iPhone

### If Validation Doesn't Show:
1. Check browser console / Expo console for errors
2. Verify `/frontend/src/utils/validation.ts` exists
3. Check import statement in `index.tsx` line 54

### If Translations Still Re-translate Unnecessarily:
1. Clear all text, start fresh
2. Check console for ref values (should track previous state)
3. Make sure you're on the latest code version

### If Backend Errors Occur:
1. Check backend is running: `http://localhost:8000/docs`
2. Check `.env` has correct `GEMINI_API_KEY`
3. Check backend logs for Python exceptions
4. Verify ngrok tunnel is active if testing on iPhone

---

## 📱 Platform-Specific Notes

### Web (localhost:8081):
- Fast Refresh via WebSocket
- Console in browser DevTools
- Network tab shows API calls
- Easy to debug

### iPhone 13 (Expo Go):
- Shake device to open dev menu
- Reload: Shake → "Reload"
- View logs: Shake → "Show Dev Menu" → "Debug Remote JS"
- Logs appear in terminal running `expo start`

---

## ✅ Success Criteria Summary

**3 prompts are COMPLETE** if:
- Fast Refresh works on both platforms
- Empty input shows validation message (not JSON)
- Translation errors show friendly message (not raw exception)
- 2way→3way switch doesn't re-translate panel 1
- Changing target1 only re-translates panel 1
- Changing target2 only re-translates panel 2

**Test these 6 scenarios** - if all pass, implementation is successful! 🎉

---

**Quick Start**: Run tests 1-5 first. These are the core fixes that should all pass. Tests 6-7 partially work but need device filtering. Tests 8-12 are not implemented yet.
