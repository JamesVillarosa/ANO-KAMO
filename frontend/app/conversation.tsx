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
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Mic,
    MicOff,
    Send,
    Volume2,
    ChevronDown,
    Trash2,
    Smile,
} from 'lucide-react-native';
import axios from 'axios';
import {
    theme,
    gradientColors,
    glassCard,
    SUPPORTED_LANGUAGES,
    TONE_OPTIONS,
    TONE_COLORS,
    API_BASE_URL,
} from '../src/theme';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';

interface Message {
    id: string;
    text: string;
    translation: string;
    sender: 'left' | 'right';
    tone: string;
    lang: string;
    targetLang: string;
}

export default function ConversationScreen() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeSpeaker, setActiveSpeaker] = useState<'left' | 'right'>('left');

    // Languages
    const [leftLang, setLeftLang] = useState('tl');
    const [rightLang, setRightLang] = useState('ceb');
    const [pickerTarget, setPickerTarget] = useState<'left' | 'right' | null>(null);

    // Tone selector
    const [toneModalMsg, setToneModalMsg] = useState<string | null>(null);

    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
    }, [messages]);

    const translateText = useCallback(async (text: string, from: string, to: string) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/api/v1/translate`, {
                text, source_lang: from, target_lang: to,
            });
            return { translation: res.data.output_text || '', tone: res.data.detected_tone || 'neutral' };
        } catch {
            return { translation: 'Translation unavailable', tone: 'neutral' };
        }
    }, []);

    const sendMessage = async () => {
        if (!inputText.trim()) return;
        const fromLang = activeSpeaker === 'left' ? leftLang : rightLang;
        const toLang = activeSpeaker === 'left' ? rightLang : leftLang;

        setLoading(true);
        const { translation, tone } = await translateText(inputText, fromLang, toLang);

        const msg: Message = {
            id: Date.now().toString(),
            text: inputText,
            translation,
            sender: activeSpeaker,
            tone,
            lang: fromLang,
            targetLang: toLang,
        };
        setMessages(prev => [...prev, msg]);
        setInputText('');
        setLoading(false);
    };

    const updateTone = async (msgId: string, newTone: string) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;

        try {
            const res = await axios.post(`${API_BASE_URL}/api/v1/translate`, {
                text: msg.text,
                source_lang: msg.lang,
                target_lang: msg.targetLang,
                tone: newTone,
            });
            setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, translation: res.data.output_text || m.translation, tone: newTone } : m
            ));
        } catch {
            // Keep existing
        }
        setToneModalMsg(null);
    };

    const clearConversation = () => {
        Alert.alert('Clear Conversation', 'Remove all messages?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => setMessages([]) },
        ]);
    };

    const speakerColors = {
        left: { bg: '#3B82F6', text: '#FFF', transBg: '#2563EB' },
        right: { bg: '#E2E8F0', text: '#1E293B', transBg: '#CBD5E1' },
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={[...gradientColors]} style={styles.bg} />

            {/* Language Bar */}
            <View style={styles.langBar}>
                <TouchableOpacity
                    style={[styles.langChip, activeSpeaker === 'left' && styles.langChipActive]}
                    onPress={() => setActiveSpeaker('left')}
                    onLongPress={() => setPickerTarget('left')}
                >
                    <Text style={[styles.langChipText, activeSpeaker === 'left' && styles.langChipTextActive]}>
                        {SUPPORTED_LANGUAGES[leftLang]}
                    </Text>
                    <ChevronDown size={14} color={activeSpeaker === 'left' ? '#FFF' : '#64748B'} />
                </TouchableOpacity>

                <View style={styles.langVs}>
                    <Text style={styles.langVsText}>⇄</Text>
                </View>

                <TouchableOpacity
                    style={[styles.langChip, activeSpeaker === 'right' && styles.langChipActive]}
                    onPress={() => setActiveSpeaker('right')}
                    onLongPress={() => setPickerTarget('right')}
                >
                    <Text style={[styles.langChipText, activeSpeaker === 'right' && styles.langChipTextActive]}>
                        {SUPPORTED_LANGUAGES[rightLang]}
                    </Text>
                    <ChevronDown size={14} color={activeSpeaker === 'right' ? '#FFF' : '#64748B'} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.clearBtn} onPress={clearConversation}>
                    <Trash2 size={18} color="#EF4444" />
                </TouchableOpacity>
            </View>

            {/* Chat Area */}
            <ScrollView
                ref={scrollRef}
                style={styles.chatArea}
                contentContainerStyle={styles.chatContent}
            >
                {messages.length === 0 && (
                    <View style={styles.emptyState}>
                        <Mic size={40} color="#CBD5E1" />
                        <Text style={styles.emptyText}>Start a conversation</Text>
                        <Text style={styles.emptySubtext}>
                            Tap a language above to set the active speaker, then type or speak.
                        </Text>
                    </View>
                )}

                {messages.map((msg) => {
                    const colors = speakerColors[msg.sender];
                    const isLeft = msg.sender === 'left';
                    return (
                        <View
                            key={msg.id}
                            style={[styles.msgRow, isLeft ? styles.msgRowLeft : styles.msgRowRight]}
                        >
                            <View style={[styles.bubble, { backgroundColor: colors.bg }]}>
                                <Text style={[styles.bubbleText, { color: colors.text }]}>{msg.text}</Text>
                                <View style={[styles.bubbleDivider, { backgroundColor: isLeft ? 'rgba(255,255,255,0.2)' : '#94A3B8' }]} />
                                <Text style={[styles.transText, { color: isLeft ? '#BFDBFE' : '#475569' }]}>
                                    {msg.translation}
                                </Text>
                                <View style={styles.bubbleFooter}>
                                    <TouchableOpacity
                                        style={[styles.toneBadge, { backgroundColor: TONE_COLORS[msg.tone] + '22' }]}
                                        onPress={() => setToneModalMsg(msg.id)}
                                    >
                                        <Smile size={12} color={TONE_COLORS[msg.tone] || '#64748B'} />
                                        <Text style={[styles.toneText, { color: TONE_COLORS[msg.tone] || '#64748B' }]}>
                                            {msg.tone}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity>
                                        <Volume2 size={16} color={isLeft ? '#BFDBFE' : '#64748B'} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Tone Selector */}
                            {toneModalMsg === msg.id && (
                                <View style={styles.tonePopup}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {TONE_OPTIONS.map(tone => (
                                            <TouchableOpacity
                                                key={tone}
                                                style={[
                                                    styles.toneOption,
                                                    msg.tone === tone && { backgroundColor: TONE_COLORS[tone] + '22' },
                                                ]}
                                                onPress={() => updateTone(msg.id, tone)}
                                            >
                                                <Text style={[styles.toneOptionText, { color: TONE_COLORS[tone] }]}>
                                                    {tone}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Input Bar */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={90}
            >
                <View style={styles.inputBar}>
                    <TouchableOpacity style={styles.micBtn}>
                        <Mic size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Type or speak..."
                        placeholderTextColor="#94A3B8"
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={sendMessage}
                    />
                    {loading ? (
                        <ActivityIndicator color="#3B82F6" style={{ marginRight: 8 }} />
                    ) : (
                        <TouchableOpacity
                            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.4 }]}
                            onPress={sendMessage}
                            disabled={!inputText.trim()}
                        >
                            <Send size={18} color="#3B82F6" />
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>

            <BottomNav />

            <LanguagePicker
                visible={pickerTarget !== null}
                onDismiss={() => setPickerTarget(null)}
                onSelect={(code) => {
                    if (pickerTarget === 'left') setLeftLang(code);
                    else setRightLang(code);
                }}
                selected={pickerTarget === 'left' ? leftLang : rightLang}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

    /* Lang Bar */
    langBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 100,
        paddingBottom: 12,
    },
    langChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(241,245,249,0.9)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    langChipActive: { backgroundColor: '#3B82F6' },
    langChipText: { fontSize: 14, fontWeight: '600', color: '#475569', marginRight: 4 },
    langChipTextActive: { color: '#FFF' },
    langVs: { marginHorizontal: 10 },
    langVsText: { fontSize: 16, color: '#94A3B8' },
    clearBtn: { marginLeft: 'auto', padding: 8 },

    /* Chat */
    chatArea: { flex: 1 },
    chatContent: { padding: 16, paddingBottom: 140 },
    emptyState: { alignItems: 'center', marginTop: 80 },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#94A3B8', marginTop: 16 },
    emptySubtext: { fontSize: 14, color: '#CBD5E1', textAlign: 'center', maxWidth: 260, marginTop: 8 },

    /* Messages */
    msgRow: { marginBottom: 14, maxWidth: '82%' },
    msgRowLeft: { alignSelf: 'flex-start' },
    msgRowRight: { alignSelf: 'flex-end' },
    bubble: { padding: 14, borderRadius: 20 },
    bubbleText: { fontSize: 16, lineHeight: 22 },
    bubbleDivider: { height: 1, marginVertical: 8 },
    transText: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
    bubbleFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    toneBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    toneText: { fontSize: 11, fontWeight: '600', marginLeft: 4 },

    /* Tone Popup */
    tonePopup: {
        marginTop: 6,
        backgroundColor: '#FFF',
        borderRadius: 14,
        padding: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    toneOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 4 },
    toneOptionText: { fontSize: 12, fontWeight: '600' },

    /* Input */
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginBottom: 80,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 6,
    },
    micBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    textInput: {
        flex: 1,
        fontSize: 15,
        color: '#1E293B',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
    },
    sendBtn: { padding: 10 },
});
