import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
    Keyboard,
    Platform,
    TouchableOpacity,
    TextInput,
    Alert,
    Dimensions,
    Animated,
    LayoutAnimation,
    UIManager,
    StatusBar,
    BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBlur as BlurView } from '../src/components/GlassBlur';
import FluidAura from '../src/components/FluidAura';
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
    AlignJustify,
    Sliders,
    SlidersHorizontal,
    Lock,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Snackbar, Portal, Modal as PaperModal } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import {
    createConversation,
    sendMessage as apiSendMessage,
    translateSingle,
    refineTranslation,
    validateCustomTone,
} from '../src/lib/api';
import {
    SUPPORTED_LANGUAGES,
    LANGUAGE_PLACEHOLDERS,
    LANGUAGE_COLORS,
    liquidGlass,
    TONE_OPTIONS,
    TONE_LABELS,
    TONE_COLORS,
} from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import { useSpeechRecognition } from '../src/hooks/useSpeechRecognition';
import { useTextToSpeech } from '../src/hooks/useTextToSpeech';
import { computeSmartSwap } from '../src/hooks/useLanguageSelection';
import TappableWord from '../src/components/TappableWord';
import WordCardModal from '../src/components/WordCardModal';
import SentenceBreakdownSheet from '../src/components/SentenceBreakdownSheet';
import { useConversation, Message, Translation } from '../src/context/ConversationContext';
import { getDeviceId } from '../src/utils/device';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Unique message ID generator — uses crypto.randomUUID() (RN 0.73+) with UUID v4 fallback
const generateMsgId = (): string => {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};

