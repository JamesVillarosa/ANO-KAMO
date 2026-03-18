import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    FlatList,
    TouchableOpacity,
    Modal,
} from 'react-native';
import { Text, ActivityIndicator, Snackbar, Portal, Modal as PaperModal } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
    Heart,
    Trash2,
    Volume2,
    Clock,
    X,
    AlertTriangle,
} from 'lucide-react-native';
import { getHistory, toggleFavorite, deleteHistory, clearAllHistory } from '../src/lib/api';
import { useTheme } from '../src/context/ThemeContext';
import { gradientColors, darkGradientColors, SUPPORTED_LANGUAGES, liquidGlass } from '../src/theme';

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

    const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = 'Confirm', isDestructive = true) => {
        setConfirmModal({
            visible: true,
            title,
            message,
            onConfirm,
            confirmText,
            isDestructive,
        });
    };

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
        showConfirm(
            'Delete Entry?',
            'This will permanently remove this translation from your history.',
            async () => {
                try {
                    await deleteHistory(translationId);
                    setItems(prev => prev.filter(h => h.translation_id !== translationId));
                } catch { }
            },
            'Delete',
            true
        );
    };

    const handleClearAll = async () => {
        showConfirm(
            'Clear History?',
            'This will permanently delete ALL entries in your history. This action cannot be undone.',
            async () => {
                try {
                    await clearAllHistory();
                    setItems([]);
                } catch { }
            },
            'Clear All',
            true
        );
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
            <BlurView
                intensity={isDarkMode ? 30 : 50}
                tint={isDarkMode ? 'dark' : 'light'}
                style={[styles.card, isDarkMode && styles.cardDark]}
            >
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
            </BlurView>
        );
    };

    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <LinearGradient colors={[...activeGradient]} style={styles.bg} />
            <View style={styles.content}>
                {/* Toggle Row */}
                <View style={styles.headerRow}>
                    <BlurView
                        intensity={40}
                        tint={isDarkMode ? 'dark' : 'light'}
                        style={[styles.toggleRow, isDarkMode && styles.toggleRowDark]}
                    >
                        <TouchableOpacity
                            style={[styles.toggleBtn, activeTab === 'favorites' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
                            onPress={() => setActiveTab('favorites')}
                        >
                            <Text style={[styles.toggleText, activeTab === 'favorites' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                                Favorites
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleBtn, activeTab === 'history' && (isDarkMode ? styles.toggleActiveDark : styles.toggleActive)]}
                            onPress={() => setActiveTab('history')}
                        >
                            <Text style={[styles.toggleText, activeTab === 'history' && (isDarkMode ? styles.toggleTextActiveDark : styles.toggleTextActive)]}>
                                History
                            </Text>
                        </TouchableOpacity>
                    </BlurView>
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
                        ListHeaderComponent={
                            activeTab === 'history' && items.length > 0 ? (
                                <View style={styles.clearAllRow}>
                                    <TouchableOpacity
                                        style={[styles.clearAllBtn, isDarkMode && styles.clearAllBtnDark]}
                                        onPress={handleClearAll}
                                    >
                                        <Trash2 size={14} color="#EF4444" />
                                        <Text style={styles.clearAllText}>Clear All</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null
                        }
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

            {/* Generic Glassmorphic Confirmation Modal */}
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
                        <View style={{ alignItems: 'center', marginBottom: 16 }}>
                            <AlertTriangle size={32} color={confirmModal.isDestructive ? '#EF4444' : '#3B82F6'} />
                        </View>
                        <Text style={[styles.modalTitle, isDarkMode && { color: '#F8FAFC' }]}>{confirmModal.title}</Text>
                        <Text style={[styles.modalSubtitle, isDarkMode && { color: '#94A3B8' }]}>{confirmModal.message}</Text>
                        <View style={styles.modalActions}>
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    containerDark: { backgroundColor: '#0F172A' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    content: { flex: 1, paddingTop: 100, paddingHorizontal: 20 },

    /* Header row with toggle + clear all */
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 10,
    },
    toggleRow: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: 'rgba(241,245,249,0.5)',
        borderRadius: 30,
        padding: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
    },
    toggleRowDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 26,
        alignItems: 'center',
    },
    toggleActive: {
        backgroundColor: 'rgba(255,255,255,0.45)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    toggleActiveDark: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    toggleTextActive: { color: '#1E293B' },
    toggleTextActiveDark: { color: '#F8FAFC' },

    /* Clear All row + button */
    clearAllRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 12,
    },
    clearAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.15)',
    },
    clearAllBtnDark: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    clearAllText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#EF4444',
    },

    card: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        marginBottom: 12,
        overflow: 'hidden',
    },
    cardDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.35)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowOpacity: 0.2,
    },
    accentBar: { width: 6 },
    cardContent: { flex: 1, padding: 18 },
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
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    actionBtnDark: { backgroundColor: 'rgba(255,255,255,0.05)' },
    list: { paddingBottom: 20 },
    center: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 16, fontWeight: '600', color: '#94A3B8', marginTop: 12 },

    /* Phase 8 Glass Modals */
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
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: '#64748B',
        marginBottom: 24,
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
    },
    modalBtnCancel: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(241,245,249,0.8)',
        alignItems: 'center',
        flex: 1,
    },
    modalBtnAction: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        flex: 1,
    },
    modalBtnTextCancel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    modalBtnTextAction: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFF',
    },

});
