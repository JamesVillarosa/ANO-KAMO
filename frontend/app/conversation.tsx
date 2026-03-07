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
} from 'react-native';
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
} from 'lucide-react-native';
import {
    createConversation,
    sendMessage as apiSendMessage,
    translateSingle,
} from '../src/lib/api';
import {
    gradientColors,
    darkGradientColors,
    SUPPORTED_LANGUAGES,
    LANGUAGE_PLACEHOLDERS,
    LANGUAGE_COLORS,
} from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import { useSpeechRecognition } from '../src/hooks/useSpeechRecognition';
import { useTextToSpeech } from '../src/hooks/useTextToSpeech';
import SelectableWord from '../src/components/SelectableWord';

const { width } = Dimensions.get('window');

interface Translation {
    text: string;
    lang: string;
}

interface Message {
    id: string;
    text: string;               // original text
    translations: Translation[]; // one or two translations
    speaker: number;            // 0, 1, or 2
    lang: string;               // original language
}

const FALLBACK_COLOR = { bg: 'rgba(100,116,139,0.85)', text: '#FFFFFF', trans: '#CBD5E1', light: '#64748B' };
const getColorForLang = (langCode: string) => LANGUAGE_COLORS[langCode] || FALLBACK_COLOR;

export default function ConversationScreen() {
    const { isDarkMode } = useTheme();
    const [mode, setMode] = useState<'2way' | '3way'>('2way');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeSpeaker, setActiveSpeaker] = useState(0);
    const tts = useTextToSpeech();

    // Languages
    const [lang0, setLang0] = useState('tl');
    const [lang1, setLang1] = useState('ceb');
    const [lang2, setLang2] = useState('hil');
    const [pickerFor, setPickerFor] = useState<number | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);

    // Speech Recognition
    const getActiveLang = () => {
        if (activeSpeaker === 0) return lang0;
        if (activeSpeaker === 1) return lang1;
        return lang2;
    };
    const speech = useSpeechRecognition(getActiveLang());
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
        if (liveText && liveText !== 'Listening...' && liveText !== 'Processing...' && liveText !== 'Transcribing...') {
            setInputText(liveText);
        } else if (speech.isListening || speech.isProcessing) {
            setInputText('');
        }
    }, [speech.transcript, speech.interimTranscript]);

    // When transcription completes, auto-send as message (with translation)
    useEffect(() => {
        if (!speech.isListening && !speech.isProcessing && speech.transcript.trim()) {
            const finalText = speech.transcript.trim();
            setInputText(finalText);
            handleAutoSend(finalText);
        }
    }, [speech.isProcessing, speech.transcript]);

    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
    }, [messages]);

    // Create a new backend conversation session when mode changes
    useEffect(() => {
        setMessages([]);
        setActiveSpeaker(0);
        const speakerCount = mode === '3way' ? 3 : 2;
        const participants = [
            { speaker_label: 'A', preferred_language: lang0 },
            { speaker_label: 'B', preferred_language: lang1 },
        ];
        if (speakerCount === 3) {
            participants.push({ speaker_label: 'C', preferred_language: lang2 });
        }
        createConversation(mode === '2way' ? 'two_way' : 'three_way', participants)
            .then(res => setConversationId(res.conversation_id))
            .catch(() => setConversationId(null));
    }, [mode]);

    const getLang = (speaker: number) => {
        if (speaker === 0) return lang0;
        if (speaker === 1) return lang1;
        return lang2;
    };

    const setLang = (speaker: number, code: string) => {
        if (speaker === 0) setLang0(code);
        else if (speaker === 1) setLang1(code);
        else setLang2(code);
    };

    // Get all OTHER speakers' languages (for translation targets)
    const getTargetLangs = (speaker: number): string[] => {
        const allLangs = [lang0, lang1];
        if (mode === '3way') allLangs.push(lang2);

        const srcLang = getLang(speaker);
        // Return unique target languages that differ from source
        const targets = allLangs
            .filter((_, i) => i !== speaker)
            .filter(l => l !== srcLang);

        // Remove duplicates
        return [...new Set(targets.length > 0 ? targets : allLangs.filter((_, i) => i !== speaker))];
    };

    // Auto-send speech transcript with translation
    const handleAutoSend = async (text: string) => {
        if (!text.trim()) return;
        const fromLang = getLang(activeSpeaker);
        const targetLangs = getTargetLangs(activeSpeaker);
        const speakerLabel = ['A', 'B', 'C'][activeSpeaker];

        setLoading(true);
        try {
            const translations: Translation[] = [];

            // Translate to each target language
            for (const tl of targetLangs) {
                try {
                    if (conversationId) {
                        const res = await apiSendMessage(
                            conversationId, speakerLabel, text, fromLang, tl
                        );
                        translations.push({
                            text: res.translated_text || '',
                            lang: tl,
                        });
                    } else {
                        // Fallback: use direct translate API
                        const res = await translateSingle(text, fromLang, tl);
                        translations.push({
                            text: res.output_text || '',
                            lang: tl,
                        });
                    }
                } catch {
                    translations.push({ text: `(Translation to ${SUPPORTED_LANGUAGES[tl]} unavailable)`, lang: tl });
                }
            }

            const msg: Message = {
                id: Date.now().toString(),
                text,
                translations,
                speaker: activeSpeaker,
                lang: fromLang,
            };
            setMessages(prev => [...prev, msg]);
            setInputText('');
        } catch {
            const msg: Message = {
                id: Date.now().toString(),
                text,
                translations: [],
                speaker: activeSpeaker,
                lang: fromLang,
            };
            setMessages(prev => [...prev, msg]);
            setInputText('');
        }
        setLoading(false);
    };

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;
        await handleAutoSend(inputText.trim());
    };

    const clearConversation = () => {
        Alert.alert('Clear Conversation', 'Remove all messages?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear', style: 'destructive', onPress: () => {
                    setMessages([]);
                    setInputText('');
                    // Create a fresh conversation session
                    const speakerCount = mode === '3way' ? 3 : 2;
                    const participants = [
                        { speaker_label: 'A', preferred_language: lang0 },
                        { speaker_label: 'B', preferred_language: lang1 },
                    ];
                    if (speakerCount === 3) {
                        participants.push({ speaker_label: 'C', preferred_language: lang2 });
                    }
                    createConversation(mode === '2way' ? 'two_way' : 'three_way', participants)
                        .then(res => setConversationId(res.conversation_id))
                        .catch(() => setConversationId(null));
                },
            },
        ]);
    };

    const speakerCount = mode === '3way' ? 3 : 2;

    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <LinearGradient colors={isDarkMode ? darkGradientColors : gradientColors} style={styles.bg} />

            <View style={styles.headerArea}>
                <Text style={[styles.headerTitle, isDarkMode && { color: '#F8FAFC' }]}>ANO-KAMO?</Text>

                {/* Mode Toggle */}
                <View style={[styles.toggleRow, isDarkMode && styles.toggleRowDark]}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, mode === '2way' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
                        onPress={() => setMode('2way')}
                    >
                        <Text style={[styles.toggleText, mode === '2way' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                            2 Way Talk
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, mode === '3way' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
                        onPress={() => setMode('3way')}
                    >
                        <Text style={[styles.toggleText, mode === '3way' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                            3 Way Talk
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
                            {mode === '2way' ? '2-Way Conversation' : '3-Way Conversation'}
                        </Text>
                        <Text style={styles.emptySubtext}>
                            Tap a speaker above to set who's talking, then type or use the mic. Tap again to change language.
                        </Text>
                    </View>
                )}

                {messages.map((msg) => {
                    const langColor = getColorForLang(msg.lang);
                    const isLeft = msg.speaker === 0;
                    const isCenter = mode === '3way' && msg.speaker === 1;
                    const isRight = (mode === '2way' && msg.speaker === 1) ||
                        (mode === '3way' && msg.speaker === 2);

                    return (
                        <View
                            key={msg.id}
                            style={[
                                styles.msgRow,
                                isLeft ? styles.msgLeft :
                                    isCenter ? styles.msgCenter :
                                        styles.msgRight,
                            ]}
                        >
                            <View style={[styles.bubble, { backgroundColor: langColor.bg }]}>
                                {/* Speaker label */}
                                <Text style={styles.bubbleSpeakerLabel}>
                                    {SUPPORTED_LANGUAGES[msg.lang]}
                                </Text>

                                {/* Original text on top */}
                                <Text style={[styles.bubbleText, { color: langColor.text }]}>
                                    {msg.text}
                                </Text>

                                {/* Translation(s) on bottom */}
                                {msg.translations.map((tr, idx) => {
                                    const trColor = getColorForLang(tr.lang);
                                    return (
                                        <View key={idx}>
                                            <View style={[styles.bubbleDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                                            <View style={styles.transRow}>
                                                <View style={[styles.transLangDot, { backgroundColor: trColor.light }]} />
                                                <Text style={styles.transLangLabel}>
                                                    {SUPPORTED_LANGUAGES[tr.lang]}
                                                </Text>
                                            </View>
                                            <SelectableWord
                                                text={tr.text}
                                                sourceLang={tr.lang}
                                                targetLang={msg.lang}
                                                style={[styles.transText, { color: langColor.trans }]}
                                            />
                                        </View>
                                    );
                                })}

                                {/* Footer with TTS icons */}
                                <View style={styles.bubbleFooter}>
                                    <TouchableOpacity
                                        onPress={() => tts.speak(msg.text, msg.lang)}
                                        style={styles.footerIcon}
                                    >
                                        <Volume2 size={14} color="rgba(255,255,255,0.7)" />
                                    </TouchableOpacity>
                                    {msg.translations.map((tr, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            onPress={() => tts.speak(tr.text, tr.lang)}
                                            style={styles.footerIcon}
                                        >
                                            <View style={[styles.ttsLangDot, { backgroundColor: getColorForLang(tr.lang).light }]} />
                                            <Volume2 size={14} color="rgba(255,255,255,0.7)" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

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
                                    : LANGUAGE_PLACEHOLDERS[getActiveLang()] || 'Type a message...'
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
                }}
                selected={pickerFor !== null ? getLang(pickerFor) : 'tl'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    containerDark: { backgroundColor: '#0F172A' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

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

    chatArea: { flex: 1 },
    chatContent: { padding: 16, paddingBottom: 160 },

    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#94A3B8', marginTop: 14 },
    emptySubtext: { fontSize: 13, color: '#CBD5E1', textAlign: 'center', maxWidth: 260, marginTop: 6 },

    msgRow: { marginBottom: 10, maxWidth: '82%' },
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
        marginBottom: 4,
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
        outlineStyle: 'none',
    },
    textInputDark: {
        color: '#F8FAFC',
        backgroundColor: 'rgba(0,0,0,0.2)',
        outlineStyle: 'none',
    },
    sendBtn: { padding: 10 },
});
