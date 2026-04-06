import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  Animated,
  Modal,
  BackHandler,
} from 'react-native';
import { Text, ActivityIndicator, Portal, Provider as PaperProvider } from 'react-native-paper';
import { GlassBlur as BlurView } from '../src/components/GlassBlur';
import FluidAura from '../src/components/FluidAura';
import {
  Mic,
  MicOff,
  ChevronDown,
  Repeat,
  Volume2,
  Copy,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  X,
  Send,
  MessageSquare,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { translateSingle, translateMulti, submitFeedback, deleteHistory } from '../src/lib/api';
import { getDeviceId } from '../src/utils/device';
import {
  glassCard,
  darkGlassCard,
  SUPPORTED_LANGUAGES,
  LANGUAGE_PLACEHOLDERS,
} from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import GlassNotification from '../src/components/GlassNotification';
import WordCardModal from '../src/components/WordCardModal';
import SentenceBreakdownSheet from '../src/components/SentenceBreakdownSheet';
import AnchoredPopoverMenu from '../src/components/AnchoredPopoverMenu';

import { useSpeechRecognition } from '../src/hooks/useSpeechRecognition';
import { useTextToSpeech } from '../src/hooks/useTextToSpeech';
import { useLanguageSelection } from '../src/hooks/useLanguageSelection';
import { isValidTranslationInput, getValidationErrorMessage } from '../src/utils/validation';

export default function HomeScreen() {
  const { isDarkMode } = useTheme();
  const tts = useTextToSpeech();

  // Mode toggle
  const [mode, setMode] = useState<'2way' | '3way'>('2way');

  // Language state via shared hook (smart swap built-in)
  const { langs: langSelection, setLang: setLangSlot, swap: swapLangSlots } = useLanguageSelection(
    mode === '3way' ? 3 : 2,
    ['tl', 'ceb', 'hil'],
  );
  const sourceLang = langSelection[0];
  const targetLang1 = langSelection[1];
  const targetLang2 = langSelection[2];

  // Text state
  const [sourceText, setSourceText] = useState('');

  // Custom confirmation modal for "Suggest Better Translation?" prompt
  const [suggestConfirmVisible, setSuggestConfirmVisible] = useState(false);
  const [pendingSuggestText, setPendingSuggestText] = useState('');
  const [pendingSuggestTarget, setPendingSuggestTarget] = useState<1 | 2>(1);
  const [translated1, setTranslated1] = useState('');
  const [translated2, setTranslated2] = useState('');
  const [translationId1, setTranslationId1] = useState('');
  const [translationId2, setTranslationId2] = useState('');
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  // Device ID for history tracking
  const deviceIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    getDeviceId().then(id => { deviceIdRef.current = id; });
  }, []);

  // Track prior values so we only re-translate when something meaningful changed.
  const prevSourceTextRef = useRef('');
  const prevSourceLangRef = useRef(sourceLang);
  const prevTargetLang1Ref = useRef(targetLang1);
  const prevTargetLang2Ref = useRef(targetLang2);
  // Guard against concurrent translateMulti calls (prevents double-save in Strict Mode).
  const isTranslatingRef = useRef(false);
  // Incremented on every effect run; in-flight callbacks compare against this
  // to detect whether their result has been superseded by a newer input.
  const translationGenRef = useRef(0);

  // Feedback state
  const [feedbackGiven1, setFeedbackGiven1] = useState<'like' | 'dislike' | null>(null);
  const [feedbackGiven2, setFeedbackGiven2] = useState<'like' | 'dislike' | null>(null);
  const [showMenu1, setShowMenu1] = useState(false);
  const [showMenu2, setShowMenu2] = useState(false);

  const menuButtonRef1 = useRef<View>(null);
  const menuButtonRef2 = useRef<View>(null);
  const [menuPosition1, setMenuPosition1] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [menuPosition2, setMenuPosition2] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [refineModal, setRefineModal] = useState<{ visible: boolean; translationId: string; originalText: string; target: 1 | 2 }>({
    visible: false, translationId: '', originalText: '', target: 1,
  });
  const [refineText, setRefineText] = useState('');
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [activeFeedbackTarget, setActiveFeedbackTarget] = useState<{ id: string; target: 1 | 2 } | null>(null);

  // Glow animations
  const glowAnim1 = useRef(new Animated.Value(0)).current;
  const glowAnim2 = useRef(new Animated.Value(0)).current;

  // Picker modals
  const [pickerTarget, setPickerTarget] = useState<'source' | 'target1' | 'target2' | null>(null);

  // Dictionary
  const [dictVisible, setDictVisible] = useState(false);
  const [dictWord, setDictWord] = useState('');
  const [dictSourceLang, setDictSourceLang] = useState('');
  const [dictTargetLang, setDictTargetLang] = useState('');
  const [breakdownVisible, setBreakdownVisible] = useState(false);

  const [notifVisible, setNotifVisible] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');
  const showNotif = (msg: string) => { setNotifMessage(msg); setNotifVisible(true); };

  // Input ref for focus after clearing
  const inputRef = useRef<any>(null);
  // Guard to skip auto-clear on initial mount
  const isFirstSourceLangRender = useRef(true);
  // Debounce ref so we can cancel pending translation on source lang change
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Android hardware back button: dismiss modals/pickers first
  useEffect(() => {
    const onBack = () => {
      if (feedbackModalVisible) {
        setFeedbackModalVisible(false);
        return true;
      }
      if (refineModal.visible) {
        setRefineModal({ ...refineModal, visible: false });
        return true;
      }
      if (pickerTarget !== null) {
        setPickerTarget(null);
        return true;
      }
      if (dictVisible) {
        setDictVisible(false);
        return true;
      }
      if (breakdownVisible) {
        setBreakdownVisible(false);
        return true;
      }
      if (showMenu1) {
        setShowMenu1(false);
        return true;
      }
      if (showMenu2) {
        setShowMenu2(false);
        return true;
      }
      return false; // home screen — let default behavior handle
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [feedbackModalVisible, refineModal.visible, pickerTarget, dictVisible, breakdownVisible, showMenu1, showMenu2]);

  // Clear all state when the source language changes so stale translations are not displayed.
  useEffect(() => {
    if (isFirstSourceLangRender.current) {
      isFirstSourceLangRender.current = false;
      return;
    }
    setSourceText('');
    setTranslated1('');
    setTranslated2('');
    setTranslationId1('');
    setTranslationId2('');
    setFeedbackGiven1(null);
    setFeedbackGiven2(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [sourceLang]);

  // Speech Recognition
  const speech = useSpeechRecognition(sourceLang);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for mic when listening
  useEffect(() => {
    if (speech.isListening || speech.isProcessing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [speech.isListening, speech.isProcessing]);

  // Auto-populate input with live transcript
  useEffect(() => {
    const liveText = (speech.transcript + ' ' + speech.interimTranscript).trim();
    if (liveText && liveText !== 'Listening...' && liveText !== 'Processing...' && liveText !== 'Transcribing...' && liveText !== 'No voice detected. Please speak.') {
      setSourceText(liveText);
    }
  }, [speech.transcript, speech.interimTranscript]);

  // When transcription completes, set the text (auto-translate will kick in via debounce)
  useEffect(() => {
    if (!speech.isListening && !speech.isProcessing && speech.transcript.trim()) {
      const finalText = speech.transcript.trim();
      if (finalText !== 'No voice detected. Please speak.') {
        setSourceText(finalText);
      }
    }
  }, [speech.isProcessing, speech.transcript]);

  // Re-translate only when the source text or a relevant language selection actually changes.
  useEffect(() => {
    // Each run gets a unique generation number. Any in-flight callback from a
    // previous run will see its generation no longer matches and will bail out,
    // preventing stale results from overwriting a newer translation.
    const myGen = ++translationGenRef.current;

    // Stop any visible loading spinner immediately when the input changes —
    // the in-flight request's finally{} block will be ignored via the gen check.
    setLoading1(false);
    setLoading2(false);

    if (!sourceText.trim() || sourceText.length < 2) {
      setTranslated1('');
      setTranslated2('');
      setTranslationId1('');
      setTranslationId2('');
      setFeedbackGiven1(null);
      setFeedbackGiven2(null);
      prevSourceTextRef.current = '';
      return;
    }

    // Validate input before translating
    if (!isValidTranslationInput(sourceText)) {
      const errorMsg = getValidationErrorMessage(sourceText);
      setTranslated1(errorMsg);
      if (mode === '3way') setTranslated2(errorMsg);
      setTranslationId1('');
      setTranslationId2('');
      setFeedbackGiven1(null);
      setFeedbackGiven2(null);
      return;
    }

    // Determine what changed
    const sourceTextChanged = prevSourceTextRef.current !== sourceText;
    const sourceLangChanged = prevSourceLangRef.current !== sourceLang;
    const targetLang1Changed = prevTargetLang1Ref.current !== targetLang1;
    const targetLang2Changed = prevTargetLang2Ref.current !== targetLang2;

    // Update refs
    prevSourceTextRef.current = sourceText;
    prevSourceLangRef.current = sourceLang;
    prevTargetLang1Ref.current = targetLang1;
    prevTargetLang2Ref.current = targetLang2;

    const timer = setTimeout(async () => {
      // If the user changed the input while we were waiting, abort.
      if (translationGenRef.current !== myGen) return;

      if (mode === '3way') {
        // 3-Way: one bundled call → one Translation + 2 outputs in history
        const needsAny = sourceTextChanged || sourceLangChanged || targetLang1Changed || targetLang2Changed || !translated2;
        if (needsAny) {
          // Guard: prevent duplicate saves if this timer fires more than once (Strict Mode)
          if (isTranslatingRef.current) return;
          isTranslatingRef.current = true;
          setLoading1(true);
          setLoading2(true);
          setFeedbackGiven1(null);
          setFeedbackGiven2(null);
          try {
            const res = await translateMulti(sourceText, sourceLang, [targetLang1, targetLang2], undefined, deviceIdRef.current);
            if (translationGenRef.current !== myGen) {
                // User edited before result could be shown — remove stale history entry
                if (res.translation_id && deviceIdRef.current) {
                    deleteHistory(res.translation_id, deviceIdRef.current).catch(() => {});
                }
                return;
            }
            setTranslated1(res.output_texts?.[0] || '');
            setTranslated2(res.output_texts?.[1] || '');
            setTranslationId1(res.translation_id || '');
            setTranslationId2(res.translation_id || '');
          } catch (error: any) {
            if (translationGenRef.current !== myGen) return;
            const errorMsg = error?.message?.includes('503') || error?.message?.includes('unavailable')
              ? 'Translation service is temporarily unavailable. Please try again.'
              : 'Translation unavailable. Please try again.';
            setTranslated1(errorMsg);
            setTranslated2(errorMsg);
          } finally {
            isTranslatingRef.current = false;
            if (translationGenRef.current === myGen) {
              setLoading1(false);
              setLoading2(false);
            }
          }
        }
      } else {
        // 2-Way: single call
        if (sourceTextChanged || sourceLangChanged || targetLang1Changed) {
          setLoading1(true);
          setFeedbackGiven1(null);
          try {
            const res1 = await translateSingle(sourceText, sourceLang, targetLang1, undefined, deviceIdRef.current);
            if (translationGenRef.current !== myGen) {
                // User edited before result could be shown — remove stale history entry
                if (res1.translation_id && deviceIdRef.current) {
                    deleteHistory(res1.translation_id, deviceIdRef.current).catch(() => {});
                }
                return;
            }
            setTranslated1(res1.output_text || '');
            setTranslationId1(res1.translation_id || '');
          } catch (error: any) {
            if (translationGenRef.current !== myGen) return;
            const errorMsg = error?.message?.includes('503') || error?.message?.includes('unavailable')
              ? 'Translation service is temporarily unavailable. Please try again.'
              : 'Translation unavailable. Please try again.';
            setTranslated1(errorMsg);
          } finally {
            if (translationGenRef.current === myGen) {
              setLoading1(false);
            }
          }
        }
      }
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceText, sourceLang, targetLang1, targetLang2, mode]);

  const swapLanguages = () => {
    swapLangSlots(0, 1);
    if (translated1) {
      setSourceText(translated1);
      setTranslated1('');
      setTranslated2('');
    }
  };

  const swapTarget2 = () => {
    swapLangSlots(0, 2);
    if (translated2) {
      setSourceText(translated2);
      setTranslated1('');
      setTranslated2('');
    }
  };

  const handlePickerSelect = (code: string) => {
    const slot = pickerTarget === 'source' ? 0 : pickerTarget === 'target1' ? 1 : 2;
    setLangSlot(slot, code);
    setPickerTarget(null);
  };

  const copyText = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showNotif('Copied to clipboard');
    } catch { }
  };

  const openDictionary = (text: string, src: string, tgt: string) => {
    if (!text.trim()) {
      showNotif("Generate a translation first to use the dictionary.");
      return;
    }

    setDictSourceLang(src);
    setDictTargetLang(tgt);

    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 1) {
      const cleanWord = words[0].replace(/[.,!?;:"""''()[\]{}]/g, '').trim();
      setDictWord(cleanWord);
      setDictVisible(true);
    } else {
      setDictWord(text);
      setBreakdownVisible(true);
    }
  };

  // ─── Feedback handlers ───
  const triggerGlow = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: 600, useNativeDriver: false }),
    ]).start();
  };

  const handleFeedback = async (
    translationId: string,
    type: 'like' | 'dislike',
    target: 1 | 2,
  ) => {
    const anim = target === 1 ? glowAnim1 : glowAnim2;
    const setFeedback = target === 1 ? setFeedbackGiven1 : setFeedbackGiven2;
    const currentFeedback = target === 1 ? feedbackGiven1 : feedbackGiven2;

    if (currentFeedback === type) {
      setFeedback(null);
      return;
    }

    setFeedback(type);
    triggerGlow(anim);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { }

    try {
      await submitFeedback(translationId, type);
    } catch { }
  };

  const handleSubmitRefinement = async () => {
    if (!refineText.trim()) return;
    try {
      await submitFeedback(refineModal.translationId, 'dislike', refineText.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showNotif('Suggestion submitted! Thank you.');
    } catch { }
    setRefineModal({ visible: false, translationId: '', originalText: '', target: 1 });
    setRefineText('');
  };

  const renderActionRow = (
    text: string,
    translationId: string,
    tgtLang: string,
    target: 1 | 2,
    feedbackState: 'like' | 'dislike' | null,
    showMenu: boolean,
    setShowMenu: (v: boolean) => void,
    glowAnim: Animated.Value,
  ) => {
    const glowColor = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['transparent', feedbackState === 'dislike' ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'],
    });

    return (
      <Animated.View style={[styles.panelFooter, { backgroundColor: glowColor, borderRadius: 12, paddingHorizontal: 4, marginHorizontal: -4 }]}>
        <TouchableOpacity style={styles.iconCircle} onPress={() => tts.speak(text, tgtLang)}>
          <Volume2 size={18} color="#3B82F6" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconCircle} onPress={() => openDictionary(text, sourceLang, tgtLang)}>
          <BookOpen size={18} color="#3B82F6" />
        </TouchableOpacity>

        {/* Feedback Trigger */}
        <TouchableOpacity
          style={[styles.iconCircle, feedbackState && { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: '#3B82F6' }]}
          onPress={() => {
            setActiveFeedbackTarget({ id: translationId, target });
            setFeedbackModalVisible(true);
          }}
        >
          <MessageSquare size={18} color="#3B82F6" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <View ref={target === 1 ? menuButtonRef1 : menuButtonRef2} collapsable={false}>
          <TouchableOpacity
            style={styles.iconCircle}
            onPress={() => {
              const ref = target === 1 ? menuButtonRef1 : menuButtonRef2;
              ref.current?.measureInWindow((x, y, width, height) => {
                if (target === 1) {
                  setMenuPosition1({ x, y, width, height });
                  setShowMenu1(true);
                } else {
                  setMenuPosition2({ x, y, width, height });
                  setShowMenu2(true);
                }
              });
            }}
          >
            <MoreHorizontal size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <PaperProvider>
      <Portal.Host>
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
          <FluidAura isDarkMode={isDarkMode} />

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
                    2-Way
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, mode === '3way' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
                  onPress={() => setMode('3way')}
                >
                  <Text style={[styles.toggleText, mode === '3way' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                    3-Way
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
                    placeholder={
                      speech.isListening ? "Listening..."
                        : speech.isProcessing ? "Transcribing..."
                          : LANGUAGE_PLACEHOLDERS[sourceLang] || "Insert the text"
                    }
                    placeholderTextColor={
                      (speech.isListening || speech.isProcessing)
                        ? "#EF4444"
                        : "#94A3B8"
                    }
                    multiline
                    value={sourceText}
                    onChangeText={setSourceText}
                  />
                  <View style={styles.panelFooter}>
                    <TouchableOpacity
                      style={[styles.iconCircle, (speech.isListening || speech.isProcessing) && { backgroundColor: '#EF4444' }]}
                      onPress={() => {
                        if (speech.isListening) speech.stopListening();
                        else if (!speech.isProcessing) speech.startListening();
                      }}
                      disabled={speech.isProcessing}
                    >
                      <Animated.View style={{ transform: [{ scale: (speech.isListening || speech.isProcessing) ? pulseAnim : 1 }] }}>
                        {speech.isListening ? (
                          <MicOff size={18} color="#FFF" />
                        ) : speech.isProcessing ? (
                          <ActivityIndicator size={16} color="#FFF" />
                        ) : (
                          <Mic size={18} color="#3B82F6" />
                        )}
                      </Animated.View>
                    </TouchableOpacity>

                    {sourceText.length > 0 && (
                      <TouchableOpacity style={styles.iconCircle} onPress={() => tts.speak(sourceText, sourceLang)}>
                        <Volume2 size={18} color="#3B82F6" />
                      </TouchableOpacity>
                    )}

                    <View style={{ flex: 1 }} />
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
                      <Text style={[styles.outputText, isDarkMode && styles.outputTextDark, !translated1 && { color: '#94A3B8' }]}>
                        {translated1 || LANGUAGE_PLACEHOLDERS[targetLang1]}
                      </Text>
                    )}
                  </View>
                  {translated1 && !loading1 ? (
                    renderActionRow(
                      translated1, translationId1, targetLang1, 1,
                      feedbackGiven1, showMenu1, setShowMenu1, glowAnim1
                    )
                  ) : (
                    <View style={styles.panelFooter} />
                  )}
                </View>

                {/* Target 2 Panel (3-way only) */}
                {mode === '3way' && (
                  <>
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
                          <Text style={[styles.outputText, isDarkMode && styles.outputTextDark, !translated2 && { color: '#94A3B8' }]}>
                            {translated2 || LANGUAGE_PLACEHOLDERS[targetLang2]}
                          </Text>
                        )}
                      </View>
                      {translated2 && !loading2 ? (
                        renderActionRow(
                          translated2, translationId2, targetLang2, 2,
                          feedbackGiven2, showMenu2, setShowMenu2, glowAnim2
                        )
                      ) : (
                        <View style={styles.panelFooter} />
                      )}
                    </View>
                  </>
                )}
              </BlurView>

              <TouchableOpacity style={styles.clearBtn} onPress={() => { setSourceText(''); setTranslated1(''); setTranslated2(''); }}>
                <Text style={styles.clearBtnText}>Clear All</Text>
              </TouchableOpacity>
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
            sourceLang={dictSourceLang}
            targetLang={dictTargetLang}
          />

          {/* Sentence Breakdown Sheet */}
          <SentenceBreakdownSheet
            visible={breakdownVisible}
            onClose={() => setBreakdownVisible(false)}
            text={dictWord}
            sourceLang={dictSourceLang}
            targetLang={dictTargetLang}
            onWordPress={(word) => {
              setBreakdownVisible(false);
              setDictWord(word);
              setTimeout(() => setDictVisible(true), 300);
            }}
          />

          {/* Suggest Better Translation Modal */}
          <Modal
            visible={refineModal.visible}
            transparent
            animationType="slide"
            onRequestClose={() => setRefineModal({ ...refineModal, visible: false })}
          >
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ width: '100%' }}
              >
                <BlurView
                  intensity={60}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={[styles.refineModal, isDarkMode && styles.refineModalDark]}
                >
                  <View style={styles.modalHandle} />
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    <View style={styles.refineHeader}>
                      <Text style={[styles.refineTitle, isDarkMode && { color: '#F8FAFC' }]}>
                        Suggest Better Translation
                      </Text>
                      <TouchableOpacity onPress={() => setRefineModal({ ...refineModal, visible: false })}>
                        <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.refineLabel, isDarkMode && { color: '#94A3B8' }]}>Current translation:</Text>
                    <Text style={[styles.refineOriginal, isDarkMode && { color: '#CBD5E1' }]}>
                      "{refineModal.originalText}"
                    </Text>

                    <Text style={[styles.refineLabel, { marginTop: 16 }, isDarkMode && { color: '#94A3B8' }]}>
                      Your suggested translation:
                    </Text>
                    <TextInput
                      style={[styles.refineInput, isDarkMode && styles.refineInputDark]}
                      placeholder="Type a better translation..."
                      placeholderTextColor="#94A3B8"
                      value={refineText}
                      onChangeText={setRefineText}
                      multiline
                    />

                    <TouchableOpacity
                      style={[styles.refineSubmit, !refineText.trim() && { opacity: 0.5 }]}
                      onPress={handleSubmitRefinement}
                      disabled={!refineText.trim()}
                    >
                      <Send size={18} color="#FFF" />
                      <Text style={styles.refineSubmitText}>Submit Suggestion</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </BlurView>
              </KeyboardAvoidingView>
            </View>
          </Modal>

          {/* Feedback Modal */}
          <Modal
            visible={feedbackModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setFeedbackModalVisible(false)}
          >
            <View style={styles.modalOverlayCentered}>
              <BlurView
                intensity={30}
                tint={isDarkMode ? 'dark' : 'light'}
                style={[styles.feedbackModalCentered, isDarkMode && styles.feedbackModalDark]}
              >
                <View style={styles.modalHandle} />
                <View style={styles.refineHeader}>
                  <Text style={[styles.refineTitle, isDarkMode && { color: '#FFF' }]}>Rate this translation</Text>
                  <TouchableOpacity onPress={() => setFeedbackModalVisible(false)}>
                    <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.feedbackBody, isDarkMode && { color: '#94A3B8' }]}>
                  Your feedback is important to us!
                </Text>

                {(() => {
                  const currentFeedback = activeFeedbackTarget?.target === 1 ? feedbackGiven1 : feedbackGiven2;
                  return (
                    <View style={styles.feedbackActionRow}>
                      <TouchableOpacity
                        style={[
                          styles.largeFeedbackBtn,
                          { backgroundColor: currentFeedback === 'like' ? 'rgba(34,197,94,0.28)' : 'rgba(34,197,94,0.12)' },
                          currentFeedback === 'like' && { borderWidth: 1.5, borderColor: '#22C55E' },
                        ]}
                        onPress={() => {
                          if (activeFeedbackTarget) {
                            handleFeedback(activeFeedbackTarget.id, 'like', activeFeedbackTarget.target);
                          }
                          setFeedbackModalVisible(false);
                        }}
                      >
                        <ThumbsUp size={24} color="#22C55E" />
                        <Text style={[styles.largeFeedbackText, { color: '#22C55E' }]}>Helpful</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.largeFeedbackBtn,
                          { backgroundColor: currentFeedback === 'dislike' ? 'rgba(239,68,68,0.28)' : 'rgba(239,68,68,0.12)' },
                          currentFeedback === 'dislike' && { borderWidth: 1.5, borderColor: '#EF4444' },
                        ]}
                        onPress={() => {
                          const currentFeedback = activeFeedbackTarget?.target === 1 ? feedbackGiven1 : feedbackGiven2;
                          const isRemoving = currentFeedback === 'dislike';

                          if (activeFeedbackTarget) {
                            handleFeedback(activeFeedbackTarget.id, 'dislike', activeFeedbackTarget.target);
                          }
                          setFeedbackModalVisible(false);

                          // Only offer to suggest if we are SETTING a dislike (not removing it)
                          if (!isRemoving) {
                            const outputText = activeFeedbackTarget?.target === 1 ? translated1 : translated2;
                            if (outputText) {
                              setTimeout(() => {
                                setPendingSuggestText(outputText);
                                setPendingSuggestTarget(activeFeedbackTarget?.target ?? 1);
                                setSuggestConfirmVisible(true);
                              }, 300);
                            }
                          }
                        }}
                      >
                        <ThumbsDown size={24} color="#EF4444" />
                        <Text style={[styles.largeFeedbackText, { color: '#EF4444' }]}>Not helpful</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
              </BlurView>
            </View>
          </Modal>

        {/* Custom "Suggest Better Translation?" confirmation modal */}
          <Modal
            visible={suggestConfirmVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setSuggestConfirmVisible(false)}
          >
            <View style={styles.modalOverlayCentered}>
              <BlurView
                intensity={30}
                tint={isDarkMode ? 'dark' : 'light'}
                style={[styles.suggestConfirmModal, isDarkMode && styles.suggestConfirmModalDark]}
              >
                <Text style={[styles.suggestConfirmTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  Suggest Better Translation?
                </Text>
                <Text style={[styles.suggestConfirmBody, isDarkMode && { color: '#94A3B8' }]}>
                  Would you like to suggest a better translation?
                </Text>
                <View style={styles.suggestConfirmBtns}>
                  <TouchableOpacity
                    style={[styles.suggestConfirmBtn, styles.suggestConfirmBtnNo, isDarkMode && styles.suggestConfirmBtnNoDark]}
                    onPress={() => setSuggestConfirmVisible(false)}
                  >
                    <Text style={[styles.suggestConfirmBtnNoText, isDarkMode && { color: '#94A3B8' }]}>No, thanks</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.suggestConfirmBtn, styles.suggestConfirmBtnYes]}
                    onPress={() => {
                      setSuggestConfirmVisible(false);
                      setRefineText(pendingSuggestText);
                      setRefineModal({
                        visible: true,
                        translationId: pendingSuggestTarget === 1 ? translationId1 : translationId2,
                        originalText: pendingSuggestText,
                        target: pendingSuggestTarget,
                      });
                    }}
                  >
                    <Text style={styles.suggestConfirmBtnYesText}>Yes, suggest</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>
          </Modal>

        <AnchoredPopoverMenu
          visible={showMenu1}
          onDismiss={() => setShowMenu1(false)}
          anchorPosition={menuPosition1}
          items={[
            {
              label: 'Copy',
              onPress: () => copyText(translated1),
            },
            {
              label: 'Suggest a Translation',
              onPress: () => {
                setRefineText(translated1);
                setRefineModal({ visible: true, translationId: translationId1, originalText: translated1, target: 1 });
              },
            },
          ]}
          isDarkMode={isDarkMode}
        />

        <AnchoredPopoverMenu
          visible={showMenu2}
          onDismiss={() => setShowMenu2(false)}
          anchorPosition={menuPosition2}
          items={[
            {
              label: 'Copy',
              onPress: () => copyText(translated2),
            },
            {
              label: 'Suggest a Translation',
              onPress: () => {
                setRefineText(translated2);
                setRefineModal({ visible: true, translationId: translationId2, originalText: translated2, target: 2 });
              },
            },
          ]}
          isDarkMode={isDarkMode}
        />

        <GlassNotification
          visible={notifVisible}
          message={notifMessage}
          onHide={() => setNotifVisible(false)}
          isDarkMode={isDarkMode}
        />
        </View>
      </Portal.Host>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  containerDark: { backgroundColor: '#0F172A' },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  keyboardView: { flex: 1, marginTop: 90 },
  scroll: { paddingHorizontal: 20, paddingBottom: 150 },

  /* Toggle */
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(241,245,249,0.55)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    padding: 4,
    marginTop: 35,
    marginBottom: 20,
  },
  toggleRowDark: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 26,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleActiveDark: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  toggleTextActive: { color: '#1E293B' },
  toggleTextActiveDark: { color: '#F8FAFC' },

  /* Card */
  card: {
    ...glassCard,
    padding: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    elevation: 0,
    shadowOpacity: 0,
  },
  cardDark: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    elevation: 0,
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
    backgroundColor: 'transparent',
  },
  outputArea: { minHeight: 60 },
  outputText: { fontSize: 17, color: '#1E293B', lineHeight: 24 },
  outputTextDark: { color: '#F8FAFC' },
  panelFooter: { flexDirection: 'row', marginTop: 14, gap: 8, alignItems: 'center' },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
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

  /* Feedback Group */
  feedbackGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(148,163,184,0.08)',
    padding: 2,
    borderRadius: 22,
    gap: 2,
  },

  /* Popover menu */
  popoverMenu: {
    position: 'absolute',
    right: 0,
    top: 42,
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 4,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    zIndex: 999,
  },
  popoverMenuDark: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  popoverText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  /* Modal Overlay */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  refineModal: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    minHeight: 350,
  },
  refineModalDark: {
    backgroundColor: '#1E293B',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  refineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  refineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  refineLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  refineOriginal: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#475569',
    marginBottom: 16,
  },
  refineInput: {
    backgroundColor: 'rgba(241,245,249,0.5)',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#1E293B',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  refineInputDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#F8FAFC',
  },
  refineSubmit: {
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  refineSubmitText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  clearBtn: {
    alignSelf: 'center',
    marginTop: 20,
    padding: 10,
  },
  clearBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
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
  /* Feedback Modal */
  feedbackModal: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 50,
    minHeight: 380,
  },
  feedbackModalCentered: {
    width: Dimensions.get('window').width * 0.85,
    borderRadius: 32,
    padding: 24,
    paddingBottom: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.97)',
  },
  feedbackModalDark: {
    backgroundColor: '#1E293B',
  },
  feedbackBody: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 30,
    textAlign: 'center',
  },
  feedbackActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  largeFeedbackBtn: {
    flex: 1,
    height: 72,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 6,
  },
  largeFeedbackText: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },

  /* Suggest Better Translation Confirmation Modal */
  suggestConfirmModal: {
    width: Dimensions.get('window').width * 0.85,
    borderRadius: 28,
    padding: 28,
    paddingBottom: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.97)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  suggestConfirmModalDark: {
    backgroundColor: 'rgba(30,41,59,0.97)',
  },
  suggestConfirmTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 10,
  },
  suggestConfirmBody: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  suggestConfirmBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  suggestConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestConfirmBtnNo: {
    backgroundColor: 'rgba(241,245,249,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  suggestConfirmBtnNoDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  suggestConfirmBtnNoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  suggestConfirmBtnYes: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestConfirmBtnYesText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
