import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  Mic,
  ChevronDown,
  Repeat,
  Volume2,
  Copy,
  BookOpen,
  MessageSquareMore,
} from 'lucide-react-native';
import { translateSingle } from '../src/lib/api';
import {
  gradientColors,
  darkGradientColors,
  vibrantGradients,
  glassCard,
  darkGlassCard,
  glassPill,
  SUPPORTED_LANGUAGES,
  LANGUAGE_PLACEHOLDERS,
} from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import WordCardModal from '../src/components/WordCardModal';
import SelectableWord from '../src/components/SelectableWord';
import { useTextToSpeech } from '../src/hooks/useTextToSpeech';
export default function HomeScreen() {
  const { isDarkMode } = useTheme();
  const activeGradient = isDarkMode ? darkGradientColors : gradientColors;
  const tts = useTextToSpeech();

  // Mode toggle
  const [mode, setMode] = useState<'2way' | '3way'>('2way');

  // Language state
  const [sourceLang, setSourceLang] = useState('tl');
  const [targetLang1, setTargetLang1] = useState('ceb');
  const [targetLang2, setTargetLang2] = useState('hil');

  // Text state
  const [sourceText, setSourceText] = useState('');
  const [translated1, setTranslated1] = useState('');
  const [translated2, setTranslated2] = useState('');
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  // Picker modals
  const [pickerTarget, setPickerTarget] = useState<'source' | 'target1' | 'target2' | null>(null);

  // Dictionary
  const [dictVisible, setDictVisible] = useState(false);
  const [dictWord, setDictWord] = useState('');

  const translate = useCallback(async (text: string, from: string, to: string): Promise<string> => {
    try {
      const res = await translateSingle(text, from, to);
      return res.output_text || '';
    } catch {
      return 'Translation unavailable';
    }
  }, []);

  useEffect(() => {
    if (!sourceText.trim() || sourceText.length < 2) {
      setTranslated1('');
      setTranslated2('');
      return;
    }
    const timer = setTimeout(async () => {
      setLoading1(true);
      const r1 = await translate(sourceText, sourceLang, targetLang1);
      setTranslated1(r1);
      setLoading1(false);

      if (mode === '3way') {
        setLoading2(true);
        const r2 = await translate(sourceText, sourceLang, targetLang2);
        setTranslated2(r2);
        setLoading2(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [sourceText, sourceLang, targetLang1, targetLang2, mode]);

  const swapLanguages = () => {
    const oldSource = sourceLang;
    setSourceLang(targetLang1);
    setTargetLang1(oldSource);
    setSourceText(translated1);
    setTranslated1('');
    setTranslated2('');
  };

  const swapTarget2 = () => {
    const oldSource = sourceLang;
    setSourceLang(targetLang2);
    setTargetLang2(oldSource);
    setSourceText(translated2);
    setTranslated1('');
    setTranslated2('');
  };

  const handlePickerSelect = (code: string) => {
    if (pickerTarget === 'source') setSourceLang(code);
    else if (pickerTarget === 'target1') setTargetLang1(code);
    else if (pickerTarget === 'target2') setTargetLang2(code);
  };

  const copyText = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'Text copied to clipboard');
  };

  const openDictionary = (text: string) => {
    const firstWord = text.trim().split(/\s+/)[0];
    if (firstWord) {
      setDictWord(firstWord);
      setDictVisible(true);
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <LinearGradient colors={[...activeGradient]} style={styles.bg} />

      {/* Background Blobs for Glass Refraction */}
      <View style={styles.blobContainer}>
        <LinearGradient colors={['#FF9A9E', '#FAD0C4']} style={[styles.blob, { top: -100, left: -50, width: 300, height: 300 }]} />
        <LinearGradient colors={['#A18CD1', '#FBC2EB']} style={[styles.blob, { bottom: 100, right: -100, width: 400, height: 400 }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Mode Toggle */}
          <View style={[styles.toggleRow, isDarkMode && styles.toggleRowDark]}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === '2way' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
              onPress={() => setMode('2way')}
            >
              <Text style={[styles.toggleText, mode === '2way' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                2 Way Translate
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === '3way' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
              onPress={() => setMode('3way')}
            >
              <Text style={[styles.toggleText, mode === '3way' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                3 Way Translate
              </Text>
            </TouchableOpacity>
          </View>

          {/* Main Glass Card */}
          <BlurView
            intensity={isDarkMode ? 30 : 50}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.card, isDarkMode && styles.cardDark]}
          >
            {/* Source Panel */}
            <View style={styles.panel}>
              <TouchableOpacity
                style={styles.langRow}
                onPress={() => setPickerTarget('source')}
              >
                <Text style={[styles.langLabel, isDarkMode && styles.textWhite]}>
                  {SUPPORTED_LANGUAGES[sourceLang]}
                </Text>
                <ChevronDown size={18} color="#3B82F6" />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, isDarkMode && { color: '#F8FAFC' }]}
                placeholder={LANGUAGE_PLACEHOLDERS[sourceLang] || "Insert the text"}
                placeholderTextColor="#94A3B8"
                multiline
                value={sourceText}
                onChangeText={setSourceText}
              />
              <View style={styles.panelFooter}>
                <TouchableOpacity style={styles.iconCircle}>
                  <Mic size={18} color="#3B82F6" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider + Swap */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <TouchableOpacity style={styles.swapBtn} onPress={swapLanguages}>
                <Repeat size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Target 1 Panel */}
            <View style={styles.panel}>
              <TouchableOpacity
                style={styles.langRow}
                onPress={() => setPickerTarget('target1')}
              >
                <Text style={[styles.langLabel, isDarkMode && styles.textWhite]}>
                  {SUPPORTED_LANGUAGES[targetLang1]}
                </Text>
                <ChevronDown size={18} color="#3B82F6" />
              </TouchableOpacity>
              <View style={styles.outputArea}>
                {loading1 ? (
                  <ActivityIndicator color="#3B82F6" style={{ alignSelf: 'flex-start' }} />
                ) : (
                  <SelectableWord
                    text={translated1 || LANGUAGE_PLACEHOLDERS[targetLang1]}
                    sourceLang={targetLang1}
                    targetLang={sourceLang}
                    style={[styles.outputText, isDarkMode && styles.outputTextDark, !translated1 && { color: '#94A3B8' }]}
                    isDarkMode={isDarkMode}
                  />
                )}
              </View>
              {translated1 ? (
                <View style={styles.panelFooter}>
                  <TouchableOpacity style={styles.iconCircle} onPress={() => tts.speak(translated1, targetLang1)}>
                    <Volume2 size={18} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconCircle} onPress={() => copyText(translated1)}>
                    <Copy size={18} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconCircle} onPress={() => openDictionary(translated1)}>
                    <BookOpen size={18} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconCircle}>
                    <MessageSquareMore size={18} color="#3B82F6" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {/* Target 2 Panel (3-way only) */}
            {mode === '3way' && (
              <>
                {/* Swap for Target 2 (Moved above label, with line) */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <TouchableOpacity style={styles.swapBtn} onPress={swapTarget2}>
                    <Repeat size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>

                <View style={styles.panel}>
                  <TouchableOpacity
                    style={styles.langRow}
                    onPress={() => setPickerTarget('target2')}
                  >
                    <Text style={[styles.langLabel, isDarkMode && styles.textWhite]}>
                      {SUPPORTED_LANGUAGES[targetLang2]}
                    </Text>
                    <ChevronDown size={18} color="#3B82F6" />
                  </TouchableOpacity>

                  <View style={styles.outputArea}>
                    {loading2 ? (
                      <ActivityIndicator color="#3B82F6" style={{ alignSelf: 'flex-start' }} />
                    ) : (
                      <SelectableWord
                        text={translated2 || LANGUAGE_PLACEHOLDERS[targetLang2]}
                        sourceLang={targetLang2}
                        targetLang={sourceLang}
                        style={[styles.outputText, isDarkMode && styles.outputTextDark, !translated2 && { color: '#94A3B8' }]}
                        isDarkMode={isDarkMode}
                      />
                    )}
                  </View>
                  {translated2 ? (
                    <View style={styles.panelFooter}>
                      <TouchableOpacity style={styles.iconCircle} onPress={() => tts.speak(translated2, targetLang2)}>
                        <Volume2 size={18} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconCircle} onPress={() => copyText(translated2)}>
                        <Copy size={18} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconCircle} onPress={() => openDictionary(translated2)}>
                        <BookOpen size={18} color="#3B82F6" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </>
            )}
          </BlurView>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNav />

      {/* Language Picker */}
      <LanguagePicker
        visible={pickerTarget !== null}
        onDismiss={() => setPickerTarget(null)}
        onSelect={handlePickerSelect}
        selected={
          pickerTarget === 'source' ? sourceLang
            : pickerTarget === 'target1' ? targetLang1
              : targetLang2
        }
      />

      {/* Word Card Modal */}
      <WordCardModal
        visible={dictVisible}
        onDismiss={() => setDictVisible(false)}
        word={dictWord}
        sourceLang={sourceLang}
        targetLang={targetLang1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  containerDark: { backgroundColor: '#0F172A' },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  keyboardView: { flex: 1, marginTop: 90 },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },

  /* Toggle */
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(241,245,249,0.7)',
    borderRadius: 30,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  toggleRowDark: {
    backgroundColor: 'rgba(30,41,59,0.7)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 26,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleActiveDark: {
    backgroundColor: '#334155',
  },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#1E293B' },
  toggleTextActiveDark: { color: '#F8FAFC' },

  /* Card */
  card: {
    ...glassCard,
    padding: 22,
    overflow: 'hidden', // Required for BlurView on Android
  },
  cardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.45)', // Override for BlurView transparency
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  /* Panel */
  panel: { width: '100%' },
  langRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  langLabel: { fontSize: 17, fontWeight: '600', color: '#1E293B', marginRight: 6 },
  textWhite: { color: '#F8FAFC' },
  input: {
    fontSize: 17,
    color: '#1E293B',
    minHeight: 80,
    maxHeight: 150,
    textAlignVertical: 'top',
    padding: 0,
    outlineStyle: 'none',
  },
  outputArea: { minHeight: 60 },
  outputText: { fontSize: 17, color: '#1E293B', lineHeight: 24 },
  outputTextDark: { color: '#F8FAFC' },
  panelFooter: { flexDirection: 'row', marginTop: 14, gap: 10 },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    height: 42,
    position: 'relative',
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.05)' },
  swapBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: '50%',
    marginLeft: -21,
    zIndex: 1,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },

  /* Background Blobs */
  blobContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: -1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 500,
    opacity: 0.5,
  },
});