const FALLBACK_COLOR = { bg: 'rgba(148,163,184,0.42)', text: '#0F172A', trans: 'rgba(0,0,0,0.58)', light: '#64748B' };
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
    onShowToast,
    currentMode,
}: {
    msg: Message;
    alignment: 'left' | 'right' | 'center';
    tts: { speak: (text: string, lang: string) => void };
    openDictionary: (text: string, src: string, tgt: string) => void;
    isDarkMode: boolean;
    onRetranslate?: (msgId: string, newTone: string) => void;
    isSyncShimmering?: boolean;
    currentMode?: string;
    onShowToast?: (msg: string) => void;
}) {
    const langColor = getColorForLang(msg.lang);
    // Dark-mode-aware color overrides — base colors are designed for light backgrounds
    const textColor    = isDarkMode ? '#F1F5F9'                  : langColor.text;
    const transColor   = isDarkMode ? 'rgba(255,255,255,0.82)'   : langColor.trans;
    const labelColor   = isDarkMode ? 'rgba(255,255,255,0.55)'   : 'rgba(0,0,0,0.45)';
    const iconColor    = isDarkMode ? '#60A5FA'                  : '#3B82F6';
    const dividerColor = isDarkMode ? 'rgba(255,255,255,0.12)'   : 'rgba(0,0,0,0.1)';
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    const [toneMenuVisible, setToneMenuVisible] = useState(false);
    const [toneMenuAnchor, setToneMenuAnchor] = useState({ x: 0, y: 0 });
    const [showToneTooltip, setShowToneTooltip] = useState(false);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customToneInput, setCustomToneInput] = useState('');
    const [customToneLoading, setCustomToneLoading] = useState(false);
    const [customToneError, setCustomToneError] = useState('');
    const [kbHeight, setKbHeight] = useState(0);
    const menuTopAnim = useRef(new Animated.Value(0)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;

    const showShimmer = isSyncShimmering;

    useEffect(() => {
        if (showShimmer) {
            const anim = Animated.loop(
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                })
            );
            anim.start();
            return () => anim.stop();
        } else {
            shimmerAnim.setValue(0);
        }
    }, [showShimmer]);

    useEffect(() => {
        const { height: screenH } = Dimensions.get('window');
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const show = Keyboard.addListener(showEvent, e => {
            const kbH = e.endCoordinates.height;
            setKbHeight(kbH);
            // Slide popup up to sit above the keyboard
            Animated.timing(menuTopAnim, {
                toValue: Math.max(8, screenH - kbH - 320),
                duration: e.duration || 250,
                useNativeDriver: false,
            }).start();
        });
        const hide = Keyboard.addListener(hideEvent, e => {
            setKbHeight(0);
            // Restore to original tap position
            Animated.timing(menuTopAnim, {
                toValue: toneMenuAnchor.y,
                duration: e.duration || 200,
                useNativeDriver: false,
            }).start();
        });
        return () => { show.remove(); hide.remove(); };
    }, [toneMenuAnchor.y]);

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    const openToneMenu = (event: any) => {
        const { pageX, pageY } = event.nativeEvent;
        const MENU_WIDTH = 240;
        const MARGIN = 16;
        const { width: screenW, height: screenH } = Dimensions.get('window');
        const popupX = Math.max(MARGIN, Math.min(screenW - MENU_WIDTH - MARGIN, pageX - MENU_WIDTH / 2));
        const popupY = pageY + 10;
        // If keyboard is already visible, open above it immediately
        const initialTop = kbHeight > 0 ? Math.max(8, screenH - kbHeight - 290) : popupY;
        menuTopAnim.setValue(initialTop);
        setToneMenuAnchor({ x: popupX, y: popupY });
        setShowCustomInput(false);
        setCustomToneInput('');
        setCustomToneError('');
        setToneMenuVisible(true);
    };

    const triggerShake = () => {
        shakeAnim.setValue(0);
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
    };

    const handleToneSelect = (tone: string) => {
        if (tone === 'custom') {
            setShowCustomInput(true);
            setCustomToneInput('');
            return;
        }
        setToneMenuVisible(false);
        onRetranslate?.(msg.id, tone);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handleCustomToneSubmit = async () => {
        const trimmed = customToneInput.trim();
        if (!trimmed) { triggerShake(); return; }
        setCustomToneLoading(true);
        setCustomToneError('');
        try {
            const res = await validateCustomTone(trimmed);
            if (res.valid) {
                setShowCustomInput(false);
                setToneMenuVisible(false);
                setCustomToneError('');
                onRetranslate?.(msg.id, trimmed);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } else {
                triggerShake();
                setCustomToneError(`"${trimmed}" is not a recognized tone. Try something like 'Poetic', 'Formal', or 'Urgent'.`);
            }
        } catch {
            triggerShake();
            setCustomToneError("Couldn't validate tone. Check your connection and try again.");
        } finally {
            setCustomToneLoading(false);
        }
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
                    <Text style={[styles.bubbleSpeakerLabel, { color: labelColor }]}>
                        {SUPPORTED_LANGUAGES[msg.lang]}
                    </Text>
                    {msg.tone && (
                        <View style={[styles.toneBadge, { backgroundColor: TONE_COLORS[msg.tone] || '#64748B' }]}>
                            <Text style={styles.toneBadgeText}>
                                {TONE_LABELS[msg.tone]?.name || msg.tone}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.bubbleTextContainer}>
                    <Text style={[styles.bubbleText, { color: textColor, flex: 1 }]}>
                        {msg.text}
                    </Text>
                </View>

                <View style={styles.bubbleUtilityRow}>
                    <TouchableOpacity
                        onPress={() => tts.speak(msg.text, msg.lang)}
                        style={styles.utilityBtn}
                    >
                        <Volume2 size={16} color={iconColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => openDictionary(msg.text, msg.lang, msg.translations[0]?.lang || 'en')}
                        style={styles.utilityBtn}
                    >
                        <BookOpen size={16} color={iconColor} />
                    </TouchableOpacity>
                    {onRetranslate && (
                        <TouchableOpacity
                            onPress={openToneMenu}
                            onLongPress={() => {
                                setShowToneTooltip(true);
                                setTimeout(() => setShowToneTooltip(false), 1500);
                            }}
                            style={styles.utilityBtn}
                        >
                            <SlidersHorizontal size={14} color={iconColor} />
                            {showToneTooltip && (
                                <View style={styles.toneTooltip}>
                                    <Text style={styles.toneTooltipText}>Tone</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* In non-3-way modes, only show the first translation — 3rd-participant row is hidden, not deleted */}
                {(currentMode === 'three_way' ? msg.translations : msg.translations.slice(0, 1)).map((tr, idx) => {
                    // Hide translation row while retrying (shimmer covers it) or if permanently empty
                    if (!tr.text || tr.text === '(Try again)') return null;
                    const trColor = getColorForLang(tr.lang);
                    return (
                        <View key={idx}>
                            <View style={[styles.bubbleDivider, { backgroundColor: dividerColor }]} />
                            <View style={[styles.transRow, idx === 0 && { marginTop: 8 }]}>
                                <View style={[styles.transLangDot, { backgroundColor: trColor.light }]} />
                                <Text style={[styles.transLangLabel, { color: labelColor }]}>
                                    {SUPPORTED_LANGUAGES[tr.lang]}
                                </Text>
                            </View>
                            <Text style={[styles.transText, { color: transColor }]}>
                                {tr.text}
                            </Text>
                            <View style={[styles.bubbleUtilityRow, { marginTop: 4 }]}>
                                <TouchableOpacity
                                    onPress={() => tts.speak(tr.text, tr.lang)}
                                    style={styles.utilityBtn}
                                >
                                    <Volume2 size={16} color={iconColor} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => openDictionary(tr.text, tr.lang, msg.lang)}
                                    style={styles.utilityBtn}
                                >
                                    <BookOpen size={16} color={iconColor} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </View>

            <Portal>
                {toneMenuVisible && (
                    <>
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            onPress={() => { setToneMenuVisible(false); setShowCustomInput(false); setCustomToneInput(''); setCustomToneError(''); }}
                        />
                        {/* Animated.View drives smooth position above the keyboard */}
                        <Animated.View
                            style={[
                                styles.toneMenuScroll,
                                { top: menuTopAnim, left: toneMenuAnchor.x },
                                isDarkMode && styles.bubbleMenuDark,
                            ]}
                        >
                            <BlurView
                                intensity={50}
                                tint={isDarkMode ? 'dark' : 'light'}
                                style={{ borderRadius: 14, overflow: 'hidden' }}
                            >
                                <ScrollView style={{ maxHeight: kbHeight > 0 ? 220 : 400 }}>
                                    {TONE_OPTIONS.map(tone => (
                                        <TouchableOpacity
                                            key={tone}
                                            style={styles.menuItem}
                                            onPress={() => handleToneSelect(tone)}
                                        >
                                            <View style={[styles.toneMenuDot, { backgroundColor: TONE_COLORS[tone] }]} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.menuText, isDarkMode && { color: '#F8FAFC' }]}>
                                                    {TONE_LABELS[tone].name}
                                                </Text>
                                                <Text style={[styles.toneMenuDesc, isDarkMode && { color: '#94A3B8' }]}>
                                                    {TONE_LABELS[tone].description}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                    {showCustomInput && (
                                        <View style={[styles.customToneRow, { paddingHorizontal: 10, paddingBottom: 8 }]}>
                                            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                                                <TextInput
                                                    style={[styles.customToneInput, isDarkMode && styles.customToneInputDark]}
                                                    placeholder="e.g. straightforward, excited..."
                                                    placeholderTextColor="#94A3B8"
                                                    value={customToneInput}
                                                    onChangeText={(v) => { setCustomToneInput(v); setCustomToneError(''); }}
                                                    autoFocus
                                                    onSubmitEditing={handleCustomToneSubmit}
                                                    returnKeyType="done"
                                                />
                                            </Animated.View>
                                            {customToneError ? (
                                                <Text style={{ color: '#EF4444', fontSize: 11, paddingHorizontal: 4, paddingTop: 2, paddingBottom: 4 }}>
                                                    {customToneError}
                                                </Text>
                                            ) : null}
                                            <TouchableOpacity
                                                style={[styles.menuItem, { justifyContent: 'center', opacity: customToneLoading ? 0.5 : 1 }]}
                                                onPress={handleCustomToneSubmit}
                                                disabled={customToneLoading}
                                            >
                                                <Text style={[styles.menuText, { color: '#3B82F6' }]}>
                                                    {customToneLoading ? 'Validating...' : 'Apply Custom Tone'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </ScrollView>
                            </BlurView>
                        </Animated.View>
                    </>
                )}
            </Portal>
        </View>
    );
}

// Memoize ChatBubble so re-renders triggered by typing (setInputText) don't
// re-render all existing bubbles. Only re-render when the message data,
// alignment, theme, or shimmer state actually changes.
const MemoizedChatBubble = React.memo(ChatBubble, (prev, next) =>
    prev.msg === next.msg &&
    prev.alignment === next.alignment &&
    prev.isDarkMode === next.isDarkMode &&
    prev.isSyncShimmering === next.isSyncShimmering &&
    prev.currentMode === next.currentMode
);

// ─────────────────────────────────────────
// Module-level utilities
// ─────────────────────────────────────────

/** Retry a promise-returning fn up to maxAttempts times, waiting delayMs between each. */
async function retryFn<T>(fn: () => Promise<T>, maxAttempts = 3, delayMs = 1500): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < maxAttempts; i++) {
        try { return await fn(); } catch (e) { lastErr = e; }
        if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, delayMs));
    }
    throw lastErr;
}

function sanitizeTranslation(text: string): string {
    if (!text) return '';
    if (text.includes('{') || text.includes('}') || text.includes(':')) {
        try {
            const parsed = JSON.parse(text);
            if (parsed.t) return parsed.t;
            return '';
        } catch {
            return '';
        }
    }
    return text;
}

// ─────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────
export default function ConversationScreen() {
    const { isDarkMode } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
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
        hasSpoken,
        markHasSpoken,
        resetUser3Spoken,
    } = useConversation();

    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // Concurrent-send guard — prevents double-send when onSubmitEditing + onPress both fire
    const isSendingRef = useRef(false);

    // Duplicate-message guard — prevents the same message ID from being added twice
    const addedMessageIds = useRef(new Set<string>());
    const addMessageToState = useCallback((newMessage: Message) => {
        if (addedMessageIds.current.has(newMessage.id)) {
            console.warn('Prevented duplicate message add:', newMessage.id);
            return;
        }
        addedMessageIds.current.add(newMessage.id);
        setMessages(prev => [...prev, newMessage]);
    }, [setMessages]);
    const tts = useTextToSpeech();
    const deviceIdRef = useRef<string | undefined>(undefined);
    const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
    useEffect(() => {
        getDeviceId().then(id => {
            deviceIdRef.current = id;
            setDeviceId(id);
        });
    }, []);

    // Snackbar / Toast state
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const [isSyncShimmering, setIsSyncShimmering] = useState(false);

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
            const sourceText = msg.originalText || msg.text;
            const res = await refineTranslation(sourceText, msg.lang, targets, newTone);

            setMessages(prev => prev.map(m => {
                if (m.id === msgId) {
                    return {
                        ...m,
                        text: res.refined_text,
                        tone: newTone,
                        isNewMessage: false, // Retranslated messages should not auto-TTS
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
            setSnackbarMessage('Translation failed. Retrying…');
            setSnackbarVisible(true);
        } finally {
            setTimeout(() => setIsSyncShimmering(false), 800);
        }
    };

    /**
     * Retries translation in the background after a send failure.
     * Shows shimmer (isRegenerating) until translation succeeds or attempts are exhausted.
     */
    const retryTranslationsAsync = useCallback(async (
        msgId: string,
        text: string,
        fromLang: string,
        targetLangs: string[],
        tone: string | null,
    ) => {
        const MAX_ATTEMPTS = 20;
        const DELAY = 2000;
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await new Promise(r => setTimeout(r, DELAY));
            const translations: Translation[] = [];
            let allOk = true;
            for (const tl of targetLangs) {
                try {
                    const res = await translateSingle(text, fromLang, tl, tone || undefined, undefined, true);
                    const translated = sanitizeTranslation(res.output_text) || '';
                    if (!translated) { allOk = false; break; }
                    translations.push({ text: translated, lang: tl });
                } catch {
                    allOk = false;
                    break;
                }
            }
            if (allOk && translations.length === targetLangs.length) {
                setMessages(prev => prev.map(m =>
                    m.id === msgId
                        ? { ...m, translations, isRegenerating: false, isNewMessage: false }
                        : m
                ));
                return;
            }
        }
        // All attempts exhausted — stop shimmer, leave translations empty (hidden in bubble)
        setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, isRegenerating: false } : m
        ));
    }, [setMessages]);

    const lang0 = langs[0];
    const lang1 = langs[1];
    const lang2 = langs[2];

    const [pickerFor, setPickerFor] = useState<number | null>(null);

    // Track language state at last full regeneration (for smart regen on send)
    const lastRegenLangsRef = useRef<{ 0: string; 1: string; 2: string } | null>(null);
    const lastRegenModeRef = useRef<'two_way' | 'three_way' | 'face_to_face' | null>(null);

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

    // Batch 5 Prompt 3: session-gated auto TTS
    const sessionId = useRef<string | null>(null);
    const prevModeRef = useRef(viewMode);

    useFocusEffect(
        useCallback(() => {
            // New session when screen is focused
            sessionId.current = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            return () => {
                // Clear session when screen loses focus — stop any ongoing TTS
                tts.stop();
                sessionId.current = null;
            };
        }, [])
    );

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
        // Only auto-TTS if this is a NEW message in the CURRENT session
        if (!latest.isNewMessage) return;
        if (!latest.sessionId || latest.sessionId !== sessionId.current) return;
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

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const onShow = Keyboard.addListener(showEvent, e => {
            setKeyboardHeight(e.endCoordinates.height);
            scrollRef.current?.scrollToEnd({ animated: true });
        });
        const onHide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
        return () => { onShow.remove(); onHide.remove(); };
    }, []);

    // Android hardware back button: dismiss modals/pickers first, then go back
    useEffect(() => {
        const onBack = () => {
            if (confirmModal.visible) {
                setConfirmModal(prev => ({ ...prev, visible: false }));
                return true;
            }
            if (pickerFor !== null) {
                setPickerFor(null);
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
            // Dismiss keyboard first if it's open
            if (keyboardHeight > 0) {
                Keyboard.dismiss();
                return true;
            }
            // Navigate back
            router.back();
            return true;
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
        return () => sub.remove();
    }, [confirmModal.visible, pickerFor, dictVisible, breakdownVisible, keyboardHeight, router]);

    // Create backend conversation session — waits for deviceId to be loaded
    useEffect(() => {
        // Only create new session if none exists and deviceId is ready
        if (conversationId || !deviceId) return;

        const speakerCount = viewMode === 'three_way' ? 3 : 2;
        const backendMode = viewMode === 'three_way' ? 'three_way' : 'two_way';
        const participants = [
            { speaker_label: 'A', preferred_language: lang0 },
            { speaker_label: 'B', preferred_language: lang1 },
        ];
        if (speakerCount === 3) {
            participants.push({ speaker_label: 'C', preferred_language: lang2 });
        }
        createConversation(backendMode, participants, viewMode, deviceId)
            .then(res => setConversationId(res.conversation_id))
            .catch(() => setConversationId(null));
    }, [viewMode, deviceId]);

    const handleViewModeChange = (mode: 'two_way' | 'three_way' | 'face_to_face') => {
        // Invalidate session immediately (synchronously) so existing bubbles
        // don't trigger auto-TTS when the mode-change effects fire
        sessionId.current = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        tts.stop();

        // Clear input field and reset all speech transcripts to prevent
        // stale transcript from triggering auto-send on mode switch
        setInputText('');
        speech.resetTranscript();
        speechBottom.resetTranscript();
        speechTop.resetTranscript();

        // Stop any active listening sessions
        if (speech.isListening) speech.stopListening();
        if (speechBottom.isListening) speechBottom.stopListening();
        if (speechTop.isListening) speechTop.stopListening();

        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        // 3-way → 2-way: do NOT delete translations — ChatBubble hides the 3rd row via currentMode prop
        // Sync lastRegenLangsRef so a lang2 change made during 3-way doesn't spuriously fire
        // a regen on the first 2-way send (lang2 is irrelevant in 2-way).
        if (mode === 'two_way' && viewMode === 'three_way') {
            lastRegenLangsRef.current = { 0: lang0, 1: lang1, 2: lang2 };
            lastRegenModeRef.current = 'two_way';
        }
        // face_to_face ↔ 3-way: messages are fully retained — ChatBubble hides 3rd row in non-3-way mode
        // Reset user3 hasSpoken when switching away from 3-way
        if (viewMode === 'three_way' && mode !== 'three_way') {
            resetUser3Spoken();
        }
        setViewMode(mode);
    };

    // Batch 5 Prompt 3: regenerate sessionId on mode switch so old bubbles don't re-play
    // Retroactive 3rd language is now deferred: triggered on next send via regenerateAllBubbles
    useEffect(() => {
        prevModeRef.current = viewMode;
        // Regenerate session so existing bubbles don't auto-TTS after mode switch
        sessionId.current = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }, [viewMode]);

    // Recompute expected target languages for a given speaker in a given mode/langs config
    const getExpectedTargets = (
        speakerIndex: number,
        currentLangs: { 0: string; 1: string; 2: string },
        currentMode: 'two_way' | 'three_way' | 'face_to_face',
    ): string[] => {
        const activeSpeakers = currentMode === 'three_way' ? [0, 1, 2] : [0, 1];
        const targets = activeSpeakers
            .filter(i => i !== speakerIndex)
            .map(i => currentLangs[i as 0 | 1 | 2]);
        // Deduplicate
        return targets.filter((l, idx, arr) => arr.indexOf(l) === idx);
    };

    // Regenerate all existing bubbles to match currentLangs/currentMode
    // Removes stale translations, adds missing ones via API
    const regenerateAllBubbles = async (
        currentLangs: { 0: string; 1: string; 2: string },
        currentMode: 'two_way' | 'three_way' | 'face_to_face',
        snapshotMsgs: Message[],
    ) => {
        const devId = deviceIdRef.current;
        // Mark all non-F2F bubbles as regenerating
        setMessages(prev => prev.map(m =>
            m.mode === 'face_to_face' ? m : { ...m, isRegenerating: true }
        ));
        const updates = snapshotMsgs.map(async (bubble) => {
            if (bubble.mode === 'face_to_face') return bubble;
            const expectedTargets = getExpectedTargets(bubble.speaker, currentLangs, currentMode);
            const existingLangs = bubble.translations.map(t => t.lang);
            const toRemove = existingLangs.filter(l => !expectedTargets.includes(l));
            const toAdd = expectedTargets.filter(l => !existingLangs.includes(l));
            if (toRemove.length === 0 && toAdd.length === 0) {
                return { ...bubble, isRegenerating: false };
            }
            let updatedTranslations = bubble.translations.filter(t => !toRemove.includes(t.lang));
            for (const targetLang of toAdd) {
                try {
                    const res = await retryFn(() => translateSingle(
                        bubble.originalText || bubble.text,
                        bubble.lang,
                        targetLang,
                        bubble.tone,
                        devId,
                        true, // skip_history — retranslation must not create text history entries
                    ));
                    updatedTranslations.push({ lang: targetLang, text: sanitizeTranslation(res.output_text) });
                } catch {
                    updatedTranslations.push({ lang: targetLang, text: '' });
                }
            }
            return { ...bubble, translations: updatedTranslations, isRegenerating: false };
        });
        const updatedBubbles = await Promise.all(updates);
        setMessages(updatedBubbles);
    };

    const getLang = (speaker: number) => {
        if (speaker === 0) return lang0;
        if (speaker === 1) return lang1;
        return lang2;
    };

    const setLang = (speaker: number, code: string) => {
        const current = [lang0, lang1, lang2];
        const count: 2 | 3 = viewMode === 'three_way' ? 3 : 2;
        const next = computeSmartSwap(current, speaker, code, count);
        // Lock guard: if any speaker whose language would change has already spoken, block the swap
        for (let i = 0; i < count; i++) {
            if (next[i] !== current[i] && hasSpoken[i as 0 | 1 | 2]) {
                const lockedLang = SUPPORTED_LANGUAGES[current[i]] || current[i];
                setSnackbarMessage(`Cannot change — ${lockedLang} is already locked in conversation.`);
                setSnackbarVisible(true);
                return;
            }
        }
        next.forEach((c, i) => { if (c !== current[i]) setLangs(i, c); });
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
        if (isSendingRef.current) return;
        isSendingRef.current = true;
        setInputText(''); // clear immediately so a second tap sees an empty field

        // Smart bubble regeneration rules:
        //  1. Mode switch alone → NEVER regenerate (3-way messages stay as-is until Speaker C speaks)
        //  2. lang0/lang1 change → regenerate (their speakers are locked once they speak)
        //  3. lang2 change alone → skip; wait for Speaker C's first message
        //  4. Speaker C sends their FIRST message → retroactively add 3rd-lang to all existing bubbles
        const currentLangs = { 0: lang0, 1: lang1, 2: lang2 };
        const currentMode = viewMode;
        const snapshotMsgs = messages; // capture before any state update
        if (snapshotMsgs.length > 0) {
            const prev = lastRegenLangsRef.current;
            const activeLangsChanged = prev !== null && (prev[0] !== currentLangs[0] || prev[1] !== currentLangs[1]);
            const speaker3FirstSend = activeSpeaker === 2 && !hasSpoken[2] && currentMode === 'three_way';
            if (activeLangsChanged || speaker3FirstSend) {
                await regenerateAllBubbles(currentLangs, currentMode, snapshotMsgs);
            }
        }
        // Update regen refs to current state
        lastRegenLangsRef.current = currentLangs;
        lastRegenModeRef.current = currentMode;

        const fromLang = getLang(activeSpeaker);
        const targetLangs = getTargetLangs(activeSpeaker);
        const speakerLabel = ['A', 'B', 'C'][activeSpeaker];

        setLoading(true);
        const capturedTone = activeTone;
        try {
            const translations: Translation[] = [];
            let anyFailed = false;
            if (conversationId) {
                // One API call with all target langs — avoids duplicate DB records for 3-way
                try {
                    const res = await retryFn(() => apiSendMessage(conversationId, speakerLabel, text, fromLang, targetLangs, capturedTone || undefined));
                    if (res.translations && Array.isArray(res.translations) && res.translations.length > 0) {
                        res.translations.forEach((t: { lang: string; text: string }) => {
                            translations.push({ text: sanitizeTranslation(t.text) || '', lang: t.lang });
                        });
                    } else {
                        // Fallback: old single-target response
                        translations.push({ text: sanitizeTranslation(res.translated_text) || '', lang: targetLangs[0] || fromLang });
                    }
                } catch {
                    anyFailed = true;
                    targetLangs.forEach(tl => translations.push({ text: '', lang: tl }));
                }
            } else {
                // No conversation session — translate locally one at a time
                for (const tl of targetLangs) {
                    try {
                        const res = await retryFn(() => translateSingle(text, fromLang, tl, capturedTone || undefined, undefined, true));
                        translations.push({ text: sanitizeTranslation(res.output_text) || '', lang: tl });
                    } catch {
                        anyFailed = true;
                        translations.push({ text: '', lang: tl });
                    }
                }
            }
            const msgId = generateMsgId();
            const msg: Message = {
                id: msgId,
                text,
                originalText: text,
                translations,
                speaker: activeSpeaker,
                lang: fromLang,
                tone: capturedTone || undefined,
                isNewMessage: true,
                mode: viewMode,
                sessionId: sessionId.current,
                isRegenerating: anyFailed,
            };
            addMessageToState(msg);
            markHasSpoken(activeSpeaker as 0 | 1 | 2);
            lastMessageIdRef.current = msgId;
            if (anyFailed) {
                retryTranslationsAsync(msgId, text, fromLang, targetLangs, capturedTone);
            }
        } catch {
            const msgId = generateMsgId();
            const msg: Message = {
                id: msgId,
                text,
                originalText: text,
                translations: targetLangs.map(tl => ({ text: '', lang: tl })),
                speaker: activeSpeaker,
                lang: getLang(activeSpeaker),
                isNewMessage: true,
                mode: viewMode,
                sessionId: sessionId.current,
                isRegenerating: true,
            };
            addMessageToState(msg);
            markHasSpoken(activeSpeaker as 0 | 1 | 2);
            retryTranslationsAsync(msgId, text, getLang(activeSpeaker), targetLangs, capturedTone);
        }
        setLoading(false);
        isSendingRef.current = false;
    };

    // Face-to-Face send
    const handleF2FSend = async (text: string, speaker: number) => {
        if (!text.trim()) return;
        const fromLang = getLang(speaker);
        const targetLang = speaker === 0 ? lang1 : lang0;
        const speakerLabel = speaker === 0 ? 'A' : 'B';
        const capturedTone = activeTone;

        setLoading(true);
        let translatedText = '';
        let failed = false;
        try {
            if (conversationId) {
                const res = await retryFn(() => apiSendMessage(conversationId, speakerLabel, text, fromLang, targetLang, capturedTone || undefined));
                translatedText = sanitizeTranslation(res.translated_text) || '';
            } else {
                const res = await retryFn(() => translateSingle(text, fromLang, targetLang, capturedTone || undefined, undefined, true));
                translatedText = sanitizeTranslation(res.output_text) || '';
            }
        } catch {
            failed = true;
        }
        const msgId = generateMsgId();
        const msg: Message = {
            id: msgId,
            text,
            originalText: text,
            translations: [{ text: translatedText, lang: targetLang }],
            speaker,
            lang: fromLang,
            tone: capturedTone || undefined,
            isNewMessage: true,
            mode: 'face_to_face',
            sessionId: sessionId.current,
            isRegenerating: failed,
        };
        addMessageToState(msg);
        lastMessageIdRef.current = msgId;
        if (failed) {
            retryTranslationsAsync(msgId, text, fromLang, [targetLang], capturedTone);
        }
        setLoading(false);
    };

    // Stable callback for bubble toast — prevents MemoizedChatBubble re-renders on each keystroke
    const showBubbleToast = useCallback((msg: string) => {
        setSnackbarMessage(msg);
        setSnackbarVisible(true);
    }, []);

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
                addedMessageIds.current.clear();
                const backendMode = viewMode === 'three_way' ? 'three_way' : 'two_way';
                const participants = [
                    { speaker_label: 'A', preferred_language: lang0 },
                    { speaker_label: 'B', preferred_language: lang1 },
                ];
                if (viewMode === 'three_way') {
                    participants.push({ speaker_label: 'C', preferred_language: lang2 });
                }
                createConversation(backendMode, participants, viewMode, deviceIdRef.current)
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

    // Deduplicate messages by id before render — safety net for duplicate-key errors
    const uniqueMessages = useMemo(() => {
        const seen = new Set<string>();
        return messages.filter(m => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
        });
    }, [messages]);

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
                <FluidAura isDarkMode={isDarkMode} />

                {/* ═══ TOP SECTION (rotated 180°) — Speaker B ═══ */}
                <View style={[styles.f2fSection, { transform: [{ rotate: '180deg' }], paddingBottom: insets.top + 8 }]}>
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
                                onShowToast={(m) => { setSnackbarMessage(m); setSnackbarVisible(true); }}
                                currentMode="face_to_face"
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
                                onShowToast={(m) => { setSnackbarMessage(m); setSnackbarVisible(true); }}
                                currentMode="face_to_face"
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
                    otherSelectedLanguages={pickerFor === 0 ? [lang1] : [lang0]}
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

                {/* Confirmation Modal */}
                <Portal>
                    <PaperModal
                        visible={confirmModal.visible}
                        onDismiss={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
                        contentContainerStyle={styles.glassModalContainer}
                    >
                        <BlurView
                            intensity={60}
                            tint={isDarkMode ? 'dark' : 'light'}
                            style={[styles.glassModalBlur, isDarkMode && styles.glassModalBlurDark]}
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
            </View>
        );
    }

    // ─────────────────────────────────────────
    // Standard (Two-Way / Three-Way) Render
    // ─────────────────────────────────────────
    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <FluidAura isDarkMode={isDarkMode} />
            {/* Custom Glass Header */}
            <View style={[styles.customHeader, { top: insets.top + 10 }]}>
                <TouchableOpacity
                    onPress={() => router.push('/history' as any)}
                    style={styles.customHeaderBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <BlurView
                        intensity={20}
                        tint={isDarkMode ? 'dark' : 'light'}
                        style={[styles.customHeaderGlass, isDarkMode && styles.customHeaderGlassDark]}
                    >
                        <AlignJustify size={20} color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
                    </BlurView>
                </TouchableOpacity>

                <Text style={[styles.headerModeBranding, isDarkMode && { color: '#F8FAFC' }]}>
                    Chat
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

            <View style={[styles.headerArea, { paddingTop: insets.top + 80 }]}>
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
                                        if (hasSpoken[i as 0 | 1 | 2]) {
                                            setSnackbarMessage('Delete first the conversation.');
                                            setSnackbarVisible(true);
                                        } else {
                                            setPickerFor(i);
                                        }
                                    } else {
                                        setActiveSpeaker(i);
                                    }
                                }}
                            >
                                <View style={[styles.langDot, { backgroundColor: langColor.light }]} />
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.speakerChipText,
                                        { color: isActive ? '#FFF' : (isDarkMode ? '#F8FAFC' : '#1E293B') },
                                        hasSpoken[i as 0 | 1 | 2] && { opacity: 0.6 },
                                    ]}
                                >
                                    {SUPPORTED_LANGUAGES[langCode]}
                                </Text>
                                {hasSpoken[i as 0 | 1 | 2]
                                    ? <Lock size={12} color={isActive ? '#FFF' : (isDarkMode ? '#F8FAFC' : '#1E293B')} />
                                    : <ChevronDown size={12} color={isActive ? '#FFF' : (isDarkMode ? '#F8FAFC' : '#1E293B')} />
                                }
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
                contentContainerStyle={[styles.chatContent, { paddingBottom: 220 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
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

                {uniqueMessages.map((m) => {
                    const isRight = m.speaker === 0;
                    const isCenter = viewMode === 'three_way' && m.speaker === 1;
                    const isLeft = (viewMode === 'two_way' && m.speaker === 1) ||
                        (viewMode === 'three_way' && m.speaker === 2);

                    return (
                        <MemoizedChatBubble
                            key={m.id}
                            msg={m}
                            alignment={isRight ? 'right' : isCenter ? 'center' : 'left'}
                            tts={tts}
                            openDictionary={openDictionary}
                            isDarkMode={isDarkMode}
                            onRetranslate={handleAutoRetranslate}
                            isSyncShimmering={isSyncShimmering || (m.isRegenerating === true)}
                            onShowToast={showBubbleToast}
                            currentMode={viewMode}
                        />
                    );
                })}
            </ScrollView>


            {/* Input Bar */}
            <BlurView
                intensity={40}
                tint={isDarkMode ? 'dark' : 'light'}
                style={[
                    styles.inputBar,
                    isDarkMode && styles.inputBarDark,
                    {
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: keyboardHeight > 0 ? keyboardHeight + 60 : 90 + insets.bottom,
                    },
                ]}
            >
                    <View style={[styles.speakerDot, { backgroundColor: getColorForLang(getActiveLang()).light }]} />

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

            <LanguagePicker
                visible={pickerFor !== null}
                onDismiss={() => setPickerFor(null)}
                onSelect={(code) => {
                    if (pickerFor !== null) setLang(pickerFor, code);
                    setPickerFor(null);
                }}
                selected={pickerFor !== null ? getLang(pickerFor) : 'tl'}
                otherSelectedLanguages={
                    pickerFor === 0
                        ? (viewMode === 'three_way' ? [lang1, lang2] : [lang1])
                        : pickerFor === 1
                        ? (viewMode === 'three_way' ? [lang0, lang2] : [lang0])
                        : [lang0, lang1]
                }
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

            <Portal>
                <PaperModal
                    visible={confirmModal.visible}
                    onDismiss={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
                    contentContainerStyle={styles.glassModalContainer}
                >
                    <BlurView
                        intensity={60}
                        tint={isDarkMode ? 'dark' : 'light'}
                        style={[styles.glassModalBlur, isDarkMode && styles.glassModalBlurDark]}
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
            <BottomNav />
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
        flexDirection: 'row',
        backgroundColor: 'rgba(241,245,249,0.55)',
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
        padding: 4,
        marginBottom: 14,
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

    speakerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    speakerChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1.5,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderColor: 'rgba(255,255,255,0.3)',
        minWidth: 0,
    },
    langDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 4,
        flexShrink: 0,
    },
    speakerChipText: {
        fontSize: 12,
        fontWeight: '700',
        marginRight: 3,
        flexShrink: 1,
    },
    clearBtn: {
        flexShrink: 0,
        padding: 6,
    },

    // ── Chat (Standard mode) ──
    chatArea: { flex: 1 },
    chatContent: { padding: 16 },

    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#94A3B8', marginTop: 14 },
    emptySubtext: { fontSize: 13, color: '#CBD5E1', textAlign: 'center', maxWidth: 260, marginTop: 6 },

    // ── Shared bubble styles ──
    msgRow: { marginBottom: 10, maxWidth: '80%' },
    msgLeft: { alignSelf: 'flex-start' },
    msgCenter: { alignSelf: 'center' },
    msgRight: { alignSelf: 'flex-end' },

    bubble: {
        padding: 14,
        paddingBottom: 20,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
    },
    bubbleSpeakerLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: 'rgba(0,0,0,0.45)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
    },
    bubbleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        flexShrink: 0,
    },
    bubbleTextContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        flexShrink: 0,
    },
    inlineTTS: {
        padding: 4,
        marginTop: 2,
        opacity: 0.8,
    },
    inlineActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
    },
    bubbleText: {
        fontSize: 15,
        lineHeight: 21,
        fontWeight: '600',
        flexShrink: 1,
        flexWrap: 'wrap',
    },
    bubbleDivider: {
        height: 1,
        marginVertical: 8,
        flexShrink: 0,
    },
    transRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 3,
        flexShrink: 0,
    },
    transLangDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    transLangLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(0,0,0,0.45)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    transText: {
        fontSize: 13,
        fontStyle: 'italic',
        lineHeight: 19,
        flexShrink: 1,
        flexWrap: 'wrap',
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
        color: 'rgba(0,0,0,0.5)',
        textTransform: 'uppercase',
    },
    toneBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        marginLeft: 4,
    },
    toneBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#FFF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    bubbleUtilityRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        marginTop: 6,
        paddingTop: 6,
        paddingBottom: 4,
        flexShrink: 0,
        flexWrap: 'wrap',
    },
    utilityBtn: {
        padding: 4,
        opacity: 0.8,
    },
    toneTooltip: {
        position: 'absolute',
        bottom: 22,
        left: '50%',
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        zIndex: 99,
    },
    toneTooltipText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '600',
    },
    bubbleMenuDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    toneMenuScroll: {
        position: 'absolute',
        width: 240,
        borderRadius: 16,
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 10,
        zIndex: 1000,
    },
    toneMenuDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    toneMenuDesc: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
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

    // ── Input Bar (Standard mode) ──
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 32,
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
        top: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24) + 10,
        left: 16,
        right: 16,
        zIndex: 10,
    },
    customHeaderBtn: {},
    customHeaderGlass: {
        padding: 9,
        borderRadius: 50,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.9)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
        overflow: 'hidden',
    },
    customHeaderGlassDark: {
        backgroundColor: '#1E293B',
        borderColor: 'rgba(255,255,255,0.12)',
    },
    headerModeBranding: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },

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

    glassModalContainer: {
        margin: 20,
        borderRadius: 28,
    },
    glassModalBlur: {
        padding: 24,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.97)',
    },
    glassModalBlurDark: {
        backgroundColor: 'rgba(15,23,42,0.97)',
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

