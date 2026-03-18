import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    TextInput,
    Alert,
    Dimensions,
    Animated,
    LayoutAnimation,
    UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
    Mic,
    MicOff,
    Send,
    Volume2,
    ChevronDown,
    Trash2,
    BookOpen,
    ArrowUpDown,
    ChevronLeft,
    Settings,
    ArrowLeft,
    Sliders,
    MoreVertical,
    Copy,
    RotateCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Snackbar, Portal, Modal as PaperModal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import {
    createConversation,
    sendMessage as apiSendMessage,
    translateSingle,
    refineTranslation,
} from '../src/lib/api';
import {
    gradientColors,
    darkGradientColors,
    SUPPORTED_LANGUAGES,
    LANGUAGE_PLACEHOLDERS,
    LANGUAGE_COLORS,
    liquidGlass,
} from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import { useSpeechRecognition } from '../src/hooks/useSpeechRecognition';
import { useTextToSpeech } from '../src/hooks/useTextToSpeech';
import TappableWord from '../src/components/TappableWord';
import WordCardModal from '../src/components/WordCardModal';
import SentenceBreakdownSheet from '../src/components/SentenceBreakdownSheet';
import { useConversation, Message, Translation } from '../src/context/ConversationContext';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

// interfaces moved to ConversationContext

const FALLBACK_COLOR = { bg: 'rgba(100,116,139,0.85)', text: '#FFFFFF', trans: '#CBD5E1', light: '#64748B' };
const getColorForLang = (langCode: string) => LANGUAGE_COLORS[langCode] || FALLBACK_COLOR;

