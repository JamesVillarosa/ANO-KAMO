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
import {
    Plus,
    ThumbsUp,
    ThumbsDown,
    Send,
    X,
    ChevronDown,
    MessageCircle,
} from 'lucide-react-native';
import axios from 'axios';
import { gradientColors, glassCard, SUPPORTED_LANGUAGES, API_BASE_URL } from '../src/theme';
import LanguagePicker from '../src/components/LanguagePicker';

interface Submission {
    id: number;
    phrase: string;
    proposed_translation: string;
    source_lang: string;
    target_lang: string;
    status: string;
    votes: number;
    notes?: string;
}

export default function CommunityScreen() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    // Form
    const [newPhrase, setNewPhrase] = useState('');
    const [newTranslation, setNewTranslation] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [formSourceLang, setFormSourceLang] = useState('en');
    const [formTargetLang, setFormTargetLang] = useState('tl');
    const [pickerTarget, setPickerTarget] = useState<'source' | 'target' | null>(null);

    const fetchSubmissions = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/v1/community/submissions`);
            setSubmissions(res.data);
        } catch {
            setSubmissions([
                { id: 1, phrase: 'Char', proposed_translation: 'Just kidding / Not serious', source_lang: 'tl', target_lang: 'en', status: 'pending', votes: 12, notes: 'Filipino gay lingo' },
                { id: 2, phrase: 'Werpa', proposed_translation: 'Power (reversed)', source_lang: 'tl', target_lang: 'en', status: 'approved', votes: 24, notes: 'Gen Z slang' },
                { id: 3, phrase: 'Dasurv', proposed_translation: 'Deserves / Deserved it', source_lang: 'tl', target_lang: 'en', status: 'pending', votes: 8, notes: 'Social media slang' },
                { id: 4, phrase: 'Lodi', proposed_translation: 'Idol (reversed)', source_lang: 'tl', target_lang: 'en', status: 'approved', votes: 30, notes: 'Gen Z slang' },
                { id: 5, phrase: 'Petmalu', proposed_translation: 'Awesome / Amazing (from malupet)', source_lang: 'tl', target_lang: 'en', status: 'approved', votes: 18, notes: 'Street slang' },
            ]);
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
            await axios.post(`${API_BASE_URL}/api/v1/community/submissions`, {
                phrase: newPhrase,
                source_lang: formSourceLang,
                target_lang: formTargetLang,
                proposed_translation: newTranslation,
                notes: newNotes,
            });
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
            notes: newNotes,
        }, ...prev]);

        setModalVisible(false);
        setNewPhrase('');
        setNewTranslation('');
        setNewNotes('');
    };

    const vote = (id: number, direction: 'up' | 'down') => {
        setSubmissions(prev => prev.map(s =>
            s.id === id ? { ...s, votes: s.votes + (direction === 'up' ? 1 : -1) } : s
        ));
    };

    const statusColor = (status: string) =>
        status === 'approved' ? '#10B981' : status === 'rejected' ? '#EF4444' : '#F59E0B';

    const renderItem = ({ item }: { item: Submission }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '22' }]}>
                    <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                        {item.status}
                    </Text>
                </View>
                <View style={styles.voteRow}>
                    <TouchableOpacity onPress={() => vote(item.id, 'up')}>
                        <ThumbsUp size={16} color="#10B981" />
                    </TouchableOpacity>
                    <Text style={styles.voteCount}>{item.votes}</Text>
                    <TouchableOpacity onPress={() => vote(item.id, 'down')}>
                        <ThumbsDown size={16} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>
            <Text style={styles.phrase}>{item.phrase}</Text>
            <Text style={styles.translation}>{item.proposed_translation}</Text>
            {item.notes ? (
                <View style={styles.noteRow}>
                    <MessageCircle size={12} color="#94A3B8" />
                    <Text style={styles.noteText}>{item.notes}</Text>
                </View>
            ) : null}
            <Text style={styles.langMeta}>
                {item.source_lang.toUpperCase()} → {item.target_lang.toUpperCase()}
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={[...gradientColors]} style={styles.bg} />

            <View style={styles.content}>
                <Text style={styles.subtitle}>
                    Help improve Filipino translations by contributing phrases, slang, and idioms.
                </Text>

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
                    <View style={styles.modal}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Suggest a Phrase</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Language selection */}
                        <View style={styles.modalLangs}>
                            <TouchableOpacity
                                style={styles.modalLangChip}
                                onPress={() => setPickerTarget('source')}
                            >
                                <Text style={styles.modalLangText}>{SUPPORTED_LANGUAGES[formSourceLang]}</Text>
                                <ChevronDown size={14} color="#3B82F6" />
                            </TouchableOpacity>
                            <Text style={styles.modalArrow}>→</Text>
                            <TouchableOpacity
                                style={styles.modalLangChip}
                                onPress={() => setPickerTarget('target')}
                            >
                                <Text style={styles.modalLangText}>{SUPPORTED_LANGUAGES[formTargetLang]}</Text>
                                <ChevronDown size={14} color="#3B82F6" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Original phrase (e.g. Char, Werpa, Dasurv)"
                            placeholderTextColor="#94A3B8"
                            value={newPhrase}
                            onChangeText={setNewPhrase}
                        />
                        <TextInput
                            style={[styles.modalInput, { minHeight: 70 }]}
                            placeholder="Proposed meaning/translation"
                            placeholderTextColor="#94A3B8"
                            value={newTranslation}
                            onChangeText={setNewTranslation}
                            multiline
                        />
                        <TextInput
                            style={styles.modalInput}
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
                    </View>
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
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    content: { flex: 1, paddingTop: 100, paddingHorizontal: 20 },
    subtitle: { fontSize: 14, color: '#64748B', marginBottom: 16, lineHeight: 20 },

    /* Card */
    card: { ...glassCard, padding: 16, marginBottom: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    voteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    voteCount: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
    phrase: { fontSize: 14, color: '#64748B', marginBottom: 2 },
    translation: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
    noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    noteText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
    langMeta: { fontSize: 11, color: '#94A3B8' },

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
    modal: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
    modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
    modalLangs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    modalLangChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
    modalLangText: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginRight: 4 },
    modalArrow: { fontSize: 16, color: '#94A3B8', marginHorizontal: 12 },
    modalInput: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1E293B',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 12,
    },
    submitBtn: {
        flexDirection: 'row',
        backgroundColor: '#3B82F6',
        borderRadius: 16,
        paddingVertical: 14,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    submitText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

    /* Misc */
    list: { paddingBottom: 80 },
    center: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 16, color: '#94A3B8' },
});
