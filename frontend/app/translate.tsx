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
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
    ArrowLeftRight,
    Volume2,
    Copy,
    Languages,
    ChevronDown,
    Mic,
    MicOff,
} from 'lucide-react-native';
import { translateSingle, translateMulti } from '../src/lib/api';
import {
    gradientColors,
    darkGradientColors,
    SUPPORTED_LANGUAGES,
    LANGUAGE_COLORS,
    LANGUAGE_PLACEHOLDERS,
} from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import { useTextToSpeech } from '../src/hooks/useTextToSpeech';
import { useSpeechRecognition } from '../src/hooks/useSpeechRecognition';
import SelectableWord from '../src/components/SelectableWord';

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
    const [loading1, setLoading1] = useState(false);
    const [loading2, setLoading2] = useState(false);

    const [pickerTarget, setPickerTarget] = useState<'source' | 'target1' | 'target2' | null>(null);

    // STT
    const speech = useSpeechRecognition(sourceLang);
    const pulseAnim = useRef(new Animated.Value(1)).current;

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

    // When transcription completes, set the text (auto-translate will kick in via debounce)
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
            return;
        }
        const timer = setTimeout(async () => {
            setLoading1(true);
            try {
                const r1 = await translateSingle(sourceText, sourceLang, targetLang1);
                setTranslated1(r1.output_text || '');
            } catch {
                setTranslated1('Translation unavailable');
            }
            setLoading1(false);

            if (mode === '3way') {
                setLoading2(true);
                try {
                    const r2 = await translateSingle(sourceText, sourceLang, targetLang2);
                    setTranslated2(r2.output_text || '');
                } catch {
                    setTranslated2('Translation unavailable');
                }
                setLoading2(false);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [sourceText, sourceLang, targetLang1, targetLang2, mode]);

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

    const handlePickerSelect = (code: string) => {
        if (pickerTarget === 'source') setSourceLang(code);
        else if (pickerTarget === 'target1') setTargetLang1(code);
        else if (pickerTarget === 'target2') setTargetLang2(code);
    };

    const srcColor = getColorForLang(sourceLang);
    const tgt1Color = getColorForLang(targetLang1);
    const tgt2Color = getColorForLang(targetLang2);

    return (
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
                        {/* Mic button */}
                        <TouchableOpacity
                            style={[styles.micBtnSmall, {
                                backgroundColor: (speech.isListening || speech.isProcessing)
                                    ? '#EF4444'
                                    : srcColor.light
                            }]}
                            onPress={() => {
                                if (speech.isListening) {
                                    speech.stopListening();
                                } else if (!speech.isProcessing) {
                                    speech.startListening();
                                }
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

                        {/* TTS button */}
                        {sourceText.length > 0 && (
                            <TouchableOpacity onPress={() => tts.speak(sourceText, sourceLang)}>
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
                                <SelectableWord
                                    text={translated1}
                                    sourceLang={targetLang1}
                                    targetLang={sourceLang}
                                    style={[styles.resultText, isDarkMode && { color: '#F8FAFC' }]}
                                    isDarkMode={isDarkMode}
                                />
                                <View style={styles.cardFooter}>
                                    <TouchableOpacity onPress={() => tts.speak(translated1, targetLang1)}>
                                        <Volume2 size={18} color={tgt1Color.light} />
                                    </TouchableOpacity>
                                </View>
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
                                <SelectableWord
                                    text={translated2}
                                    sourceLang={targetLang2}
                                    targetLang={sourceLang}
                                    style={[styles.resultText, isDarkMode && { color: '#F8FAFC' }]}
                                    isDarkMode={isDarkMode}
                                />
                                <View style={styles.cardFooter}>
                                    <TouchableOpacity onPress={() => tts.speak(translated2, targetLang2)}>
                                        <Volume2 size={18} color={tgt2Color.light} />
                                    </TouchableOpacity>
                                </View>
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
        </View>
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
        outlineStyle: 'none',
    },
    textInputDark: {
        color: '#F8FAFC',
        outlineStyle: 'none',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 12,
    },
    micBtnSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
});
