import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    FlatList,
    TouchableOpacity,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Heart,
    Trash2,
    Volume2,
    Clock,
    MessageSquare,
} from 'lucide-react-native';
import axios from 'axios';
import { gradientColors, API_BASE_URL, SUPPORTED_LANGUAGES } from '../src/theme';

interface HistoryItem {
    id: number;
    input_text: string;
    output_texts: string[];
    source_lang: string;
    target_langs: string[];
    is_favorite: boolean;
    created_at: string;
}

// Accent color per language
const LANG_COLORS: Record<string, string> = {
    tl: '#3B82F6',
    ceb: '#8B5CF6',
    hil: '#10B981',
    en: '#F59E0B',
};

export default function HistoryScreen() {
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');

    const fetchData = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/v1/history`);
            setItems(res.data);
        } catch {
            // Mock data matching Figma
            setItems([
                { id: 1, input_text: 'Magandang umaga sa lahat', output_texts: ['Good morning everyone'], source_lang: 'tl', target_langs: ['en'], is_favorite: true, created_at: new Date().toISOString() },
                { id: 2, input_text: 'Maayong buntag', output_texts: ['Good morning'], source_lang: 'ceb', target_langs: ['en'], is_favorite: true, created_at: new Date().toISOString() },
                { id: 3, input_text: 'Maayong aga', output_texts: ['Good morning'], source_lang: 'hil', target_langs: ['en'], is_favorite: false, created_at: new Date().toISOString() },
                { id: 4, input_text: 'Kumusta ka?', output_texts: ['How are you?'], source_lang: 'tl', target_langs: ['en'], is_favorite: true, created_at: new Date().toISOString() },
                { id: 5, input_text: 'I love you', output_texts: ['Mahal kita'], source_lang: 'en', target_langs: ['tl'], is_favorite: false, created_at: new Date().toISOString() },
                { id: 6, input_text: 'Salamat', output_texts: ['Thank you'], source_lang: 'tl', target_langs: ['en'], is_favorite: true, created_at: new Date().toISOString() },
                { id: 7, input_text: 'Unsa imong pangalan?', output_texts: ['What is your name?'], source_lang: 'ceb', target_langs: ['en'], is_favorite: false, created_at: new Date().toISOString() },
                { id: 8, input_text: 'Diin ka nagpuyo?', output_texts: ['Where do you live?'], source_lang: 'hil', target_langs: ['en'], is_favorite: false, created_at: new Date().toISOString() },
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleFav = (id: number) => {
        setItems(prev => prev.map(h => h.id === id ? { ...h, is_favorite: !h.is_favorite } : h));
    };

    const deleteItem = (id: number) => {
        setItems(prev => prev.filter(h => h.id !== id));
    };

    const filtered = activeTab === 'favorites'
        ? items.filter(i => i.is_favorite)
        : items;

    const renderItem = ({ item }: { item: HistoryItem }) => {
        const accent = LANG_COLORS[item.source_lang] || '#3B82F6';
        const langName = SUPPORTED_LANGUAGES[item.source_lang] || item.source_lang;

        return (
            <View style={styles.card}>
                {/* Blue accent bar */}
                <View style={[styles.accentBar, { backgroundColor: accent }]} />

                <View style={styles.cardContent}>
                    {/* Language label */}
                    <Text style={[styles.langLabel, { color: accent }]}>{langName}</Text>

                    {/* Source text */}
                    <Text style={styles.sourceText}>{item.input_text}</Text>

                    {/* Translation */}
                    <Text style={styles.transText}>{item.output_texts[0]}</Text>

                    {/* Actions */}
                    <View style={styles.cardActions}>
                        <TouchableOpacity style={styles.actionBtn}>
                            <Volume2 size={15} color="#64748B" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => toggleFav(item.id)}>
                            <Heart
                                size={15}
                                color={item.is_favorite ? '#EF4444' : '#94A3B8'}
                                fill={item.is_favorite ? '#EF4444' : 'none'}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => deleteItem(item.id)}>
                            <Trash2 size={15} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={[...gradientColors]} style={styles.bg} />

            <View style={styles.content}>
                {/* Logo Area */}
                <View style={styles.logoArea}>
                    <View style={styles.logoIcon}>
                        <MessageSquare size={20} color="#FFF" />
                    </View>
                    <Text style={styles.logoText}>Ano-Kamo?</Text>
                </View>

                {/* Toggle Tabs */}
                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, activeTab === 'favorites' && styles.toggleActive]}
                        onPress={() => setActiveTab('favorites')}
                    >
                        <Text style={[styles.toggleText, activeTab === 'favorites' && styles.toggleTextActive]}>
                            Favorites
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, activeTab === 'history' && styles.toggleActive]}
                        onPress={() => setActiveTab('history')}
                    >
                        <Text style={[styles.toggleText, activeTab === 'history' && styles.toggleTextActive]}>
                            History
                        </Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color="#3B82F6" size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        renderItem={renderItem}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.center}>
                                {activeTab === 'favorites' ? (
                                    <Heart size={48} color="#E2E8F0" />
                                ) : (
                                    <Clock size={48} color="#E2E8F0" />
                                )}
                                <Text style={styles.emptyText}>
                                    {activeTab === 'favorites' ? 'No favorites yet' : 'No history yet'}
                                </Text>
                                <Text style={styles.emptySubtext}>
                                    {activeTab === 'favorites'
                                        ? 'Tap the heart icon on a translation to save it'
                                        : 'Your translations will appear here'}
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    content: { flex: 1, paddingTop: 100, paddingHorizontal: 20 },

    /* Logo */
    logoArea: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    logoIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    logoText: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1E293B',
    },

    /* Toggle */
    toggleRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(241,245,249,0.9)',
        borderRadius: 30,
        padding: 4,
        marginBottom: 20,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 26,
        alignItems: 'center',
    },
    toggleActive: {
        backgroundColor: '#3B82F6',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    toggleText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    toggleTextActive: { color: '#FFFFFF' },

    /* Card */
    card: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 16,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    accentBar: {
        width: 5,
    },
    cardContent: {
        flex: 1,
        padding: 14,
    },
    langLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    sourceText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 3,
    },
    transText: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 8,
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 4,
    },
    actionBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },

    /* Empty */
    list: { paddingBottom: 20 },
    center: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 16, fontWeight: '600', color: '#94A3B8', marginTop: 12 },
    emptySubtext: { fontSize: 13, color: '#CBD5E1', textAlign: 'center', marginTop: 4, maxWidth: 240 },
});
