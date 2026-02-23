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
} from '../src/lib/api';
import {
    gradientColors,
    darkGradientColors,
    glassCard,
    darkGlassCard,
    SUPPORTED_LANGUAGES,
    LANGUAGE_PLACEHOLDERS,
} from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import { useSpeechRecognition } from '../src/hooks/useSpeechRecognition';
import { useTextToSpeech } from '../src/hooks/useTextToSpeech';

const { width } = Dimensions.get('window');

interface Message {
    id: string;
    text: string;
    translation: string;
    speaker: number; // 0, 1, or 2
    lang: string;
    targetLang: string;
}

// Glass-compatible speaker themes
const SPEAKER_THEMES = [
    { bg: 'rgba(59, 130, 246, 0.85)', text: '#FFFFFF', trans: '#BFDBFE', label: 'Speaker 1' },
    { bg: 'rgba(239, 68, 68, 0.85)', text: '#FFFFFF', trans: '#FECACA', label: 'Speaker 2' },
];

const SPEAKER_3WAY = [
    { bg: 'rgba(59, 130, 246, 0.85)', text: '#FFFFFF', trans: '#BFDBFE', label: 'Speaker 1' },
    { bg: 'rgba(239, 68, 68, 0.85)', text: '#FFFFFF', trans: '#FECACA', label: 'Speaker 2' },
    { bg: 'rgba(234, 179, 8, 0.85)', text: '#FFFFFF', trans: '#FEF08A', label: 'Speaker 3' },
];

