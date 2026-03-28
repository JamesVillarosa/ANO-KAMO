import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    FlatList,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBlur as BlurView } from '../src/components/GlassBlur';
import {
    Plus,
    ThumbsUp,
    ThumbsDown,
    Send,
    X,
    ChevronDown,
    MessageCircle,
    CheckCircle,
    MapPin,
} from 'lucide-react-native';
import {
    getSubmissions as apiGetSubmissions,
    submitPhrase as apiSubmitPhrase,
    voteSubmission as apiVoteSubmission,
} from '../src/lib/api';
import { gradientColors, darkGradientColors, glassCard, darkGlassCard, SUPPORTED_LANGUAGES } from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import LanguagePicker from '../src/components/LanguagePicker';

interface Submission {
    id: number;
    phrase: string;
    proposed_translation: string;
    source_lang: string;
    target_lang: string;
    status: string;
    votes: number;
    is_verified: boolean;
    notes?: string;
    origin?: string;
    context?: string;
}

export default function CommunityScreen() {
    const { isDarkMode } = useTheme();
    const activeGradient = isDarkMode ? darkGradientColors : gradientColors;
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    // Form
    const [newPhrase, setNewPhrase] = useState('');
    const [newTranslation, setNewTranslation] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [newOrigin, setNewOrigin] = useState('');
    const [formSourceLang, setFormSourceLang] = useState('tl');
    const [formTargetLang, setFormTargetLang] = useState('en');
    const [pickerTarget, setPickerTarget] = useState<'source' | 'target' | null>(null);

    const fetchSubmissions = async () => {
        try {
            const res = await apiGetSubmissions();
            setSubmissions(res);
        } catch {
            setSubmissions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSubmissions(); }, []);

    const handleSubmit = async () => {
        if (!newPhrase.trim() || !newTranslation.trim()) {
            Alert.alert('Error', 'Please fill in both fields');
            return;
        }
        try {
            await apiSubmitPhrase(newPhrase, formSourceLang, formTargetLang, newTranslation, newNotes);
        } catch { /* fallback */ }

        // Optimistic add
        setSubmissions(prev => [{
            id: Date.now(),
            phrase: newPhrase,
            proposed_translation: newTranslation,
            source_lang: formSourceLang,
            target_lang: formTargetLang,
            status: 'pending',
            votes: 0,
            is_verified: false,
            notes: newNotes,
            origin: newOrigin,
        }, ...prev]);

        setModalVisible(false);
        setNewPhrase('');
        setNewTranslation('');
        setNewNotes('');
        setNewOrigin('');
    };

    const vote = async (id: number, direction: 'up' | 'down') => {
        try {
            await apiVoteSubmission(id, direction === 'up' ? 1 : -1);
        } catch { }
        setSubmissions(prev => prev.map(s =>
            s.id === id ? {
                ...s,
                votes: s.votes + (direction === 'up' ? 1 : -1),
                is_verified: (s.votes + (direction === 'up' ? 1 : -1)) >= 10,
            } : s
        ));
    };

    const verifiedCount = submissions.filter(s => s.is_verified).length;
    const pendingCount = submissions.filter(s => !s.is_verified).length;

    const statusColor = (status: string) =>
        status === 'approved' ? '#10B981' : status === 'rejected' ? '#EF4444' : '#F59E0B';

    const renderItem = ({ item }: { item: Submission }) => (
        <BlurView
            intensity={isDarkMode ? 30 : 50}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.card, isDarkMode && styles.cardDark, item.is_verified && styles.cardVerified]}
        >
            <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {item.is_verified ? (
                        <View style={styles.verifiedBadge}>
                            <CheckCircle size={12} color="#FFF" />
                            <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                    ) : (
                        <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '22' }]}>
                            <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                                {item.status}
                            </Text>
                        </View>
                    )}
                </View>
                <View style={styles.voteRow}>
                    <TouchableOpacity onPress={() => vote(item.id, 'up')}>
                        <ThumbsUp size={16} color="#10B981" />
                    </TouchableOpacity>
                    <Text style={[styles.voteCount, isDarkMode && styles.textWhite]}>{item.votes}</Text>
                    <TouchableOpacity onPress={() => vote(item.id, 'down')}>
                        <ThumbsDown size={16} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>
            <Text style={[styles.phrase, isDarkMode && styles.textSecondary]}>{item.phrase}</Text>
            <Text style={[styles.translation, isDarkMode && styles.textWhite]}>{item.proposed_translation}</Text>
            {item.origin ? (
                <View style={styles.originRow}>
                    <MapPin size={12} color="#8B5CF6" />
                    <Text style={styles.originText}>{item.origin}</Text>
                </View>
            ) : null}
            {item.notes ? (
                <View style={styles.noteRow}>
                    <MessageCircle size={12} color="#94A3B8" />
                    <Text style={styles.noteText}>{item.notes}</Text>
                </View>
            ) : null}
            <Text style={[styles.langMeta, isDarkMode && styles.textSecondary]}>
                {(SUPPORTED_LANGUAGES[item.source_lang] || item.source_lang.toUpperCase())} → {(SUPPORTED_LANGUAGES[item.target_lang] || item.target_lang.toUpperCase())}
            </Text>
        </BlurView>
    );

    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <LinearGradient colors={[...activeGradient]} style={styles.bg} />

            <View style={styles.content}>
                <Text style={styles.subtitle}>
                    Help improve Filipino translations by contributing phrases, slang, and idioms.
                </Text>

                {/* Stats */}
                {!loading && submissions.length > 0 && (
                    <View style={styles.statsRow}>
                        <View style={[styles.statChip, styles.statVerified]}>
                            <CheckCircle size={13} color="#10B981" />
                            <Text style={[styles.statText, { color: '#10B981' }]}>{verifiedCount} Verified</Text>
                        </View>
                        <View style={[styles.statChip, styles.statPending]}>
                            <Text style={[styles.statText, { color: '#F59E0B' }]}>{pendingCount} Pending</Text>
                        </View>
                    </View>
                )}

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color="#3B82F6" size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={submissions}
                        renderItem={renderItem}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.center}>
                                <Text style={styles.emptyText}>No submissions yet. Be the first!</Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                <Plus size={24} color="#FFF" />
            </TouchableOpacity>

            {/* Submit Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <BlurView
                        intensity={60}
                        tint={isDarkMode ? 'dark' : 'light'}
                        style={[styles.modal, isDarkMode && styles.modalDark]}
                    >
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, isDarkMode && styles.textWhite]}>Suggest a Phrase</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>

                        {/* Language selection */}
                        <View style={styles.modalLangs}>
                            <TouchableOpacity
                                style={[styles.modalLangChip, isDarkMode && styles.modalLangChipDark]}
                                onPress={() => setPickerTarget('source')}
                            >
                                <Text style={[styles.modalLangText, isDarkMode && styles.textWhite]}>{SUPPORTED_LANGUAGES[formSourceLang]}</Text>
                                <ChevronDown size={14} color="#3B82F6" />
                            </TouchableOpacity>
                            <Text style={styles.modalArrow}>→</Text>
                            <TouchableOpacity
                                style={[styles.modalLangChip, isDarkMode && styles.modalLangChipDark]}
                                onPress={() => setPickerTarget('target')}
                            >
                                <Text style={[styles.modalLangText, isDarkMode && styles.textWhite]}>{SUPPORTED_LANGUAGES[formTargetLang]}</Text>
                                <ChevronDown size={14} color="#3B82F6" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                            placeholder="Original phrase (e.g. Char, Werpa, Dasurv)"
                            placeholderTextColor="#94A3B8"
                            value={newPhrase}
                            onChangeText={setNewPhrase}
                        />
                        <TextInput
                            style={[styles.modalInput, isDarkMode && styles.modalInputDark, { minHeight: 70 }]}
                            placeholder="Proposed meaning/translation"
                            placeholderTextColor="#94A3B8"
                            value={newTranslation}
                            onChangeText={setNewTranslation}
                            multiline
                        />
                        <TextInput
                            style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                            placeholder="Region (e.g. Metro Manila, Cebu)"
                            placeholderTextColor="#94A3B8"
                            value={newOrigin}
                            onChangeText={setNewOrigin}
                        />
                        <TextInput
                            style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                            placeholder="Notes (e.g. Gen Z slang, gay lingo)"
                            placeholderTextColor="#94A3B8"
                            value={newNotes}
                            onChangeText={setNewNotes}
                        />

                        <TouchableOpacity
                            style={[styles.submitBtn, (!newPhrase.trim() || !newTranslation.trim()) && { opacity: 0.5 }]}
                            onPress={handleSubmit}
                            disabled={!newPhrase.trim() || !newTranslation.trim()}
                        >
                            <Send size={18} color="#FFF" />
                            <Text style={styles.submitText}>Submit</Text>
                        </TouchableOpacity>
                    </BlurView>
                </View>
            </Modal>

            <LanguagePicker
                visible={pickerTarget !== null}
                onDismiss={() => setPickerTarget(null)}
                onSelect={(code) => {
                    if (pickerTarget === 'source') setFormSourceLang(code);
                    else setFormTargetLang(code);
                }}
                selected={pickerTarget === 'source' ? formSourceLang : formTargetLang}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    containerDark: { backgroundColor: '#0F172A' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    content: { flex: 1, paddingTop: 100, paddingHorizontal: 20 },
    subtitle: { fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 20 },

    /* Stats */
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    statChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statVerified: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.15)',
    },
    statPending: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.15)',
    },
    statText: { fontSize: 12, fontWeight: '700' },

    /* Card */
    card: {
        ...glassCard,
        padding: 16,
        marginBottom: 12,
        overflow: 'hidden',
    },
    cardDark: {
        ...darkGlassCard,
        backgroundColor: 'rgba(30, 41, 59, 0.45)',
    },
    cardVerified: {
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

    /* Verified badge */
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#10B981',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    verifiedText: { fontSize: 11, fontWeight: '700', color: '#FFF' },

    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    voteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    voteCount: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
    phrase: { fontSize: 13, color: '#64748B', marginBottom: 2 },
    translation: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
    originRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    originText: { fontSize: 12, color: '#8B5CF6', fontWeight: '600' },
    noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    noteText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
    langMeta: { fontSize: 11, color: '#94A3B8' },
    textWhite: { color: '#F8FAFC' },
    textSecondary: { color: '#94A3B8' },

    /* FAB */
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },

    /* Modal */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
    modal: {
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        overflow: 'hidden',
    },
    modalDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.7)',
    },
    modalHandle: { width: 40, height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
    modalLangs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    modalLangChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.5)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    modalLangChipDark: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalLangText: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginRight: 6 },
    modalArrow: { fontSize: 16, color: '#94A3B8', marginHorizontal: 16 },
    modalInput: {
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 14,
        fontSize: 15,
        color: '#1E293B',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        marginBottom: 14,
    },
    modalInputDark: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.1)',
        color: '#F8FAFC',
    },
    submitBtn: {
        flexDirection: 'row',
        backgroundColor: '#3B82F6',
        borderRadius: 18,
        paddingVertical: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginTop: 6,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

    /* Misc */
    list: { paddingBottom: 80 },
    center: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 16, color: '#94A3B8' },
});
