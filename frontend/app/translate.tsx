import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Animated,
    Dimensions,
    ToastAndroid,
    Alert,
    Modal,
} from 'react-native';
import { Text, ActivityIndicator, Portal, Provider as PaperProvider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBlur as BlurView } from '../src/components/GlassBlur';
import {
    ArrowLeftRight,
    Volume2,
    Copy,
    Languages,
    ChevronDown,
    Mic,
    MicOff,
    BookOpen,
    ThumbsUp,
    ThumbsDown,
    MoreHorizontal,
    MessageSquare,
    X,
    Send,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { translateSingle, submitFeedback } from '../src/lib/api';
import { getDeviceId } from '../src/utils/device';
import {
    gradientColors,
    darkGradientColors,
    SUPPORTED_LANGUAGES,
    LANGUAGE_COLORS,
    LANGUAGE_PLACEHOLDERS,
    liquidGlass,
} from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import { useTextToSpeech } from '../src/hooks/useTextToSpeech';
import { useSpeechRecognition } from '../src/hooks/useSpeechRecognition';
import TappableWord from '../src/components/TappableWord';
import WordCardModal from '../src/components/WordCardModal';
import SentenceBreakdownSheet from '../src/components/SentenceBreakdownSheet';

const FALLBACK_COLOR = { bg: 'rgba(100,116,139,0.85)', text: '#FFFFFF', trans: '#CBD5E1', light: '#64748B' };
const getColorForLang = (langCode: string) => LANGUAGE_COLORS[langCode] || FALLBACK_COLOR;

export default function TranslateScreen() {
    const { isDarkMode } = useTheme();
    const tts = useTextToSpeech();

    const [mode, setMode] = useState<'2way' | '3way'>('2way');
    const [sourceLang, setSourceLang] = useState('tl');
    const [targetLang1, setTargetLang1] = useState('ceb');
    const [targetLang2, setTargetLang2] = useState('hil');

    const [sourceText, setSourceText] = useState('');
    const [translated1, setTranslated1] = useState('');
    const [translated2, setTranslated2] = useState('');
    const [translationId1, setTranslationId1] = useState('');
    const [translationId2, setTranslationId2] = useState('');
    const [loading1, setLoading1] = useState(false);
    const [loading2, setLoading2] = useState(false);
    const [breakdownVisible, setBreakdownVisible] = useState(false);

    const [pickerTarget, setPickerTarget] = useState<'source' | 'target1' | 'target2' | null>(null);

    // Feedback state
    const [feedbackGiven1, setFeedbackGiven1] = useState<'like' | 'dislike' | null>(null);
    const [feedbackGiven2, setFeedbackGiven2] = useState<'like' | 'dislike' | null>(null);
    const [showMenu1, setShowMenu1] = useState(false);
    const [showMenu2, setShowMenu2] = useState(false);
    const menuRef1 = useRef<any>(null);
    const menuRef2 = useRef<any>(null);
    const [menuPos1, setMenuPos1] = useState({ top: 0, left: 20 });
    const [menuPos2, setMenuPos2] = useState({ top: 0, left: 20 });
    const [refineModal, setRefineModal] = useState<{ visible: boolean; translationId: string; originalText: string; target: 1 | 2 }>({
        visible: false, translationId: '', originalText: '', target: 1,
    });
    const [refineText, setRefineText] = useState('');
    const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
    const [activeFeedbackTarget, setActiveFeedbackTarget] = useState<{ id: string; target: 1 | 2 } | null>(null);

    // Glow animations
    const glowAnim1 = useRef(new Animated.Value(0)).current;
    const glowAnim2 = useRef(new Animated.Value(0)).current;

    // STT
    const speech = useSpeechRecognition(sourceLang);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const [dictWord, setDictWord] = useState('');
    const [sourceLangLookup, setSourceLangLookup] = useState('');
    const [targetLangLookup, setTargetLangLookup] = useState('');
    const [dictVisible, setDictVisible] = useState(false);

    // Pulse animation
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
        if (liveText && liveText !== 'Listening...' && liveText !== 'Processing...' && liveText !== 'Transcribing...') {
            setSourceText(liveText);
        }
    }, [speech.transcript, speech.interimTranscript]);

    // When transcription completes, set the text
    useEffect(() => {
        if (!speech.isListening && !speech.isProcessing && speech.transcript.trim()) {
            setSourceText(speech.transcript.trim());
        }
    }, [speech.isProcessing, speech.transcript]);

    // Auto-translate with debounce
    useEffect(() => {
        if (!sourceText.trim() || sourceText.length < 2) {
            setTranslated1('');
            setTranslated2('');
            setTranslationId1('');
            setTranslationId2('');
            setFeedbackGiven1(null);
            setFeedbackGiven2(null);
            return;
        }
        const timer = setTimeout(async () => {
            setLoading1(true);
            setFeedbackGiven1(null);
            setFeedbackGiven2(null);
            const deviceId = await getDeviceId().catch(() => undefined);
            try {
                const r1 = await translateSingle(sourceText, sourceLang, targetLang1, undefined, deviceId);
                setTranslated1(r1.output_text || '');
                setTranslationId1(r1.translation_id || '');
            } catch {
                setTranslated1('Translation unavailable');
            }
            setLoading1(false);

            if (mode === '3way') {
                setLoading2(true);
                try {
                    const r2 = await translateSingle(sourceText, sourceLang, targetLang2, undefined, deviceId);
                    setTranslated2(r2.output_text || '');
                    setTranslationId2(r2.translation_id || '');
                } catch {
                    setTranslated2('Translation unavailable');
                }
                setLoading2(false);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [sourceText, sourceLang, targetLang1, targetLang2, mode]);

    const openDictionary = (text: string, src: string, tgt: string) => {
        if (!text.trim()) {
            showToast("Generate a translation first to use the dictionary.");
            return;
        }

        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length === 1) {
            const cleanWord = words[0].replace(/[.,!?;:""''()\[\]{}]/g, '').trim();
            setDictWord(cleanWord);
            setSourceLangLookup(src);
            setTargetLangLookup(tgt);
            setDictVisible(true);
        } else {
            setDictWord(text);
            setSourceLangLookup(src);
            setTargetLangLookup(tgt);
            setBreakdownVisible(true);
        }
    };

    const swapLanguages = () => {
        const oldSource = sourceLang;
        const oldTarget = targetLang1;
        setSourceLang(oldTarget);
        setTargetLang1(oldSource);
        if (translated1) {
            setSourceText(translated1);
            setTranslated1('');
        }
    };

    const showToast = (message: string) => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.SHORT);
        } else {
            Alert.alert('', message);
        }
    };

    const handlePickerSelect = (code: string) => {
        if (pickerTarget === 'source') setSourceLang(code);
        else if (pickerTarget === 'target1') setTargetLang1(code);
        else if (pickerTarget === 'target2') setTargetLang2(code);
        setPickerTarget(null);
    };

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

    const handleCopy = async (text: string) => {
        try {
            await Clipboard.setStringAsync(text);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast('Copied to clipboard');
        } catch { }
    };

    const handleSubmitRefinement = async () => {
        if (!refineText.trim()) return;
        try {
            await submitFeedback(refineModal.translationId, 'dislike', refineText.trim());
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast('Suggestion submitted! Thank you.');
        } catch { }
        setRefineModal({ visible: false, translationId: '', originalText: '', target: 1 });
        setRefineText('');
    };

    const srcColor = getColorForLang(sourceLang);
    const tgt1Color = getColorForLang(targetLang1);
    const tgt2Color = getColorForLang(targetLang2);

    const renderActionRow = (
        text: string,
        translationId: string,
        langColor: any,
        src: string,
        tgt: string,
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
            <Animated.View style={[styles.cardFooter, { backgroundColor: glowColor, borderRadius: 12, marginHorizontal: -4, paddingHorizontal: 4 }]}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => tts.speak(text, tgt)}>
                    <Volume2 size={18} color={langColor.light} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => openDictionary(text, tgt, src)}>
                    <BookOpen size={18} color={langColor.light} />
                </TouchableOpacity>

                {/* Feedback Trigger */}
                <TouchableOpacity
                    style={[styles.actionBtn, feedbackState && { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: '#3B82F6' }]}
                    onPress={() => {
                        setActiveFeedbackTarget({ id: translationId, target });
                        setFeedbackModalVisible(true);
                    }}
                >
                    <MessageSquare size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <View>
                    <TouchableOpacity
                        ref={target === 1 ? menuRef1 : menuRef2}
                        style={styles.actionBtn}
                        onPress={() => {
                            const ref = target === 1 ? menuRef1 : menuRef2;
                            const setPos = target === 1 ? setMenuPos1 : setMenuPos2;
                            if (ref.current) {
                                ref.current.measure((_x: number, _y: number, w: number, _h: number, pageX: number, pageY: number) => {
                                    const screenWidth = Dimensions.get('window').width;
                                    setPos({
                                        top: pageY - 92,
                                        left: Math.min(pageX, screenWidth - 220), // anchor from left, clamp to screen edge
                                    });
                                    setShowMenu(!showMenu);
                                });
                            } else {
                                setShowMenu(!showMenu);
                            }
                        }}
                    >
                        <MoreHorizontal size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                    </TouchableOpacity>
                    {showMenu && (
                        <Portal>
                            <TouchableOpacity
                                style={StyleSheet.absoluteFill}
                                onPress={() => setShowMenu(false)}
                            >
                                <View style={[styles.popoverMenu, isDarkMode && styles.popoverMenuDark, {
                                    top: (target === 1 ? menuPos1 : menuPos2).top,
                                    left: (target === 1 ? menuPos1 : menuPos2).left,  // ← was `right`
                                }]}>
                                    <TouchableOpacity
                                        style={styles.popoverItem}
                                        onPress={() => {
                                            setShowMenu(false);
                                            handleCopy(text);
                                        }}
                                    >
                                        <Text style={[styles.popoverText, isDarkMode && { color: '#E2E8F0' }]}>Copy</Text>
                                    </TouchableOpacity>
                                    <View style={[styles.popoverSep, isDarkMode && { backgroundColor: '#334155' }]} />
                                    <TouchableOpacity
                                        style={styles.popoverItem}
                                        onPress={() => {
                                            setShowMenu(false);
                                            setRefineText(text);
                                            setRefineModal({ visible: true, translationId, originalText: text, target });
                                        }}
                                    >
                                        <Text style={[styles.popoverText, isDarkMode && { color: '#E2E8F0' }]}>Suggest a Translation</Text>
                                    </TouchableOpacity>
                                    {/* Caret pointing down toward the button */}
                                    <View style={[styles.popoverCaret, isDarkMode && styles.popoverCaretDark]} />
                                </View>
                            </TouchableOpacity>
                        </Portal>
                    )}
                </View>
            </Animated.View>
        );
    };

    return (
        <PaperProvider>
            <Portal.Host>
                <View style={[styles.container, isDarkMode && styles.containerDark]}>
                    <LinearGradient colors={isDarkMode ? darkGradientColors : gradientColors} style={styles.bg} />

                    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.headerArea}>
                            <Text style={[styles.headerTitle, isDarkMode && { color: '#F8FAFC' }]}>ANO-KAMO?</Text>

                            {/* Mode Toggle */}
                            <View style={[styles.toggleRow, isDarkMode && styles.toggleRowDark]}>
                                <TouchableOpacity
                                    style={[styles.toggleBtn, mode === '2way' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
                                    onPress={() => setMode('2way')}
                                >
                                    <Text style={[styles.toggleText, mode === '2way' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                                        2 Languages
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.toggleBtn, mode === '3way' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
                                    onPress={() => setMode('3way')}
                                >
                                    <Text style={[styles.toggleText, mode === '3way' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                                        3 Languages
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Language Selectors */}
                        <View style={styles.langRow}>
                            <TouchableOpacity style={[styles.langBtn, { borderColor: srcColor.light }]} onPress={() => setPickerTarget('source')}>
                                <View style={[styles.langDot, { backgroundColor: srcColor.light }]} />
                                <Text style={[styles.langLabel, isDarkMode && { color: '#F8FAFC' }]}>{SUPPORTED_LANGUAGES[sourceLang]}</Text>
                                <ChevronDown size={14} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.swapBtn} onPress={swapLanguages}>
                                <ArrowLeftRight size={18} color={isDarkMode ? '#60A5FA' : '#3B82F6'} />
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.langBtn, { borderColor: tgt1Color.light }]} onPress={() => setPickerTarget('target1')}>
                                <View style={[styles.langDot, { backgroundColor: tgt1Color.light }]} />
                                <Text style={[styles.langLabel, isDarkMode && { color: '#F8FAFC' }]}>{SUPPORTED_LANGUAGES[targetLang1]}</Text>
                                <ChevronDown size={14} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>

                        {mode === '3way' && (
                            <View style={[styles.langRow, { marginTop: 8 }]}>
                                <View style={{ flex: 1 }} />
                                <TouchableOpacity style={[styles.langBtn, { borderColor: tgt2Color.light }]} onPress={() => setPickerTarget('target2')}>
                                    <View style={[styles.langDot, { backgroundColor: tgt2Color.light }]} />
                                    <Text style={[styles.langLabel, isDarkMode && { color: '#F8FAFC' }]}>{SUPPORTED_LANGUAGES[targetLang2]}</Text>
                                    <ChevronDown size={14} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Source Input with Mic */}
                        <BlurView
                            intensity={40}
                            tint={isDarkMode ? 'dark' : 'light'}
                            style={[styles.card, isDarkMode && styles.cardDark]}
                        >
                            <TextInput
                                style={[styles.textInput, isDarkMode && styles.textInputDark]}
                                placeholder={
                                    speech.isListening ? 'Listening...'
                                        : speech.isProcessing ? 'Transcribing...'
                                            : LANGUAGE_PLACEHOLDERS[sourceLang] || 'Enter text...'
                                }
                                placeholderTextColor={
                                    (speech.isListening || speech.isProcessing)
                                        ? '#EF4444'
                                        : (isDarkMode ? '#64748B' : '#94A3B8')
                                }
                                value={sourceText}
                                onChangeText={setSourceText}
                                multiline
                                numberOfLines={4}
                            />
                            <View style={styles.cardFooter}>
                                <TouchableOpacity
                                    style={[styles.micBtnSmall, {
                                        backgroundColor: (speech.isListening || speech.isProcessing)
                                            ? '#EF4444'
                                            : srcColor.light
                                    }]}
                                    onPress={() => {
                                        if (speech.isListening) speech.stopListening();
                                        else if (!speech.isProcessing) speech.startListening();
                                    }}
                                    disabled={speech.isProcessing}
                                >
                                    <Animated.View style={{ transform: [{ scale: (speech.isListening || speech.isProcessing) ? pulseAnim : 1 }] }}>
                                        {speech.isListening ? (
                                            <MicOff size={16} color="#FFF" />
                                        ) : speech.isProcessing ? (
                                            <ActivityIndicator size={12} color="#FFF" />
                                        ) : (
                                            <Mic size={16} color="#FFF" />
                                        )}
                                    </Animated.View>
                                </TouchableOpacity>

                                <View style={{ flex: 1 }} />

                                {sourceText.length > 0 && (
                                    <TouchableOpacity style={{ marginLeft: 10 }} onPress={() => tts.speak(sourceText, sourceLang)}>
                                        <Volume2 size={18} color={isDarkMode ? '#60A5FA' : '#3B82F6'} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </BlurView>

                        {/* Translation Result 1 */}
                        {(translated1 || loading1) && (
                            <BlurView
                                intensity={40}
                                tint={isDarkMode ? 'dark' : 'light'}
                                style={[styles.resultCard, { borderLeftColor: tgt1Color.light }, isDarkMode && styles.cardDark]}
                            >
                                <View style={styles.resultHeader}>
                                    <View style={[styles.langDot, { backgroundColor: tgt1Color.light }]} />
                                    <Text style={[styles.resultLang, { color: tgt1Color.light }]}>
                                        {SUPPORTED_LANGUAGES[targetLang1]}
                                    </Text>
                                </View>
                                {loading1 ? (
                                    <ActivityIndicator color={tgt1Color.light} style={{ marginVertical: 12 }} />
                                ) : (
                                    <>
                                        <Text style={[styles.resultText, isDarkMode && { color: '#F8FAFC' }]}>
                                            {translated1}
                                        </Text>
                                        {renderActionRow(
                                            translated1, translationId1, tgt1Color,
                                            sourceLang, targetLang1, 1,
                                            feedbackGiven1, showMenu1, setShowMenu1, glowAnim1,
                                        )}
                                    </>
                                )}
                            </BlurView>
                        )}

                        {/* Translation Result 2 (3-way mode) */}
                        {mode === '3way' && (translated2 || loading2) && (
                            <BlurView
                                intensity={40}
                                tint={isDarkMode ? 'dark' : 'light'}
                                style={[styles.resultCard, { borderLeftColor: tgt2Color.light }, isDarkMode && styles.cardDark]}
                            >
                                <View style={styles.resultHeader}>
                                    <View style={[styles.langDot, { backgroundColor: tgt2Color.light }]} />
                                    <Text style={[styles.resultLang, { color: tgt2Color.light }]}>
                                        {SUPPORTED_LANGUAGES[targetLang2]}
                                    </Text>
                                </View>
                                {loading2 ? (
                                    <ActivityIndicator color={tgt2Color.light} style={{ marginVertical: 12 }} />
                                ) : (
                                    <>
                                        <Text style={[styles.resultText, isDarkMode && { color: '#F8FAFC' }]}>
                                            {translated2}
                                        </Text>
                                        {renderActionRow(
                                            translated2, translationId2, tgt2Color,
                                            sourceLang, targetLang2, 2,
                                            feedbackGiven2, showMenu2, setShowMenu2, glowAnim2,
                                        )}
                                    </>
                                )}
                            </BlurView>
                        )}

                        <View style={{ height: 120 }} />
                    </ScrollView>

                    <BottomNav />

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

                    <WordCardModal
                        visible={dictVisible}
                        onDismiss={() => setDictVisible(false)}
                        word={dictWord}
                        sourceLang={sourceLangLookup}
                        targetLang={targetLangLookup}
                    />

                    <SentenceBreakdownSheet
                        visible={breakdownVisible}
                        onClose={() => setBreakdownVisible(false)}
                        text={dictWord}
                        sourceLang={sourceLangLookup}
                        targetLang={targetLangLookup}
                        onWordPress={(word) => {
                            setBreakdownVisible(false);
                            setDictWord(word);
                            setTimeout(() => setDictVisible(true), 300);
                        }}
                    />

                    {/* Refinement Modal */}
                    <Modal
                        visible={refineModal.visible}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setRefineModal({ ...refineModal, visible: false })}
                    >
                        <View style={styles.modalOverlay}>
                            <BlurView
                                intensity={60}
                                tint={isDarkMode ? 'dark' : 'light'}
                                style={[styles.refineModal, isDarkMode && styles.refineModalDark]}
                            >
                                <View style={styles.modalHandle} />
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
                            </BlurView>
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
                                style={[styles.feedbackModalCentered, liquidGlass, isDarkMode && styles.feedbackModalDark]}
                            >
                                <View style={styles.modalHandle} />
                                <View style={styles.refineHeader}>
                                    <Text style={[styles.refineTitle, isDarkMode && { color: '#F8FAFC' }]}>Rate this translation</Text>
                                    <TouchableOpacity onPress={() => setFeedbackModalVisible(false)}>
                                        <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.feedbackBody, isDarkMode && { color: '#94A3B8' }]}>
                                    Your feedback is important to us!
                                </Text>

                                <View style={styles.feedbackActionRow}>
                                    <TouchableOpacity
                                        style={[styles.largeFeedbackBtn, { backgroundColor: 'rgba(34,197,94,0.1)' }]}
                                        onPress={() => {
                                            if (activeFeedbackTarget) {
                                                handleFeedback(activeFeedbackTarget.id, 'like', activeFeedbackTarget.target);
                                            }
                                            setFeedbackModalVisible(false);
                                        }}
                                    >
                                        <ThumbsUp size={32} color="#22C55E" />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.largeFeedbackBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
                                        onPress={() => {
                                            if (activeFeedbackTarget) {
                                                handleFeedback(activeFeedbackTarget.id, 'dislike', activeFeedbackTarget.target);
                                            }
                                            setFeedbackModalVisible(false);
                                        }}
                                    >
                                        <ThumbsDown size={32} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </BlurView>
                        </View>
                    </Modal>
                </View>
            </Portal.Host>
        </PaperProvider>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    containerDark: { backgroundColor: '#0F172A' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 40 },

    headerArea: {
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1E293B',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: 1,
    },

    toggleRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(241,245,249,0.7)',
        borderRadius: 30,
        padding: 4,
        marginTop: 23,
        marginBottom: 14,
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
        backgroundColor: 'rgba(255,255,255,0.7)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    toggleActiveDark: { backgroundColor: '#334155' },
    toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    toggleTextActive: { color: '#1E293B' },
    toggleTextActiveDark: { color: '#F8FAFC' },

    langRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        gap: 8,
        marginBottom: 8,
    },
    langBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        backgroundColor: 'rgba(255,255,255,0.4)',
        gap: 6,
    },
    langDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    langLabel: {
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
        color: '#1E293B',
    },
    swapBtn: {
        padding: 8,
    },

    card: {
        marginHorizontal: 20,
        marginTop: 8,
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        backgroundColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
    },
    cardDark: {
        backgroundColor: 'rgba(30,41,59,0.4)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    resultCard: {
        marginHorizontal: 20,
        marginTop: 12,
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderLeftWidth: 4,
        overflow: 'hidden',
    },
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    resultLang: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    resultText: {
        fontSize: 17,
        fontWeight: '500',
        lineHeight: 24,
        color: '#1E293B',
    },
    textInput: {
        fontSize: 16,
        color: '#1E293B',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    textInputDark: {
        color: '#F8FAFC',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 4,
    },
    micBtnSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },

    actionBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    popoverMenu: {
        position: 'absolute',
        backgroundColor: '#FFF',
        borderRadius: 14,
        paddingVertical: 4,
        paddingBottom: 16,
        minWidth: 210,
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
    popoverSep: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginHorizontal: 8,
    },
    popoverCaret: {
        position: 'absolute',
        bottom: -8,
        left: 8,        // ← was `right: 8`
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#FFF',
    },
    popoverCaretDark: {
        borderTopColor: '#1E293B',
    },

    /* Modal Overlay */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
    modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    refineModal: {
        backgroundColor: 'rgba(255,255,255,0.95)',
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
        minHeight: 120,
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
        height: 140,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    largeFeedbackText: {
        marginTop: 12,
        fontSize: 18,
        fontWeight: '700',
    },
});
