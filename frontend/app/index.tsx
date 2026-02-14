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
  theme,
  glassCard,
  gradientColors,
  SUPPORTED_LANGUAGES,
} from '../src/theme';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import DictionaryModal from '../src/components/DictionaryModal';

export default function HomeScreen() {
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
    <View style={styles.container}>
      <LinearGradient colors={[...gradientColors]} style={styles.bg} />

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
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === '2way' && styles.toggleActive]}
              onPress={() => setMode('2way')}
            >
              <Text style={[styles.toggleText, mode === '2way' && styles.toggleTextActive]}>
                2 Way Translate
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === '3way' && styles.toggleActive]}
              onPress={() => setMode('3way')}
            >
              <Text style={[styles.toggleText, mode === '3way' && styles.toggleTextActive]}>
                3 Way Translate
              </Text>
            </TouchableOpacity>
          </View>

          {/* Main Glass Card */}
          <View style={styles.card}>
            {/* Source Panel */}
            <View style={styles.panel}>
              <TouchableOpacity
                style={styles.langRow}
                onPress={() => setPickerTarget('source')}
              >
                <Text style={styles.langLabel}>
                  {SUPPORTED_LANGUAGES[sourceLang]}
                </Text>
                <ChevronDown size={18} color="#3B82F6" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Ilagay ang teksto"
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
                <Text style={styles.langLabel}>
                  {SUPPORTED_LANGUAGES[targetLang1]}
                </Text>
                <ChevronDown size={18} color="#3B82F6" />
              </TouchableOpacity>
              <View style={styles.outputArea}>
                {loading1 ? (
                  <ActivityIndicator color="#3B82F6" style={{ alignSelf: 'flex-start' }} />
                ) : (
                  <Text style={[styles.outputText, !translated1 && { color: '#94A3B8' }]}>
                    {translated1 || 'Isulod ang teksto'}
                  </Text>
                )}
              </View>
              {translated1 ? (
                <View style={styles.panelFooter}>
                  <TouchableOpacity style={styles.iconCircle}>
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
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                </View>
                <View style={styles.panel}>
                  <TouchableOpacity
                    style={styles.langRow}
                    onPress={() => setPickerTarget('target2')}
                  >
                    <Text style={styles.langLabel}>
                      {SUPPORTED_LANGUAGES[targetLang2]}
                    </Text>
                    <ChevronDown size={18} color="#3B82F6" />
                  </TouchableOpacity>
                  <View style={styles.outputArea}>
                    {loading2 ? (
                      <ActivityIndicator color="#3B82F6" style={{ alignSelf: 'flex-start' }} />
                    ) : (
                      <Text style={[styles.outputText, !translated2 && { color: '#94A3B8' }]}>
                        {translated2 || 'Isulod ang teksto'}
                      </Text>
                    )}
                  </View>
                  {translated2 ? (
                    <View style={styles.panelFooter}>
                      <TouchableOpacity style={styles.iconCircle}>
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
          </View>
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

      {/* Dictionary Modal */}
      <DictionaryModal
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
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  keyboardView: { flex: 1, marginTop: 90 },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },

  /* Toggle */
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(241,245,249,0.9)',
    borderRadius: 30,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 26,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#1E293B' },

  /* Card */
  card: {
    ...glassCard,
    padding: 22,
  },

  /* Panel */
  panel: { width: '100%' },
  langRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  langLabel: { fontSize: 17, fontWeight: '600', color: '#1E293B', marginRight: 6 },
  input: {
    fontSize: 17,
    color: '#1E293B',
    minHeight: 70,
    maxHeight: 140,
    textAlignVertical: 'top',
    padding: 0,
  },
  outputArea: { minHeight: 60 },
  outputText: { fontSize: 17, color: '#1E293B' },
  panelFooter: { flexDirection: 'row', marginTop: 10, gap: 8 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    height: 36,
    position: 'relative',
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: '50%',
    marginLeft: -18,
    zIndex: 1,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
