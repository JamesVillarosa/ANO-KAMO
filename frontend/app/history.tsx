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
} from 'lucide-react-native';
import { getHistory, toggleFavorite, deleteHistory } from '../src/lib/api';
import { useTheme } from '../src/context/ThemeContext';
import { gradientColors, darkGradientColors, SUPPORTED_LANGUAGES } from '../src/theme';

interface HistoryItem {
    translation_id: string;
    input_text: string;
    input_language: string;
    method: string;
    outputs: { output_id: string, target_language: string, output_text: string, is_favorite: boolean }[];
    timestamp: string;
}

const LANG_COLORS: Record<string, string> = {
    tl: '#3B82F6',
    ceb: '#8B5CF6',
    hil: '#10B981',
    en: '#F59E0B',
};

export default function HistoryScreen() {
    const { isDarkMode } = useTheme();
    const activeGradient = isDarkMode ? darkGradientColors : gradientColors;
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getHistory();
            setItems(res || []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleToggleFav = async (outputId: string) => {
        try {
            await toggleFavorite(outputId);
            fetchData();
        } catch { }
    };

    const handleDelete = async (translationId: string) => {
        try {
            await deleteHistory(translationId);
            setItems(prev => prev.filter(h => h.translation_id !== translationId));
        } catch { }
    };

    const filtered = activeTab === 'favorites'
        ? items.filter(i => i.outputs?.some(o => o.is_favorite))
        : items;

    const renderItem = ({ item }: { item: HistoryItem }) => {
        const accent = LANG_COLORS[item.input_language] || '#3B82F6';
        const langName = SUPPORTED_LANGUAGES[item.input_language] || item.input_language;
        const firstOutput = item.outputs?.[0];
        const isFav = firstOutput?.is_favorite || false;

        return (
            <View style={[styles.card, isDarkMode && styles.cardDark]}>
                <View style={[styles.accentBar, { backgroundColor: accent }]} />
                <View style={styles.cardContent}>
                    <Text style={[styles.langLabel, { color: accent }]}>{langName}</Text>
                    <Text style={[styles.sourceText, isDarkMode && styles.textWhite]}>{item.input_text}</Text>
                    <Text style={[styles.transText, isDarkMode && styles.textSecondary]}>{firstOutput?.output_text || ''}</Text>
                    <View style={styles.cardActions}>
                        <TouchableOpacity style={[styles.actionBtn, isDarkMode && styles.actionBtnDark]}>
                            <Volume2 size={15} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, isDarkMode && styles.actionBtnDark]}
                            onPress={() => firstOutput && handleToggleFav(firstOutput.output_id)}
                        >
                            <Heart
                                size={15}
                                color={isFav ? '#EF4444' : (isDarkMode ? '#64748B' : '#94A3B8')}
                                fill={isFav ? '#EF4444' : 'none'}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, isDarkMode && styles.actionBtnDark]}
                            onPress={() => handleDelete(item.translation_id)}
                        >
                            <Trash2 size={15} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <LinearGradient colors={[...activeGradient]} style={styles.bg} />
            <View style={styles.content}>
                <View style={[styles.toggleRow, isDarkMode && styles.toggleRowDark]}>
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
                        <ActivityIndicator color={isDarkMode ? '#60A5FA' : '#3B82F6'} size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        renderItem={renderItem}
                        keyExtractor={item => item.translation_id}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.center}>
                                {activeTab === 'favorites' ? (
                                    <Heart size={48} color={isDarkMode ? '#1E293B' : '#E2E8F0'} />
                                ) : (
                                    <Clock size={48} color={isDarkMode ? '#1E293B' : '#E2E8F0'} />
                                )}
                                <Text style={[styles.emptyText, isDarkMode && styles.textSecondary]}>
                                    {activeTab === 'favorites' ? 'No favorites yet' : 'No history yet'}
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
    containerDark: { backgroundColor: '#0F172A' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    content: { flex: 1, paddingTop: 100, paddingHorizontal: 20 },
    toggleRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(241,245,249,0.9)',
        borderRadius: 30,
        padding: 4,
        marginBottom: 20,
    },
    toggleRowDark: { backgroundColor: 'rgba(30, 41, 59, 0.9)' },
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
    card: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 16,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.5)',
    },
    cardDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.85)',
        borderColor: 'rgba(51, 65, 85, 0.5)',
    },
    accentBar: { width: 5 },
    cardContent: { flex: 1, padding: 14 },
    langLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    sourceText: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 3 },
    transText: { fontSize: 14, color: '#64748B', marginBottom: 8 },
    textWhite: { color: '#F8FAFC' },
    textSecondary: { color: '#94A3B8' },
    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
    actionBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionBtnDark: { backgroundColor: '#1E293B' },
    list: { paddingBottom: 20 },
    center: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 16, fontWeight: '600', color: '#94A3B8', marginTop: 12 },
});
