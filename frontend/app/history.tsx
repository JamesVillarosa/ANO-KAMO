import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    FlatList,
    TouchableOpacity,
    TextInput,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Search,
    Heart,
    Trash2,
    Volume2,
    Clock,
    X,
} from 'lucide-react-native';
import axios from 'axios';
import { gradientColors, glassCard, API_BASE_URL } from '../src/theme';

interface HistoryItem {
    id: number;
    input_text: string;
    output_texts: string[];
    source_lang: string;
    target_langs: string[];
    is_favorite: boolean;
    created_at: string;
}

export default function HistoryScreen() {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'favorites'>('all');

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/v1/history`);
            setHistory(res.data);
        } catch {
            // Fallback mock
            setHistory([
                { id: 1, input_text: 'Magandang umaga', output_texts: ['Good morning'], source_lang: 'tl', target_langs: ['en'], is_favorite: true, created_at: new Date().toISOString() },
                { id: 2, input_text: 'Salamat', output_texts: ['Thank you'], source_lang: 'tl', target_langs: ['en'], is_favorite: false, created_at: new Date().toISOString() },
                { id: 3, input_text: 'Hello', output_texts: ['Kumusta'], source_lang: 'en', target_langs: ['tl'], is_favorite: false, created_at: new Date().toISOString() },
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchHistory(); }, []);

    const toggleFav = (id: number) => {
        setHistory(prev => prev.map(h => h.id === id ? { ...h, is_favorite: !h.is_favorite } : h));
    };

    const deleteItem = (id: number) => {
        setHistory(prev => prev.filter(h => h.id !== id));
    };

    const filtered = history
        .filter(h => filter === 'favorites' ? h.is_favorite : true)
        .filter(h =>
            h.input_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
            h.output_texts[0]?.toLowerCase().includes(searchQuery.toLowerCase())
        );

    const renderItem = ({ item }: { item: HistoryItem }) => (
        <View style={styles.card}>
            <View style={styles.cardTop}>
                <View style={styles.langBadges}>
                    <Text style={styles.badge}>{item.source_lang.toUpperCase()}</Text>
                    <Text style={styles.arrowText}>→</Text>
                    <Text style={styles.badge}>{item.target_langs[0]?.toUpperCase()}</Text>
                </View>
                <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </View>
            <Text style={styles.inputText}>{item.input_text}</Text>
            <Text style={styles.outputText}>{item.output_texts[0]}</Text>
            <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn}>
                    <Volume2 size={16} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleFav(item.id)}>
                    <Heart
                        size={16}
                        color={item.is_favorite ? '#EF4444' : '#94A3B8'}
                        fill={item.is_favorite ? '#EF4444' : 'none'}
                    />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => deleteItem(item.id)}>
                    <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={[...gradientColors]} style={styles.bg} />

            <View style={styles.content}>
                {/* Search */}
                <View style={styles.searchBar}>
                    <Search size={18} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search translations..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/* Tabs */}
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tab, filter === 'all' && styles.tabActive]}
                        onPress={() => setFilter('all')}
                    >
                        <Clock size={14} color={filter === 'all' ? '#1E293B' : '#94A3B8'} />
                        <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, filter === 'favorites' && styles.tabActive]}
                        onPress={() => setFilter('favorites')}
                    >
                        <Heart size={14} color={filter === 'favorites' ? '#EF4444' : '#94A3B8'} />
                        <Text style={[styles.tabText, filter === 'favorites' && styles.tabTextActive]}>Favorites</Text>
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
                                <Clock size={48} color="#E2E8F0" />
                                <Text style={styles.emptyText}>
                                    {filter === 'favorites' ? 'No favorites yet' : 'No history yet'}
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

    /* Search */
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderRadius: 16,
        paddingHorizontal: 14,
        height: 48,
        borderWidth: 1,
        borderColor: 'rgba(226,232,240,0.6)',
        marginBottom: 14,
    },
    searchInput: { flex: 1, fontSize: 15, color: '#1E293B', marginLeft: 10 },

    /* Tabs */
    tabs: { flexDirection: 'row', marginBottom: 16, gap: 8 },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(241,245,249,0.9)',
    },
    tabActive: {
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginLeft: 6 },
    tabTextActive: { color: '#1E293B' },

    /* Card */
    card: {
        ...glassCard,
        padding: 16,
        marginBottom: 12,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    langBadges: { flexDirection: 'row', alignItems: 'center' },
    badge: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    arrowText: { fontSize: 12, color: '#94A3B8', marginHorizontal: 6 },
    dateText: { fontSize: 11, color: '#94A3B8' },
    inputText: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
    outputText: { fontSize: 15, color: '#3B82F6', marginBottom: 10 },
    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },

    /* Empty */
    list: { paddingBottom: 20 },
    center: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
});