const DARK_SPEAKER_THEMES = [
    { bg: 'rgba(37, 99, 235, 0.75)', text: '#FFFFFF', trans: '#93C5FD', label: 'Speaker 1' },
    { bg: 'rgba(220, 38, 38, 0.75)', text: '#FFFFFF', trans: '#FCA5A5', label: 'Speaker 2' },
    { bg: 'rgba(202, 138, 4, 0.75)', text: '#FFFFFF', trans: '#FDE047', label: 'Speaker 3' },
];

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
        if (speech.isListening) {
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
    }, [speech.isListening]);

    // Auto-populate input with live transcript
    useEffect(() => {
        const liveText = (speech.transcript + ' ' + speech.interimTranscript).trim();
        if (liveText) {
            setInputText(liveText);
        }
    }, [speech.transcript, speech.interimTranscript]);

    // When recognition ends and we have finalized text, auto-send as message
    useEffect(() => {
        if (!speech.isListening && speech.transcript.trim()) {
            // Auto-send the recognized text as a chat message (no translation)
            const finalText = speech.transcript.trim();
            const speakerLang = getActiveLang();
            const msg: Message = {
                id: Date.now().toString(),
                text: finalText,
                translation: '', // No translation for now
                speaker: activeSpeaker,
                lang: speakerLang,
                targetLang: speakerLang,
            };
            setMessages(prev => [...prev, msg]);
            setInputText('');
        }
    }, [speech.isListening]);

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

    const getTheme = (speaker: number) => {
        if (mode === '3way') return SPEAKER_3WAY[speaker] || SPEAKER_3WAY[0];
        const themes = isDarkMode ? DARK_SPEAKER_THEMES : SPEAKER_THEMES;
        return speaker === 0 ? themes[0] : themes[1];
    };

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;
        const fromLang = getLang(activeSpeaker);
        const targetSpeaker = activeSpeaker === 0 ? 1 : 0;
        const toLang = getLang(targetSpeaker);
        const speakerLabel = ['A', 'B', 'C'][activeSpeaker];

        setLoading(true);
        try {
            let translation = '';
            if (conversationId) {
                const res = await apiSendMessage(
                    conversationId, speakerLabel, inputText, fromLang, toLang
                );
                translation = res.translated_text || '';
            }

            const msg: Message = {
                id: Date.now().toString(),
                text: inputText,
                translation,
                speaker: activeSpeaker,
                lang: fromLang,
                targetLang: toLang,
            };
            setMessages(prev => [...prev, msg]);
            setInputText('');
        } catch {
            Alert.alert('Error', 'Could not send message');
        }
        setLoading(false);
    };

    const clearConversation = () => {
        Alert.alert('Clear Conversation', 'Remove all messages?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear', style: 'destructive', onPress: () => {
                    setMessages([]);
                    // Reset conversation session
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
                        const t = getTheme(i);
                        const isActive = activeSpeaker === i;
                        return (
                            <TouchableOpacity
                                key={i}
                                style={[
                                    styles.speakerChip,
                                    { borderColor: isActive ? t.bg : 'rgba(0,0,0,0.1)' },
                                    isActive && { backgroundColor: t.bg },
                                    isDarkMode && !isActive && { borderColor: 'rgba(255,255,255,0.2)' }
                                ]}
                                onPress={() => setActiveSpeaker(i)}
                                onLongPress={() => setPickerFor(i)}
                            >
                                <Text style={[
                                    styles.speakerChipText,
                                    { color: isActive ? '#FFF' : (isDarkMode ? '#F8FAFC' : '#1E293B') },
                                ]}>
                                    {SUPPORTED_LANGUAGES[getLang(i)]}
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
                            Tap a speaker above to set who's talking, then type or use the mic.
                        </Text>
                    </View>
                )}

                {messages.map((msg) => {
                    const t = getTheme(msg.speaker);
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
                            <View
                                style={[styles.bubble, { backgroundColor: t.bg }]}
                            >
                                <Text style={[styles.bubbleText, { color: t.text }]}>
                                    {msg.text}
                                </Text>
                                {msg.translation ? (
                                    <>
                                        <View style={[styles.bubbleDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                                        <Text style={[styles.transText, { color: t.trans }]}>
                                            {msg.translation}
                                        </Text>
                                    </>
                                ) : null}
                                <View style={styles.bubbleFooter}>
                                    <TouchableOpacity onPress={() => tts.speak(msg.text, msg.lang)}>
                                        <Volume2 size={14} color="rgba(255,255,255,0.7)" />
                                    </TouchableOpacity>
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
                    {/* Active speaker indicator */}
                    <View style={[styles.speakerDot, { backgroundColor: getTheme(activeSpeaker).bg }]} />

                    <TouchableOpacity
                        style={[styles.micBtn, { backgroundColor: speech.isListening ? '#EF4444' : getTheme(activeSpeaker).bg }]}
                        onPress={() => {
                            if (!speech.isSupported) {
                                Alert.alert('Not Supported', 'Speech recognition requires Chrome or Edge browser.');
                                return;
                            }
                            if (speech.isListening) {
                                speech.stopListening();
                            } else {
                                speech.startListening();
                            }
                        }}
                    >
                        <Animated.View style={{ transform: [{ scale: speech.isListening ? pulseAnim : 1 }] }}>
                            {speech.isListening ? (
                                <MicOff size={20} color="#FFF" />
                            ) : (
                                <Mic size={20} color="#FFF" />
                            )}
                        </Animated.View>
                    </TouchableOpacity>

                    <TextInput
                        style={[styles.textInput, isDarkMode && styles.textInputDark]}
                        placeholder={speech.isListening ? 'Listening...' : LANGUAGE_PLACEHOLDERS[getLang(activeSpeaker)]}
                        placeholderTextColor={speech.isListening ? '#EF4444' : (isDarkMode ? '#64748B' : '#94A3B8')}
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

    /* Header Area */
    headerArea: {
        paddingTop: 100,
        paddingHorizontal: 20,
    },

    /* Mode Toggle */
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
    toggleActiveDark: {
        backgroundColor: '#334155',
    },
    toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    toggleTextActive: { color: '#1E293B' },
    toggleTextActiveDark: { color: '#F8FAFC' },

    /* Speaker Chips */
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
    speakerChipText: {
        fontSize: 12,
        fontWeight: '700',
        marginRight: 3,
    },
    clearBtn: {
        marginLeft: 'auto',
        padding: 6,
    },

    /* Chat */
    chatArea: { flex: 1 },
    chatContent: { padding: 16, paddingBottom: 160 },

    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#94A3B8', marginTop: 14 },
    emptySubtext: { fontSize: 13, color: '#CBD5E1', textAlign: 'center', maxWidth: 260, marginTop: 6 },

    /* Messages */
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
    bubbleText: {
        fontSize: 15,
        lineHeight: 21,
    },
    bubbleDivider: {
        height: 1,
        marginVertical: 8,
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
    },

    /* Input Bar */
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