// ─────────────────────────────────────────
// Shared Bubble Component
// ─────────────────────────────────────────
function ChatBubble({
    msg,
    alignment,
    tts,
    openDictionary,
    isDarkMode,
    onRetranslate,
    isSyncShimmering,
}: {
    msg: Message;
    alignment: 'left' | 'right' | 'center';
    tts: { speak: (text: string, lang: string) => void };
    openDictionary: (text: string, src: string, tgt: string) => void;
    isDarkMode: boolean;
    onRetranslate?: (msgId: string, newTone: string) => void;
    isSyncShimmering?: boolean;
}) {
    const langColor = getColorForLang(msg.lang);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    const [toneMenuVisible, setToneMenuVisible] = useState(false);
    const [toneMenuAnchor, setToneMenuAnchor] = useState({ x: 0, y: 0 });

    const showShimmer = isSyncShimmering;

    useEffect(() => {
        if (showShimmer) {
            const anim = Animated.loop(
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 600, // Phase 11.2: 0.6s sweep
                    useNativeDriver: true,
                })
            );
            anim.start();
            return () => anim.stop();
        } else {
            shimmerAnim.setValue(0);
        }
    }, [showShimmer]);

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    const openMenu = (event: any) => {
        const { pageX, pageY } = event.nativeEvent;
        setMenuAnchor({ x: pageX - 120, y: pageY + 10 });
        setMenuVisible(true);
    };

    const copyToClipboard = async (text: string) => {
        await Clipboard.setStringAsync(text);
        setMenuVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const openToneMenu = (event: any) => {
        const { pageX, pageY } = event.nativeEvent;
        setToneMenuAnchor({ x: pageX - 120, y: pageY + 10 });
        setToneMenuVisible(true);
    };

    const handleToneSelect = (tone: string) => {
        setToneMenuVisible(false);
        onRetranslate?.(msg.id, tone);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    return (
        <View
            style={[
                styles.msgRow,
                alignment === 'left' ? styles.msgLeft :
                    alignment === 'center' ? styles.msgCenter :
                        styles.msgRight,
            ]}
        >
            <View style={[styles.bubble, { backgroundColor: langColor.bg }]}>
                {showShimmer && (
                    <View style={StyleSheet.absoluteFill}>
                        <Animated.View
                            style={{
                                ...StyleSheet.absoluteFillObject,
                                transform: [{ translateX: shimmerTranslate }],
                            }}
                        >
                            <LinearGradient
                                colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={{ flex: 1 }}
                            />
                        </Animated.View>
                    </View>
                )}

                <View style={styles.bubbleHeader}>
                    <Text style={styles.bubbleSpeakerLabel}>
                        {SUPPORTED_LANGUAGES[msg.lang]}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {msg.tone && (
                            <Text style={[styles.bubbleToneLabel, { opacity: 0.6 }]}>
                                {msg.tone}
                            </Text>
                        )}
                        <TouchableOpacity onPress={openMenu} style={styles.moreBtn}>
                            <MoreVertical size={14} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.bubbleTextContainer}>
                    <Text style={[styles.bubbleText, { color: langColor.text, flex: 1 }]}>
                        {msg.text}
                    </Text>
                </View>

                {/* Phase 11.1: Source Utility Row (Right-Aligned) */}
                <View style={styles.bubbleUtilityRow}>
                    <TouchableOpacity
                        onPress={() => tts.speak(msg.text, msg.lang)}
                        style={styles.utilityBtn}
                    >
                        <Volume2 size={16} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => openDictionary(msg.text, msg.lang, msg.translations[0]?.lang || 'en')}
                        style={styles.utilityBtn}
                    >
                        <BookOpen size={16} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                    {onRetranslate && (
                        <TouchableOpacity
                            onPress={openToneMenu}
                            style={styles.utilityBtn}
                        >
                            <RotateCw size={16} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                    )}
                </View>

                {msg.translations.map((tr, idx) => {
                    const trColor = getColorForLang(tr.lang);
                    const isError = tr.text === '(Try again)';
                    return (
                        <View key={idx}>
                            <View style={[styles.bubbleDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                            <View style={styles.transRow}>
                                <View style={[styles.transLangDot, { backgroundColor: trColor.light }]} />
                                <Text style={styles.transLangLabel}>
                                    {SUPPORTED_LANGUAGES[tr.lang]}
                                </Text>
                            </View>
                            <View style={styles.bubbleTextContainer}>
                                <Text style={[
                                    styles.transText,
                                    { color: langColor.trans, flex: 1 },
                                    isError && {
                                        color: isDarkMode ? '#F87171' : '#EF4444',
                                        fontWeight: '500', // Medium weight
                                        textAlign: alignment === 'center' ? 'center' : (alignment === 'left' ? 'left' : 'right'),
                                        fontStyle: 'normal'
                                    }
                                ]}>
                                    {isError ? 'Paki-ulit (Try again)' : tr.text}
                                </Text>
                                {!isError && (
                                    <View style={styles.inlineActionRow}>
                                        <TouchableOpacity
                                            onPress={() => tts.speak(tr.text, tr.lang)}
                                            style={styles.inlineTTS}
                                        >
                                            <Volume2 size={16} color="rgba(255,255,255,0.7)" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => openDictionary(tr.text, tr.lang, msg.lang)}
                                            style={styles.inlineTTS}
                                        >
                                            <BookOpen size={16} color="rgba(255,255,255,0.7)" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>

            <Portal>
                {menuVisible && (
                    <>
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            onPress={() => setMenuVisible(false)}
                        />
                        <BlurView
                            intensity={30}
                            tint={isDarkMode ? 'dark' : 'light'}
                            style={[
                                styles.bubbleMenu,
                                { top: menuAnchor.y, left: menuAnchor.x },
                                isDarkMode && styles.bubbleMenuDark
                            ]}
                        >
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => copyToClipboard(msg.translations[0]?.text || msg.text)}
                            >
                                <Copy size={16} color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
                                <Text style={[styles.menuText, isDarkMode && { color: '#F8FAFC' }]}>Copy Text</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    setMenuVisible(false);
                                    tts.speak(msg.translations[0]?.text || msg.text, msg.translations[0]?.lang || msg.lang);
                                }}
                            >
                                <Volume2 size={16} color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
                                <Text style={[styles.menuText, isDarkMode && { color: '#F8FAFC' }]}>Speak</Text>
                            </TouchableOpacity>
                        </BlurView>
                    </>
                )}

                {toneMenuVisible && (
                    <>
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            onPress={() => setToneMenuVisible(false)}
                        />
                        <BlurView
                            intensity={50}
                            tint={isDarkMode ? 'dark' : 'light'}
                            style={[
                                styles.bubbleMenu,
                                { top: toneMenuAnchor.y, left: toneMenuAnchor.x },
                                isDarkMode && styles.bubbleMenuDark,
                                { width: 160 }
                            ]}
                        >
                            {['Formal', 'Street', 'Taglish', 'Respectful', 'Direct'].map(t => (
                                <TouchableOpacity
                                    key={t}
                                    style={styles.menuItem}
                                    onPress={() => handleToneSelect(t.toLowerCase())}
                                >
                                    <Text style={[styles.menuText, isDarkMode && { color: '#F8FAFC' }]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    setToneMenuVisible(false);
                                    onRetranslate?.(msg.id, 'custom');
                                }}
                            >
                                <Sliders size={16} color={isDarkMode ? '#60A5FA' : '#3B82F6'} />
                                <Text style={[styles.menuText, isDarkMode && { color: '#60A5FA' }, !isDarkMode && { color: '#3B82F6' }]}>Custom...</Text>
                            </TouchableOpacity>
                        </BlurView>
                    </>
                )}
            </Portal>
        </View>
    );
}

// ─────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────
export default function ConversationScreen() {
    const { isDarkMode } = useTheme();
    const router = useRouter();
    const {
        messages,
        viewMode,
        lastStandardMode,
        langs,
        activeSpeaker,
        conversationId,
        setViewMode,
        setMessages,
        setLangs,
        setActiveSpeaker,
        setConversationId,
        clearMessages,
        activeTone,
        setActiveTone,
    } = useConversation();

    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const tts = useTextToSpeech();

    const [toneBarVisible, setToneBarVisible] = useState(false);
    const [customToneInput, setCustomToneInput] = useState('');
    const [isCustomMode, setIsCustomMode] = useState(false);

    // Snackbar / Toast state
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const [isSyncShimmering, setIsSyncShimmering] = useState(false);

    // Custom Glassmorphic Modal state (Phase 8.1)
    const [confirmModal, setConfirmModal] = useState<{
        visible: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText: string;
        isDestructive?: boolean;
    }>({
        visible: false,
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: 'Confirm',
    });

    const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = 'Confirm', isDestructive = false) => {
        setConfirmModal({
            visible: true,
            title,
            message,
            onConfirm,
            confirmText,
            isDestructive,
        });
    };

    const handleAutoRetranslate = async (msgId: string, newTone: string) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;

        setIsSyncShimmering(true);

        try {
            const targets = msg.translations.map(t => t.lang);
            const res = await refineTranslation(msg.text, msg.lang, targets, newTone);

            setMessages(prev => prev.map(m => {
                if (m.id === msgId) {
                    return {
                        ...m,
                        text: res.refined_text,
                        tone: newTone,
                        translations: m.translations.map((t, idx) => ({
                            ...t,
                            text: sanitizeTranslation(res.output_texts[idx])
                        }))
                    };
                }
                return m;
            }));
        } catch (err) {
            console.error('Retranslate error:', err);
            setSnackbarMessage('Paki-ulit (Try again)');
            setSnackbarVisible(true);
        } finally {
            setTimeout(() => setIsSyncShimmering(false), 800);
        }
    };

    const sanitizeTranslation = (text: string): string => {
        if (!text) return 'Invalid Input';
        // Phase 8.3: Anti-JSON Leak
        if (text.includes('{') || text.includes('}') || text.includes(':')) {
            try {
                // If it's valid JSON but leaked, try to extract 't'
                const parsed = JSON.parse(text);
                if (parsed.t) return parsed.t;
                return 'Invalid Input';
            } catch {
                return 'Invalid Input';
            }
        }
        return text;
    };

    const lang0 = langs[0];
    const lang1 = langs[1];
    const lang2 = langs[2];

    const [pickerFor, setPickerFor] = useState<number | null>(null);

    // Dictionary
    const [dictVisible, setDictVisible] = useState(false);
    const [dictWord, setDictWord] = useState('');
    const [dictSourceLang, setDictSourceLang] = useState('');
    const [dictTargetLang, setDictTargetLang] = useState('');
    const [breakdownVisible, setBreakdownVisible] = useState(false);

    // ── Speech (Side-by-Side / 3-Way uses a single hook) ──
    const getActiveLang = () => {
        if (activeSpeaker === 0) return lang0;
        if (activeSpeaker === 1) return lang1;
        return lang2;
    };
    const speech = useSpeechRecognition(getActiveLang());
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // ── Face-to-Face: Dual speech hooks ──
    const speechBottom = useSpeechRecognition(lang0); // Speaker A (bottom)
    const speechTop = useSpeechRecognition(lang1);    // Speaker B (top)
    const pulseAnimBottom = useRef(new Animated.Value(1)).current;
    const pulseAnimTop = useRef(new Animated.Value(1)).current;

    // Auto-TTS flag — speak the translated text after each message
    const lastMessageIdRef = useRef<string | null>(null);

    // Pulse animation for standard mode mic
    useEffect(() => {
        if (viewMode === 'face_to_face') return;
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
    }, [speech.isListening, speech.isProcessing, viewMode]);

    // Pulse animation for F2F bottom mic
    useEffect(() => {
        if (viewMode !== 'face_to_face') return;
        if (speechBottom.isListening || speechBottom.isProcessing) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnimBottom, { toValue: 1.3, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnimBottom, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            pulseAnimBottom.setValue(1);
        }
    }, [speechBottom.isListening, speechBottom.isProcessing, viewMode]);

    // Pulse animation for F2F top mic
    useEffect(() => {
        if (viewMode !== 'face_to_face') return;
        if (speechTop.isListening || speechTop.isProcessing) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnimTop, { toValue: 1.3, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnimTop, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            pulseAnimTop.setValue(1);
        }
    }, [speechTop.isListening, speechTop.isProcessing, viewMode]);

    // ── Standard mode: auto-populate + auto-send ──
    useEffect(() => {
        if (viewMode === 'face_to_face') return;
        const liveText = (speech.transcript + ' ' + speech.interimTranscript).trim();
        if (liveText && liveText !== 'Listening...' && liveText !== 'Processing...' && liveText !== 'Transcribing...') {
            setInputText(liveText);
        } else if (speech.isListening || speech.isProcessing) {
            setInputText('');
        }
    }, [speech.transcript, speech.interimTranscript, viewMode]);

    useEffect(() => {
        if (viewMode === 'face_to_face') return;
        if (!speech.isListening && !speech.isProcessing && speech.transcript.trim()) {
            const finalText = speech.transcript.trim();
            setInputText(finalText);
            handleAutoSend(finalText);
        }
    }, [speech.isProcessing, speech.transcript, viewMode]);

    // ── Face-to-Face: auto-send for bottom mic (Speaker A) ──
    useEffect(() => {
        if (viewMode !== 'face_to_face') return;
        if (!speechBottom.isListening && !speechBottom.isProcessing && speechBottom.transcript.trim()) {
            handleF2FSend(speechBottom.transcript.trim(), 0);
        }
    }, [speechBottom.isProcessing, speechBottom.transcript, viewMode]);

    // ── Face-to-Face: auto-send for top mic (Speaker B) ──
    useEffect(() => {
        if (viewMode !== 'face_to_face') return;
        if (!speechTop.isListening && !speechTop.isProcessing && speechTop.transcript.trim()) {
            handleF2FSend(speechTop.transcript.trim(), 1);
        }
    }, [speechTop.isProcessing, speechTop.transcript, viewMode]);

    // ── Auto-TTS when a new message arrives in F2F mode ──
    useEffect(() => {
        if (viewMode !== 'face_to_face') return;
        if (messages.length === 0) return;
        const latest = messages[messages.length - 1];
        if (latest.id === lastMessageIdRef.current) return;
        lastMessageIdRef.current = latest.id;
        // Speak the translated text in the OTHER speaker's language
        if (latest.translations.length > 0) {
            const tr = latest.translations[0];
            tts.speak(tr.text, tr.lang);
        }
    }, [messages, viewMode]);

    const scrollRef = useRef<ScrollView>(null);
    const scrollTopRef = useRef<ScrollView>(null);
    const scrollBottomRef = useRef<ScrollView>(null);

    useEffect(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
        scrollTopRef.current?.scrollToEnd({ animated: true });
        scrollBottomRef.current?.scrollToEnd({ animated: true });
    }, [messages]);

    // Create backend conversation session
    useEffect(() => {
        // Only create new session if none exists
        if (conversationId) return;

        const speakerCount = viewMode === 'three_way' ? 3 : 2;
        const backendMode = viewMode === 'three_way' ? 'three_way' : 'two_way';
        const participants = [
            { speaker_label: 'A', preferred_language: lang0 },
            { speaker_label: 'B', preferred_language: lang1 },
        ];
        if (speakerCount === 3) {
            participants.push({ speaker_label: 'C', preferred_language: lang2 });
        }
        createConversation(backendMode, participants, viewMode)
            .then(res => setConversationId(res.conversation_id))
            .catch(() => setConversationId(null));
    }, [viewMode]);

    const handleViewModeChange = (mode: 'two_way' | 'three_way' | 'face_to_face') => {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        setViewMode(mode);
    };

    const getLang = (speaker: number) => {
        if (speaker === 0) return lang0;
        if (speaker === 1) return lang1;
        return lang2;
    };

    const setLang = (speaker: number, code: string) => {
        setLangs(speaker, code);
    };

    const getTargetLangs = (speaker: number): string[] => {
        const allLangs = [lang0, lang1];
        if (viewMode === 'three_way') allLangs.push(lang2);
        const srcLang = getLang(speaker);
        const targets = allLangs
            .filter((_, i) => i !== speaker)
            .filter(l => l !== srcLang);
        return [...new Set(targets.length > 0 ? targets : allLangs.filter((_, i) => i !== speaker))];
    };

    // Standard mode send
    const handleAutoSend = async (text: string) => {
        if (!text.trim()) return;
        const fromLang = getLang(activeSpeaker);
        const targetLangs = getTargetLangs(activeSpeaker);
        const speakerLabel = ['A', 'B', 'C'][activeSpeaker];

        setLoading(true);
        try {
            const translations: Translation[] = [];
            for (const tl of targetLangs) {
                try {
                    if (conversationId) {
                        const res = await apiSendMessage(conversationId, speakerLabel, text, fromLang, tl, activeTone || undefined);
                        translations.push({ text: sanitizeTranslation(res.translated_text) || '', lang: tl });
                    } else {
                        const res = await translateSingle(text, fromLang, tl, activeTone || undefined);
                        translations.push({ text: sanitizeTranslation(res.output_text) || '', lang: tl });
                    }
                } catch {
                    translations.push({ text: '(Try again)', lang: tl });
                }
            }
            const msg: Message = {
                id: Date.now().toString(),
                text,
                translations,
                speaker: activeSpeaker,
                lang: fromLang,
                tone: activeTone || undefined,
            };
            setMessages(prev => [...prev, msg]);
            setInputText('');
            lastMessageIdRef.current = msg.id;
        } catch {
            const msg: Message = {
                id: Date.now().toString(),
                text,
                translations: targetLangs.map(tl => ({ text: '(Try again)', lang: tl })),
                speaker: activeSpeaker,
                lang: getLang(activeSpeaker),
            };
            setMessages(prev => [...prev, msg]);
            setInputText('');
        }
        setLoading(false);
    };

    // Face-to-Face send
    const handleF2FSend = async (text: string, speaker: number) => {
        if (!text.trim()) return;
        const fromLang = getLang(speaker);
        const targetLang = speaker === 0 ? lang1 : lang0;
        const speakerLabel = speaker === 0 ? 'A' : 'B';

        setLoading(true);
        try {
            let translatedText = '';
            try {
                if (conversationId) {
                    const res = await apiSendMessage(conversationId, speakerLabel, text, fromLang, targetLang, activeTone || undefined);
                    translatedText = sanitizeTranslation(res.translated_text) || '';
                } else {
                    const res = await translateSingle(text, fromLang, targetLang, activeTone || undefined);
                    translatedText = sanitizeTranslation(res.output_text) || '';
                }
            } catch {
                translatedText = '(Try again)';
            }
            const msg: Message = {
                id: Date.now().toString(),
                text,
                translations: [{ text: translatedText, lang: targetLang }],
                speaker,
                lang: fromLang,
                tone: activeTone || undefined,
            };
            setMessages(prev => [...prev, msg]);
            lastMessageIdRef.current = msg.id;
        } catch {
            const msg: Message = {
                id: Date.now().toString(),
                text,
                translations: [{ text: '(Try again)', lang: targetLang }],
                speaker,
                lang: fromLang,
            };
            setMessages(prev => [...prev, msg]);
        }
        setLoading(false);
    };

    const openDictionary = (text: string, src: string, tgt: string) => {
        if (!text.trim()) return;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length === 1) {
            const cleanWord = words[0].replace(/[.,!?;:""\"''()\[\]{}]/g, '').trim();
            setDictWord(cleanWord);
            setDictSourceLang(src);
            setDictTargetLang(tgt);
            setDictVisible(true);
        } else {
            setDictWord(text);
            setDictSourceLang(src);
            setDictTargetLang(tgt);
            setBreakdownVisible(true);
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;
        await handleAutoSend(inputText.trim());
    };

    const clearConversation = () => {
        showConfirm(
            'Clear Conversation',
            'Remove all messages? This action cannot be undone.',
            () => {
                clearMessages();
                setInputText('');
                lastMessageIdRef.current = null;
                const backendMode = viewMode === 'three_way' ? 'three_way' : 'two_way';
                const participants = [
                    { speaker_label: 'A', preferred_language: lang0 },
                    { speaker_label: 'B', preferred_language: lang1 },
                ];
                if (viewMode === 'three_way') {
                    participants.push({ speaker_label: 'C', preferred_language: lang2 });
                }
                createConversation(backendMode, participants, viewMode)
                    .then(res => setConversationId(res.conversation_id))
                    .catch(() => setConversationId(null));
            },
            'Clear All',
            true
        );
    };

    const clearSpeakerMessages = (speaker: number) => {
        const speakerName = speaker === 0 ? 'A (bottom)' : speaker === 1 ? 'B (top)' : 'C';
        showConfirm(
            `Clear Speaker ${speakerName}`,
            `Remove all messages from Speaker ${speakerName}?`,
            () => {
                setMessages((prev: Message[]) => prev.filter((m: Message) => m.speaker !== speaker));
            },
            'Clear',
            true
        );
    };

    const swapLanguages = () => {
        const tmp = lang0;
        setLangs(0, lang1);
        setLangs(1, tmp);
    };

    const speakerCount = viewMode === 'three_way' ? 3 : 2;

    // ─────────────────────────────────────────
    // Face-to-Face Render
    // ─────────────────────────────────────────
    if (viewMode === 'face_to_face') {
        const topColor = getColorForLang(lang1);
        const bottomColor = getColorForLang(lang0);
        const isBusyTop = speechTop.isListening || speechTop.isProcessing;
        const isBusyBottom = speechBottom.isListening || speechBottom.isProcessing;

        return (
            <View style={[styles.container, isDarkMode && styles.containerDark]}>
                <LinearGradient colors={isDarkMode ? darkGradientColors : gradientColors} style={styles.bg} />

                {/* ═══ TOP SECTION (rotated 180°) — Speaker B ═══ */}
                <View style={[styles.f2fSection, { transform: [{ rotate: '180deg' }] }]}>
                    {/* Language label + picker */}
                    <TouchableOpacity
                        style={[styles.f2fLangChip, { backgroundColor: topColor.bg, borderColor: topColor.light }]}
                        onPress={() => setPickerFor(1)}
                    >
                        <View style={[styles.langDot, { backgroundColor: topColor.light }]} />
                        <Text style={styles.f2fLangText}>{SUPPORTED_LANGUAGES[lang1]}</Text>
                        <ChevronDown size={12} color="#FFF" />
                    </TouchableOpacity>

                    {/* Chat bubbles — ALL messages, aligned by speaker */}
                    <ScrollView
                        ref={scrollTopRef}
                        style={styles.f2fChat}
                        contentContainerStyle={styles.f2fChatContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {messages.length === 0 && (
                            <View style={styles.f2fEmpty}>
                                <Mic size={28} color={isDarkMode ? 'rgba(255,255,255,0.3)' : '#4A4A4A'} />
                                <Text style={[styles.f2fEmptyText, !isDarkMode && { color: '#4A4A4A' }]}>Tap the mic to start</Text>
                            </View>
                        )}
                        {messages.map((msg) => (
                            <ChatBubble
                                key={msg.id}
                                msg={msg}
                                alignment={msg.speaker === 1 ? 'right' : 'left'}
                                tts={tts}
                                openDictionary={openDictionary}
                                isDarkMode={isDarkMode}
                                onRetranslate={handleAutoRetranslate}
                                isSyncShimmering={isSyncShimmering}
                            />
                        ))}
                    </ScrollView>

                    {/* Mic button */}
                    <View style={styles.f2fMicRow}>
                        {isBusyTop && (
                            <Text style={styles.f2fListeningLabel}>
                                {speechTop.isProcessing ? 'Transcribing...' : 'Listening...'}
                            </Text>
                        )}
                        <TouchableOpacity
                            style={[styles.f2fMicBtn, {
                                backgroundColor: isBusyTop ? '#EF4444' : topColor.light,
                            }]}
                            onPress={() => {
                                if (speechTop.isListening) {
                                    speechTop.stopListening();
                                } else if (!speechTop.isProcessing) {
                                    speechTop.startListening();
                                }
                            }}
                            disabled={speechTop.isProcessing || loading}
                        >
                            <Animated.View style={{ transform: [{ scale: isBusyTop ? pulseAnimTop : 1 }] }}>
                                {speechTop.isListening ? (
                                    <MicOff size={26} color="#FFF" />
                                ) : speechTop.isProcessing ? (
                                    <ActivityIndicator size={22} color="#FFF" />
                                ) : (
                                    <Mic size={26} color="#FFF" />
                                )}
                            </Animated.View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ═══ CENTER DIVIDER — Control Spine ═══ */}
                <View style={[styles.f2fDivider, isDarkMode && styles.f2fDividerDark]}>
                    <TouchableOpacity
                        style={styles.f2fSpineBtn}
                        onPress={() => setViewMode(lastStandardMode)}
                    >
                        <ChevronLeft size={18} color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.f2fSpineBtn}
                        onPress={() => clearSpeakerMessages(1)}
                    >
                        <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                    <View style={styles.f2fDividerLine} />
                    <TouchableOpacity style={styles.f2fSwapBtn} onPress={swapLanguages}>
                        <ArrowUpDown size={18} color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
                    </TouchableOpacity>
                    <View style={styles.f2fDividerLine} />
                    <TouchableOpacity
                        style={styles.f2fSpineBtn}
                        onPress={() => clearSpeakerMessages(0)}
                    >
                        <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.f2fSpineBtn}
                        onPress={() => router.push('/settings' as any)}
                    >
                        <Settings size={18} color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
                    </TouchableOpacity>
                </View>

                {/* ═══ BOTTOM SECTION — Speaker A ═══ */}
                <View style={[styles.f2fSection, { paddingBottom: 110 }]}>
                    {/* Language label + picker */}
                    <TouchableOpacity
                        style={[styles.f2fLangChip, { backgroundColor: bottomColor.bg, borderColor: bottomColor.light }]}
                        onPress={() => setPickerFor(0)}
                    >
                        <View style={[styles.langDot, { backgroundColor: bottomColor.light }]} />
                        <Text style={styles.f2fLangText}>{SUPPORTED_LANGUAGES[lang0]}</Text>
                        <ChevronDown size={12} color="#FFF" />
                    </TouchableOpacity>

                    {/* Chat bubbles — ALL messages, aligned by speaker */}
                    <ScrollView
                        ref={scrollBottomRef}
                        style={styles.f2fChat}
                        contentContainerStyle={styles.f2fChatContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {messages.length === 0 && (
                            <View style={styles.f2fEmpty}>
                                <Mic size={28} color={isDarkMode ? 'rgba(255,255,255,0.3)' : '#4A4A4A'} />
                                <Text style={[styles.f2fEmptyText, !isDarkMode && { color: '#4A4A4A' }]}>Tap the mic to start</Text>
                            </View>
                        )}
                        {messages.map((msg) => (
                            <ChatBubble
                                key={msg.id}
                                msg={msg}
                                alignment={msg.speaker === 0 ? 'right' : 'left'}
                                tts={tts}
                                openDictionary={openDictionary}
                                isDarkMode={isDarkMode}
                                onRetranslate={handleAutoRetranslate}
                                isSyncShimmering={isSyncShimmering}
                            />
                        ))}
                    </ScrollView>

                    {/* Mic button */}
                    <View style={styles.f2fMicRow}>
                        {isBusyBottom && (
                            <Text style={styles.f2fListeningLabel}>
                                {speechBottom.isProcessing ? 'Transcribing...' : 'Listening...'}
                            </Text>
                        )}
                        <TouchableOpacity
                            style={[styles.f2fMicBtn, {
                                backgroundColor: isBusyBottom ? '#EF4444' : bottomColor.light,
                            }]}
                            onPress={() => {
                                if (speechBottom.isListening) {
                                    speechBottom.stopListening();
                                } else if (!speechBottom.isProcessing) {
                                    speechBottom.startListening();
                                }
                            }}
                            disabled={speechBottom.isProcessing || loading}
                        >
                            <Animated.View style={{ transform: [{ scale: isBusyBottom ? pulseAnimBottom : 1 }] }}>
                                {speechBottom.isListening ? (
                                    <MicOff size={26} color="#FFF" />
                                ) : speechBottom.isProcessing ? (
                                    <ActivityIndicator size={22} color="#FFF" />
                                ) : (
                                    <Mic size={26} color="#FFF" />
                                )}
                            </Animated.View>
                        </TouchableOpacity>
                    </View>
                </View>



                <BottomNav />

                <LanguagePicker
                    visible={pickerFor !== null}
                    onDismiss={() => setPickerFor(null)}
                    onSelect={(code) => {
                        if (pickerFor !== null) setLang(pickerFor, code);
                        setPickerFor(null);
                    }}
                    selected={pickerFor !== null ? getLang(pickerFor) : 'tl'}
                />
                <WordCardModal
                    visible={dictVisible}
                    onDismiss={() => setDictVisible(false)}
                    word={dictWord}
                    sourceLang={dictSourceLang}
                    targetLang={dictTargetLang}
                />
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
            </View>
        );
    }

    // ─────────────────────────────────────────
    // Standard (Two-Way / Three-Way) Render
    // ─────────────────────────────────────────
    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <LinearGradient colors={isDarkMode ? darkGradientColors : gradientColors} style={styles.bg} />

            {/* Custom Glass Header */}
            <View style={styles.customHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.customHeaderBtn}>
                    <BlurView
                        intensity={20}
                        tint={isDarkMode ? 'dark' : 'light'}
                        style={[styles.customHeaderGlass, isDarkMode && styles.customHeaderGlassDark]}
                    >
                        <ArrowLeft size={20} color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
                    </BlurView>
                </TouchableOpacity>

                {/* Phase 9: Mode-Specific Branding */}
                <Text style={[styles.headerModeBranding, isDarkMode && { color: '#F8FAFC' }]}>
                    {viewMode === 'face_to_face' ? '' : 'Chat'}
                </Text>

                <TouchableOpacity onPress={() => router.push('/settings' as any)} style={styles.customHeaderBtn}>
                    <BlurView
                        intensity={20}
                        tint={isDarkMode ? 'dark' : 'light'}
                        style={[styles.customHeaderGlass, isDarkMode && styles.customHeaderGlassDark]}
                    >
                        <Settings size={20} color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
                    </BlurView>
                </TouchableOpacity>
            </View>

            <View style={styles.headerArea}>
                {/* Mode Toggle */}
                <View style={[styles.toggleRow, isDarkMode && styles.toggleRowDark]}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'two_way' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
                        onPress={() => handleViewModeChange('two_way')}
                    >
                        <Text style={[styles.toggleText, viewMode === 'two_way' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                            2-Way
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'three_way' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
                        onPress={() => handleViewModeChange('three_way')}
                    >
                        <Text style={[styles.toggleText, viewMode === 'three_way' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                            3-Way
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, (viewMode as string) === 'face_to_face' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
                        onPress={() => handleViewModeChange('face_to_face')}
                    >
                        <Text style={[styles.toggleText, (viewMode as string) === 'face_to_face' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                            Face-to-Face
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Speaker Language Chips */}
                <View style={styles.speakerRow}>
                    {Array.from({ length: speakerCount }).map((_, i) => {
                        const langCode = getLang(i);
                        const langColor = getColorForLang(langCode);
                        const isActive = activeSpeaker === i;
                        return (
                            <TouchableOpacity
                                key={i}
                                style={[
                                    styles.speakerChip,
                                    {
                                        borderColor: isActive ? langColor.light : 'rgba(0,0,0,0.1)',
                                        backgroundColor: isActive ? langColor.bg : 'rgba(255,255,255,0.5)',
                                    },
                                    isDarkMode && !isActive && { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(30,41,59,0.5)' }
                                ]}
                                onPress={() => {
                                    if (activeSpeaker === i) {
                                        setPickerFor(i);
                                    } else {
                                        setActiveSpeaker(i);
                                    }
                                }}
                            >
                                <View style={[styles.langDot, { backgroundColor: langColor.light }]} />
                                <Text style={[
                                    styles.speakerChipText,
                                    { color: isActive ? '#FFF' : (isDarkMode ? '#F8FAFC' : '#1E293B') },
                                ]}>
                                    {SUPPORTED_LANGUAGES[langCode]}
                                </Text>
                                <ChevronDown size={12} color={isActive ? '#FFF' : (isDarkMode ? '#F8FAFC' : '#1E293B')} />
                            </TouchableOpacity>
                        );
                    })}

                    <TouchableOpacity style={styles.clearBtn} onPress={clearConversation}>
                        <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chat Area */}
            <ScrollView
                ref={scrollRef}
                style={styles.chatArea}
                contentContainerStyle={styles.chatContent}
                showsVerticalScrollIndicator={false}
            >
                {messages.length === 0 && (
                    <View style={styles.emptyState}>
                        <Mic size={44} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>
                            {viewMode === 'two_way' ? '2-Way Conversation' : '3-Way Conversation'}
                        </Text>
                        <Text style={styles.emptySubtext}>
                            Tap a speaker above to set who's talking, then type or use the mic. Tap again to change language.
                        </Text>
                    </View>
                )}

                {messages.map((m) => {
                    const isRight = m.speaker === 0;
                    const isCenter = viewMode === 'three_way' && m.speaker === 1;
                    const isLeft = (viewMode === 'two_way' && m.speaker === 1) ||
                        (viewMode === 'three_way' && m.speaker === 2);

                    return (
                        <ChatBubble
                            key={m.id}
                            msg={m}
                            alignment={isRight ? 'right' : isCenter ? 'center' : 'left'}
                            tts={tts}
                            openDictionary={openDictionary}
                            isDarkMode={isDarkMode}
                            onRetranslate={handleAutoRetranslate}
                            isSyncShimmering={isSyncShimmering}
                        />
                    );
                })}
            </ScrollView>

            {/* Tone Selector (Phase 5.1) */}
            {toneBarVisible && (
                <BlurView
                    intensity={60}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={styles.toneBarFloat}
                >
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toneScroll}>
                        {['Formal', 'Kanto/Street', 'Taglish/Urban', 'Respectful', 'Direct'].map(t => (
                            <TouchableOpacity
                                key={t}
                                style={[styles.tonePill, activeTone === t.toLowerCase() && styles.tonePillActive]}
                                onPress={() => {
                                    setActiveTone(t.toLowerCase());
                                    setIsCustomMode(false);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setToneBarVisible(false);
                                }}
                            >
                                <Text style={[styles.toneText, activeTone === t.toLowerCase() && styles.toneTextActive]}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[styles.tonePill, isCustomMode && styles.tonePillActive]}
                            onPress={() => setIsCustomMode(true)}
                        >
                            <Sliders size={14} color={isCustomMode ? '#FFF' : (isDarkMode ? '#F8FAFC' : '#1E293B')} />
                            <Text style={[styles.toneText, isCustomMode && styles.toneTextActive]}>Custom</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {isCustomMode && (
                        <View style={styles.customToneRow}>
                            <TextInput
                                style={[styles.customToneInput, isDarkMode && styles.customToneInputDark]}
                                placeholder="Enter tone..."
                                placeholderTextColor={isDarkMode ? '#94A3B8' : '#64748B'}
                                value={customToneInput}
                                onChangeText={setCustomToneInput}
                                onSubmitEditing={() => {
                                    if (customToneInput.trim().length < 2) {
                                        setSnackbarMessage('Please enter a clear tone (e.g. "Sarcastic")');
                                        setSnackbarVisible(true);
                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                        return;
                                    }
                                    setActiveTone(customToneInput.trim());
                                    setIsCustomMode(false);
                                    setToneBarVisible(false);
                                }}
                            />
                        </View>
                    )}
                </BlurView>
            )}

            {/* Input Bar */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
            >
                <BlurView
                    intensity={40}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[styles.inputBar, isDarkMode && styles.inputBarDark]}
                >
                    <TouchableOpacity
                        style={styles.toneTrigger}
                        onPress={() => setToneBarVisible(!toneBarVisible)}
                    >
                        <Sliders size={20} color={toneBarVisible ? '#8D5524' : (isDarkMode ? '#F8FAFC' : '#1E293B')} />
                    </TouchableOpacity>

                    <View style={[styles.speakerDot, { backgroundColor: getColorForLang(getActiveLang()).light, marginLeft: 16 }]} />

                    <TouchableOpacity
                        style={[styles.micBtn, {
                            backgroundColor: (speech.isListening || speech.isProcessing)
                                ? '#EF4444'
                                : getColorForLang(getActiveLang()).light
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
                                <MicOff size={20} color="#FFF" />
                            ) : speech.isProcessing ? (
                                <ActivityIndicator size={16} color="#FFF" />
                            ) : (
                                <Mic size={20} color="#FFF" />
                            )}
                        </Animated.View>
                    </TouchableOpacity>

                    <TextInput
                        style={[styles.textInput, isDarkMode && styles.textInputDark]}
                        placeholder={
                            speech.isListening ? 'Listening...'
                                : speech.isProcessing ? 'Transcribing...'
                                    : (LANGUAGE_PLACEHOLDERS[getActiveLang()] || 'Type a message...')
                        }
                        placeholderTextColor={
                            (speech.isListening || speech.isProcessing)
                                ? '#EF4444'
                                : (isDarkMode ? '#64748B' : '#94A3B8')
                        }
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={handleSendMessage}
                    />

                    {loading ? (
                        <ActivityIndicator color={isDarkMode ? '#60A5FA' : '#3B82F6'} style={{ marginRight: 10 }} />
                    ) : (
                        <TouchableOpacity
                            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.3 }]}
                            onPress={handleSendMessage}
                            disabled={!inputText.trim()}
                        >
                            <Send size={18} color={isDarkMode ? '#60A5FA' : '#3B82F6'} />
                        </TouchableOpacity>
                    )}
                </BlurView>
            </KeyboardAvoidingView>

            <BottomNav />

            <LanguagePicker
                visible={pickerFor !== null}
                onDismiss={() => setPickerFor(null)}
                onSelect={(code) => {
                    if (pickerFor !== null) setLang(pickerFor, code);
                    setPickerFor(null);
                }}
                selected={pickerFor !== null ? getLang(pickerFor) : 'tl'}
            />

            <WordCardModal
                visible={dictVisible}
                onDismiss={() => setDictVisible(false)}
                word={dictWord}
                sourceLang={dictSourceLang}
                targetLang={dictTargetLang}
            />

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

            {/* Confirmation Modal (Phase 8.1) */}
            <Portal>
                <PaperModal
                    visible={confirmModal.visible}
                    onDismiss={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
                    contentContainerStyle={styles.glassModalContainer}
                >
                    <BlurView
                        intensity={60}
                        tint={isDarkMode ? 'dark' : 'light'}
                        style={styles.glassModalBlur}
                    >
                        <Text style={[styles.modalTitle, isDarkMode && { color: '#F8FAFC' }]}>{confirmModal.title}</Text>
                        <Text style={[styles.modalMessage, isDarkMode && { color: '#CBD5E1' }]}>{confirmModal.message}</Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
                                style={styles.modalBtnCancel}
                            >
                                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    confirmModal.onConfirm();
                                    setConfirmModal(prev => ({ ...prev, visible: false }));
                                }}
                                style={[
                                    styles.modalBtnAction,
                                    confirmModal.isDestructive && { backgroundColor: '#EF4444' }
                                ]}
                            >
                                <Text style={styles.modalBtnTextAction}>{confirmModal.confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    </BlurView>
                </PaperModal>
            </Portal>

            {/* Snackbar */}
            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={3000}
                style={styles.snackbar}
            >
                {snackbarMessage}
            </Snackbar>
        </View>
    );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    containerDark: { backgroundColor: '#0F172A' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

    // ── Header (Standard mode) ──
    headerArea: {
        paddingTop: 90,
        paddingHorizontal: 20,
    },

    toggleRow: {
        ...liquidGlass,
        flexDirection: 'row',
        borderRadius: 30,
        padding: 4,
        marginBottom: 14,
    },
    toggleRowDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.55)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
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

    speakerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    speakerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1.5,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderColor: 'rgba(255,255,255,0.3)',
    },
    langDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    speakerChipText: {
        fontSize: 12,
        fontWeight: '700',
        marginRight: 3,
    },
    clearBtn: {
        marginLeft: 'auto',
        padding: 6,
    },

    // ── Chat (Standard mode) ──
    chatArea: { flex: 1 },
    chatContent: { padding: 16, paddingBottom: 160 },

    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#94A3B8', marginTop: 14 },
    emptySubtext: { fontSize: 13, color: '#CBD5E1', textAlign: 'center', maxWidth: 260, marginTop: 6 },

    // ── Shared bubble styles ──
    msgRow: { marginBottom: 10, maxWidth: '85%' },
    msgLeft: { alignSelf: 'flex-start' },
    msgCenter: { alignSelf: 'center' },
    msgRight: { alignSelf: 'flex-end' },

    bubble: {
        padding: 14,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    bubbleSpeakerLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.6)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
    },
    bubbleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    bubbleTextContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    inlineTTS: {
        padding: 4,
        marginTop: 2,
        opacity: 0.8,
    },
    inlineActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bubbleText: {
        fontSize: 15,
        lineHeight: 21,
        fontWeight: '600',
    },
    bubbleDivider: {
        height: 1,
        marginVertical: 8,
    },
    transRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 3,
    },
    transLangDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    transLangLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.6)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    transText: {
        fontSize: 13,
        fontStyle: 'italic',
        lineHeight: 19,
    },
    bubbleFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 6,
        gap: 10,
    },
    footerIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        padding: 2,
    },
    ttsLangDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    bubbleToneLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
    },
    bubbleUtilityRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.2)',
    },
    utilityBtn: {
        padding: 4,
        opacity: 0.8,
    },
    bubbleMenu: {
        position: 'absolute',
        width: 140,
        borderRadius: 16,
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 10,
        zIndex: 1000,
    },
    bubbleMenuDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        gap: 10,
        borderRadius: 12,
    },
    menuText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1E293B',
    },
    moreBtn: {
        padding: 4,
    },

    // ── Input Bar (Standard mode) ──
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 32,
        marginBottom: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        overflow: 'hidden',
    },
    inputBarDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    speakerDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 6,
    },
    micBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
    },
    textInput: {
        flex: 1,
        fontSize: 15,
        color: '#1E293B',
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: 20,
    },
    textInputDark: {
        color: '#F8FAFC',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    sendBtn: { padding: 10 },

    // ── Face-to-Face styles ──
    f2fSection: {
        flex: 1,
        paddingHorizontal: 12,
        paddingTop: Platform.OS === 'ios' ? 20 : 12,
        paddingBottom: 4,
        justifyContent: 'center',
    },
    f2fLangChip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        marginBottom: 6,
    },
    f2fLangText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFF',
        marginRight: 4,
    },
    f2fChat: {
        flex: 1,
    },
    f2fChatContent: {
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    f2fEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 30,
    },
    f2fEmptyText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 8,
    },
    f2fMicRow: {
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    f2fMicBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    f2fListeningLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#EF4444',
        marginBottom: 4,
    },
    f2fDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        gap: 6,
    },
    f2fDividerDark: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    f2fDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(148,163,184,0.3)',
    },
    f2fSwapBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    f2fSpineBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },

    // ── Custom Header (Standard mode, since Stack header is hidden) ──
    customHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'absolute',
        top: Platform.OS === 'ios' ? 54 : 34,
        left: 16,
        right: 16,
        zIndex: 10,
    },
    customHeaderBtn: {},
    customHeaderGlass: {
        ...liquidGlass,
        padding: 8,
        borderRadius: 12,
        overflow: 'hidden',
    },
    customHeaderGlassDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.55)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    headerModeBranding: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },

    // ── Phase 5 Tone Selector ──
    toneTrigger: {
        padding: 6,
        marginRight: 4,
    },
    toneBarFloat: {
        position: 'absolute',
        bottom: 165,
        left: 20,
        right: 20,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        padding: 10,
        zIndex: 50,
    },
    toneScroll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingRight: 10,
    },
    tonePill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tonePillActive: {
        backgroundColor: '#8D5524',
        borderColor: '#8D5524',
    },
    toneText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1E293B',
    },
    toneTextActive: {
        color: '#FFF',
    },
    customToneRow: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.2)',
    },
    customToneInput: {
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: '#1E293B',
    },
    customToneInputDark: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        color: '#F8FAFC',
    },

    // ── Phase 8 Glass Modals ──
    glassModalContainer: {
        margin: 20,
        borderRadius: 28,
        overflow: 'hidden',
    },
    glassModalBlur: {
        padding: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 14,
        lineHeight: 20,
        color: '#64748B',
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    modalBtnCancel: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    modalBtnAction: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#1E293B',
    },
    modalBtnTextCancel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    modalBtnTextAction: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFF',
    },
    snackbar: {
        borderRadius: 12,
        backgroundColor: '#334155',
    },
});

