import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
    StyleSheet,
    View,
    SectionList,
    TouchableOpacity,
    Modal,
    ScrollView,
    Platform,
    StatusBar,
    LayoutAnimation,
    UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Text, ActivityIndicator, Portal, Modal as PaperModal } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
    Star,
    Trash2,
    Volume2,
    Clock,
    X,
    AlertTriangle,
    Copy,
    BookOpen,
    ChevronDown,
    ChevronRight,
    MessageSquare,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { getHistory, toggleFavorite, deleteHistory, clearAllHistory, getConversationHistory } from '../src/lib/api';
import { useTheme } from '../src/context/ThemeContext';
import { gradientColors, darkGradientColors, SUPPORTED_LANGUAGES } from '../src/theme';
import { getDeviceId } from '../src/utils/device';
import { useTextToSpeech } from '../src/hooks/useTextToSpeech';

interface HistoryOutput {
    output_id: string;
    target_language: string;
    output_text: string;
    detected_tone?: string;
    is_favorite: boolean;
}

interface HistoryItem {
    translation_id: string;
    input_text: string;
    input_language: string;
    method: string;
    translation_type: string;
    outputs: HistoryOutput[];
    timestamp: string;
}

interface Section {
    title: string;
    data: HistoryItem[];
}

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
    text: { label: 'Text', color: '#007AFF' },
    ocr:  { label: 'OCR',  color: '#FF3B30' },
    chat: { label: 'Chat', color: '#FF9500' },
};

function normalizeTimestamp(ts: string): Date {
    // SQLite returns naive datetimes (no timezone suffix). JavaScript on iOS
    // interprets those as local time, but they are actually stored in UTC.
    // Append 'Z' so they are correctly parsed as UTC.
    if (!ts.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(ts)) {
        return new Date(ts + 'Z');
    }
    return new Date(ts);
}

function formatTimestamp(ts: string): string {
    const d = normalizeTimestamp(ts);
    const now = new Date();
    // Compare calendar dates (not elapsed ms) to correctly handle "Today"/"Yesterday"
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const itemMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((todayMidnight.getTime() - itemMidnight.getTime()) / (1000 * 60 * 60 * 24));
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return `Today ${timeStr}`;
    if (diffDays === 1) return `Yesterday ${timeStr}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getSectionTitle(ts: string): string {
    const d = normalizeTimestamp(ts);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const itemMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((todayMidnight.getTime() - itemMidnight.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'long', day: 'numeric' });
}

interface ConvMessage {
    message_id: string;
    speaker_abc: string;
    text: string;
    translated_text: string;
    language: string;
    timestamp: string;
}

interface ConvParticipant {
    speaker_label: string;
    preferred_language: string;
}

interface ConversationGroup {
    conversation_id: string;
    mode: string;
    started_at: string;
    participants: ConvParticipant[];
    messages: ConvMessage[];
}

function ConversationGroupCard({
    group,
    isExpanded,
    onToggle,
    isDarkMode,
}: {
    group: ConversationGroup;
    isExpanded: boolean;
    onToggle: () => void;
    isDarkMode: boolean;
}) {
    const timestamp = formatTimestamp(group.started_at);
    const langs = group.participants.map(p =>
        (SUPPORTED_LANGUAGES as Record<string, string>)[p.preferred_language] || p.preferred_language.toUpperCase()
    ).join(' · ');
    const firstMsg = group.messages[0];
    const msgCount = group.messages.length;

    return (
        <BlurView
            intensity={isDarkMode ? 30 : 50}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.card, isDarkMode && styles.cardDark]}
        >
            {/* Collapsed header — always visible */}
            <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
                <View style={styles.cardTopRow}>
                    <View style={[styles.typeBadge, { backgroundColor: '#FF9500' }]}>
                        <MessageSquare size={10} color="#FFF" />
                        <Text style={styles.typeBadgeText}>Chat</Text>
                    </View>
                    <Text style={[styles.timestampText, isDarkMode && styles.textSecondary]}>
                        {timestamp}
                    </Text>
                </View>
                <Text style={[styles.langLabel, { color: '#FF9500' }]} numberOfLines={1}>
                    {langs}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text
                        style={[styles.sourceText, isDarkMode && styles.textWhite, { flex: 1 }]}
                        numberOfLines={1}
                    >
                        {firstMsg?.text ?? ''}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.timestampText, isDarkMode && styles.textSecondary]}>
                            {msgCount} msg{msgCount !== 1 ? 's' : ''}
                        </Text>
                        {isExpanded
                            ? <ChevronDown size={14} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                            : <ChevronRight size={14} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                        }
                    </View>
                </View>
            </TouchableOpacity>

            {/* Expanded: mini chat log */}
            {isExpanded && (
                <ScrollView
                    style={styles.convChatLog}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                >
                    {(() => {
                        // Deduplicate by message_id to prevent doubled messages
                        const seenIds = new Set<string>();
                        return group.messages.filter(m => {
                            if (seenIds.has(m.message_id)) return false;
                            seenIds.add(m.message_id);
                            return true;
                        });
                    })().map((msg) => {
                        const isA = msg.speaker_abc === 'A';
                        return (
                            <View
                                key={msg.message_id}
                                style={[
                                    styles.convMsgRow,
                                    isA ? styles.convMsgRight : styles.convMsgLeft,
                                ]}
                            >
                                <View style={[
                                    styles.convBubble,
                                    { backgroundColor: isA ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.12)' },
                                    isDarkMode && { backgroundColor: isA ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.07)' },
                                ]}>
                                    <Text style={[styles.convSpeakerLabel, { color: isA ? '#3B82F6' : '#64748B' }]}>
                                        {msg.speaker_abc}
                                    </Text>
                                    <Text style={[styles.convMsgText, isDarkMode && styles.textWhite]}>
                                        {msg.text}
                                    </Text>
                                    {!!msg.translated_text && (
                                        <Text style={[styles.convMsgTrans, isDarkMode && styles.textSecondary]}>
                                            {msg.translated_text}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </BlurView>
    );
}

function groupBySections(items: HistoryItem[]): Section[] {
    const map = new Map<string, HistoryItem[]>();
    for (const item of items) {
        const key = getSectionTitle(item.timestamp);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

export default function HistoryScreen() {
    const { isDarkMode } = useTheme();
    const tts = useTextToSpeech();
    const activeGradient = isDarkMode ? darkGradientColors : gradientColors;
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [convGroups, setConvGroups] = useState<ConversationGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');
    const [expandedConvId, setExpandedConvId] = useState<string | null>(null);
    const [detailItem, setDetailItem] = useState<HistoryItem | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        visible: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText: string;
        isDestructive?: boolean;
    }>({
        visible: false, title: '', message: '', onConfirm: () => {}, confirmText: 'Confirm',
    });

    const showConfirm = (
        title: string, message: string, onConfirm: () => void,
        confirmText = 'Confirm', isDestructive = true,
    ) => {
        setConfirmModal({ visible: true, title, message, onConfirm, confirmText, isDestructive });
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const deviceId = await getDeviceId();
            const [res, convRes] = await Promise.all([
                getHistory(0, 200, deviceId),
                getConversationHistory(deviceId).catch(() => []),
            ]);
            setItems(res || []);
            setConvGroups(convRes || []);
        } catch {
            setItems([]);
            setConvGroups([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Re-fetch every time the tab comes into focus so new translations appear immediately
    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const handleToggleFav = async (outputId: string) => {
        try {
            await toggleFavorite(outputId);
            fetchData();
        } catch {}
    };

    const handleDelete = (translationId: string) => {
        showConfirm(
            'Delete Entry?',
            'This will permanently remove this translation from your history.',
            async () => {
                try {
                    const deviceId = await getDeviceId();
                    await deleteHistory(translationId, deviceId);
                    setItems(prev => prev.filter(h => h.translation_id !== translationId));
                } catch {}
            },
            'Delete', true,
        );
    };

    const handleClearAll = () => {
        showConfirm(
            'Clear History',
            'Are you sure you want to delete all translation history? This cannot be undone.',
            async () => {
                try {
                    const deviceId = await getDeviceId();
                    await clearAllHistory(deviceId);
                    setItems([]);
                } catch {}
            },
            'Clear All', true,
        );
    };

    const filtered = activeTab === 'favorites'
        ? items.filter(i => i.outputs?.some(o => o.is_favorite))
        : items;

    const sections = groupBySections(filtered);

    const renderItem = ({ item }: { item: HistoryItem }) => {
        const type = item.translation_type || 'text';
        const badge = TYPE_BADGE[type] || TYPE_BADGE.text;
        const firstOutput = item.outputs?.[0];
        const isFav = item.outputs?.some(o => o.is_favorite) ?? false;
        const timestamp = formatTimestamp(item.timestamp);
        const srcLangName = SUPPORTED_LANGUAGES[item.input_language] || item.input_language.toUpperCase();

        return (
            <TouchableOpacity onPress={() => setDetailItem(item)} activeOpacity={0.85}>
                <BlurView
                    intensity={isDarkMode ? 30 : 50}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[styles.card, isDarkMode && styles.cardDark]}
                >
                    {/* Top row: badge + timestamp */}
                    <View style={styles.cardTopRow}>
                        <View style={[styles.typeBadge, { backgroundColor: badge.color }]}>
                            <Text style={styles.typeBadgeText}>{badge.label}</Text>
                        </View>
                        <Text style={[styles.timestampText, isDarkMode && styles.textSecondary]}>
                            {timestamp}
                        </Text>
                    </View>

                    {/* Source */}
                    <Text style={[styles.langLabel, { color: badge.color }]}>
                        {srcLangName.toUpperCase()}
                    </Text>
                    <Text
                        style={[styles.sourceText, isDarkMode && styles.textWhite]}
                        numberOfLines={2}
                    >
                        {item.input_text}
                    </Text>

                    {/* All Outputs */}
                    {item.outputs?.map((output) => {
                        const langName = SUPPORTED_LANGUAGES[output.target_language] || output.target_language.toUpperCase();
                        return (
                            <React.Fragment key={output.output_id}>
                                <Text style={[styles.tgtLangLabel, isDarkMode && { color: '#818CF8' }]}>
                                    {langName.toUpperCase()}
                                </Text>
                                <Text
                                    style={[styles.transText, isDarkMode && styles.textSecondary]}
                                    numberOfLines={1}
                                >
                                    {output.output_text}
                                </Text>
                            </React.Fragment>
                        );
                    })}

                    {/* Bottom row: fav + delete */}
                    <View style={styles.cardActions}>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity
                            style={[styles.actionBtn, isDarkMode && styles.actionBtnDark]}
                            onPress={() => firstOutput && handleToggleFav(firstOutput.output_id)}
                        >
                            <Star
                                size={15}
                                color={isFav ? '#F59E0B' : (isDarkMode ? '#64748B' : '#94A3B8')}
                                fill={isFav ? '#F59E0B' : 'none'}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, isDarkMode && styles.actionBtnDark]}
                            onPress={() => handleDelete(item.translation_id)}
                        >
                            <Trash2 size={15} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </TouchableOpacity>
        );
    };

    const renderSectionHeader = ({ section }: { section: Section }) => (
        <Text style={[styles.sectionHeader, isDarkMode && { color: '#64748B' }]}>
            {section.title.toUpperCase()}
        </Text>
    );

    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <LinearGradient colors={[...activeGradient]} style={styles.bg} />
            <View style={styles.content}>
                {/* Tabs */}
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
                ) : activeTab === 'favorites' ? (
                    filtered.length === 0 ? (
                        <View style={styles.center}>
                            <Clock size={52} color={isDarkMode ? '#334155' : '#E2E8F0'} />
                            <Text style={[styles.emptyText, isDarkMode && styles.textSecondary]}>
                                No favorites yet
                            </Text>
                            <Text style={[styles.emptySubText, isDarkMode && { color: '#475569' }]}>
                                Star a translation to save it here
                            </Text>
                        </View>
                    ) : (
                        <SectionList
                            sections={sections}
                            renderItem={renderItem}
                            renderSectionHeader={renderSectionHeader}
                            keyExtractor={item => item.translation_id}
                            contentContainerStyle={styles.list}
                            showsVerticalScrollIndicator={false}
                            stickySectionHeadersEnabled={false}
                        />
                    )
                ) : (() => {
                    // Build unified history: non-chat items + conversation groups, sorted by date
                    type MixedItem =
                        | { type: 'single'; item: HistoryItem; timestamp: string }
                        | { type: 'conversation'; group: ConversationGroup; timestamp: string };

                    const singleItems: MixedItem[] = items
                        .filter(i => i.translation_type !== 'chat')
                        .map(i => ({ type: 'single' as const, item: i, timestamp: i.timestamp }));

                    const convItems: MixedItem[] = convGroups.map(g => ({
                        type: 'conversation' as const,
                        group: g,
                        timestamp: g.messages.length > 0
                            ? g.messages[g.messages.length - 1].timestamp
                            : g.started_at,
                    }));

                    const all: MixedItem[] = [...singleItems, ...convItems].sort(
                        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );

                    if (all.length === 0) {
                        return (
                            <View style={styles.center}>
                                <Clock size={52} color={isDarkMode ? '#334155' : '#E2E8F0'} />
                                <Text style={[styles.emptyText, isDarkMode && styles.textSecondary]}>
                                    No translation history yet
                                </Text>
                                <Text style={[styles.emptySubText, isDarkMode && { color: '#475569' }]}>
                                    Start translating to see your history here
                                </Text>
                            </View>
                        );
                    }

                    // Group into date sections
                    const sectionMap = new Map<string, MixedItem[]>();
                    for (const item of all) {
                        const key = getSectionTitle(item.timestamp);
                        if (!sectionMap.has(key)) sectionMap.set(key, []);
                        sectionMap.get(key)!.push(item);
                    }

                    return (
                        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                            <View style={styles.clearAllRow}>
                                <TouchableOpacity
                                    style={[styles.clearAllBtn, isDarkMode && styles.clearAllBtnDark]}
                                    onPress={handleClearAll}
                                >
                                    <Trash2 size={14} color="#EF4444" />
                                    <Text style={styles.clearAllText}>Clear All</Text>
                                </TouchableOpacity>
                            </View>
                            {Array.from(sectionMap.entries()).map(([sectionTitle, sectionItems]) => (
                                <View key={sectionTitle}>
                                    <Text style={[styles.sectionHeader, isDarkMode && { color: '#64748B' }]}>
                                        {sectionTitle.toUpperCase()}
                                    </Text>
                                    {sectionItems.map((displayItem) => {
                                        if (displayItem.type === 'conversation') {
                                            return (
                                                <ConversationGroupCard
                                                    key={displayItem.group.conversation_id}
                                                    group={displayItem.group}
                                                    isExpanded={expandedConvId === displayItem.group.conversation_id}
                                                    isDarkMode={isDarkMode}
                                                    onToggle={() => {
                                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                        setExpandedConvId(prev =>
                                                            prev === displayItem.group.conversation_id
                                                                ? null
                                                                : displayItem.group.conversation_id
                                                        );
                                                    }}
                                                />
                                            );
                                        }
                                        return (
                                            <React.Fragment key={displayItem.item.translation_id}>
                                                {renderItem({ item: displayItem.item } as any)}
                                            </React.Fragment>
                                        );
                                    })}
                                </View>
                            ))}
                        </ScrollView>
                    );
                })()}
            </View>

            {/* Detail Modal */}
            <Modal
                visible={!!detailItem}
                transparent
                animationType="slide"
                onRequestClose={() => setDetailItem(null)}
            >
                {detailItem && (
                    <View style={styles.detailOverlay}>
                        <BlurView
                            intensity={80}
                            tint={isDarkMode ? 'dark' : 'light'}
                            style={[styles.detailModal, isDarkMode && styles.detailModalDark]}
                        >
                            <View style={styles.detailHandle} />
                            <View style={styles.detailHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={[
                                        styles.typeBadge,
                                        { backgroundColor: (TYPE_BADGE[detailItem.translation_type || 'text'] || TYPE_BADGE.text).color }
                                    ]}>
                                        <Text style={styles.typeBadgeText}>
                                            {(TYPE_BADGE[detailItem.translation_type || 'text'] || TYPE_BADGE.text).label}
                                        </Text>
                                    </View>
                                    <Text style={[styles.detailTimestamp, isDarkMode && styles.textSecondary]}>
                                        {formatTimestamp(detailItem.timestamp)}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setDetailItem(null)}>
                                    <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Source */}
                                <Text style={[styles.detailLangLabel, isDarkMode && { color: '#60A5FA' }]}>
                                    {(SUPPORTED_LANGUAGES[detailItem.input_language] || detailItem.input_language).toUpperCase()}
                                </Text>
                                <Text style={[styles.detailSourceText, isDarkMode && styles.textWhite]}>
                                    {detailItem.input_text}
                                </Text>
                                <View style={styles.detailActions}>
                                    <TouchableOpacity
                                        style={[styles.detailBtn, isDarkMode && styles.detailBtnDark]}
                                        onPress={() => tts.speak(detailItem.input_text, detailItem.input_language)}
                                    >
                                        <Volume2 size={15} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                                        <Text style={[styles.detailBtnText, isDarkMode && styles.textSecondary]}>Speak</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.detailBtn, isDarkMode && styles.detailBtnDark]}
                                        onPress={() => Clipboard.setStringAsync(detailItem.input_text)}
                                    >
                                        <Copy size={15} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                                        <Text style={[styles.detailBtnText, isDarkMode && styles.textSecondary]}>Copy</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Outputs */}
                                {detailItem.outputs.map(output => (
                                    <View key={output.output_id} style={[styles.outputBlock, isDarkMode && styles.outputBlockDark]}>
                                        <Text style={[styles.detailLangLabel, isDarkMode && { color: '#818CF8' }]}>
                                            {(SUPPORTED_LANGUAGES[output.target_language] || output.target_language).toUpperCase()}
                                        </Text>
                                        <Text style={[styles.detailTransText, isDarkMode && styles.textSecondary]}>
                                            {output.output_text}
                                        </Text>
                                        <View style={styles.detailActions}>
                                            <TouchableOpacity
                                                style={[styles.detailBtn, isDarkMode && styles.detailBtnDark]}
                                                onPress={() => tts.speak(output.output_text, output.target_language)}
                                            >
                                                <Volume2 size={15} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                                                <Text style={[styles.detailBtnText, isDarkMode && styles.textSecondary]}>Speak</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.detailBtn, isDarkMode && styles.detailBtnDark]}
                                                onPress={() => Clipboard.setStringAsync(output.output_text)}
                                            >
                                                <Copy size={15} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                                                <Text style={[styles.detailBtnText, isDarkMode && styles.textSecondary]}>Copy</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.detailBtn, isDarkMode && styles.detailBtnDark]}
                                                onPress={() => handleToggleFav(output.output_id)}
                                            >
                                                <Star
                                                    size={15}
                                                    color={output.is_favorite ? '#F59E0B' : (isDarkMode ? '#64748B' : '#94A3B8')}
                                                    fill={output.is_favorite ? '#F59E0B' : 'none'}
                                                />
                                                <Text style={[styles.detailBtnText, isDarkMode && styles.textSecondary]}>
                                                    {output.is_favorite ? 'Saved' : 'Save'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        </BlurView>
                    </View>
                )}
            </Modal>

            {/* Confirmation Modal */}
            <Portal>
                <PaperModal
                    visible={confirmModal.visible}
                    onDismiss={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
                    contentContainerStyle={styles.glassModalContainer}
                >
                    <BlurView intensity={60} tint={isDarkMode ? 'dark' : 'light'} style={styles.glassModalBlur}>
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
                                style={[styles.modalBtnAction, confirmModal.isDestructive && { backgroundColor: '#EF4444' }]}
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
    content: { flex: 1, paddingTop: 100, paddingHorizontal: 16 },

    headerRow: { marginBottom: 16 },
    toggleRow: {
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
    toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 26, alignItems: 'center' },
    toggleActive: {
        backgroundColor: 'rgba(255,255,255,0.45)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    toggleActiveDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
    toggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    toggleTextActive: { color: '#1E293B' },
    toggleTextActiveDark: { color: '#F8FAFC' },

    clearAllRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
    clearAllBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.15)',
    },
    clearAllBtnDark: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    clearAllText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },

    sectionHeader: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 1.2,
        marginTop: 16,
        marginBottom: 8,
        marginLeft: 4,
    },

    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        marginBottom: 10,
        overflow: 'hidden',
        padding: 14,
    },
    cardDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.35)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },

    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },

    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    typeBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },

    timestampText: { fontSize: 12, color: '#64748B' },

    langLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 3,
    },
    tgtLangLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 8,
        marginBottom: 3,
        color: '#818CF8',
    },
    sourceText: { fontSize: 15, fontWeight: '600', color: '#1E293B', lineHeight: 22 },
    transText: { fontSize: 14, color: '#64748B', lineHeight: 20 },
    textWhite: { color: '#F8FAFC' },
    textSecondary: { color: '#94A3B8' },

    // ── Conversation Group Card ──
    convChatLog: {
        maxHeight: 320,
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
        paddingTop: 8,
    },
    convMsgRow: { marginBottom: 8 },
    convMsgLeft: { alignItems: 'flex-start' },
    convMsgRight: { alignItems: 'flex-end' },
    convBubble: {
        maxWidth: '82%',
        borderRadius: 14,
        padding: 10,
    },
    convSpeakerLabel: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 2,
        opacity: 0.7,
    },
    convMsgText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1E293B',
        lineHeight: 18,
    },
    convMsgTrans: {
        fontSize: 12,
        color: '#64748B',
        lineHeight: 17,
        marginTop: 3,
        fontStyle: 'italic',
    },

    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 10 },
    actionBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.5)',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    actionBtnDark: { backgroundColor: 'rgba(255,255,255,0.05)' },

    list: { paddingBottom: 100 },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
    emptyText: { fontSize: 17, fontWeight: '700', color: '#94A3B8', marginTop: 16 },
    emptySubText: { fontSize: 13, color: '#CBD5E1', marginTop: 6, textAlign: 'center' },

    /* Detail Modal */
    detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    detailModal: {
        backgroundColor: 'rgba(255,255,255,0.75)',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: 40,
        maxHeight: '85%',
        overflow: 'hidden',
    },
    detailModalDark: { backgroundColor: 'rgba(15, 23, 42, 0.75)' },
    detailHandle: {
        width: 40, height: 4,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    detailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    detailTimestamp: { fontSize: 13, color: '#64748B' },
    detailLangLabel: {
        fontSize: 11, fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: 0.8,
        color: '#60A5FA', marginBottom: 6,
    },
    detailSourceText: { fontSize: 17, fontWeight: '600', color: '#1E293B', lineHeight: 26, marginBottom: 10 },
    detailTransText: { fontSize: 15, color: '#64748B', lineHeight: 24, marginBottom: 10 },
    detailActions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    detailBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    detailBtnDark: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' },
    detailBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    outputBlock: {
        marginTop: 16,
        padding: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    outputBlockDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        borderColor: 'rgba(255,255,255,0.08)',
    },

    /* Confirmation Modal */
    glassModalContainer: { margin: 20, borderRadius: 28 },
    glassModalBlur: { padding: 24 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 8, textAlign: 'center' },
    modalSubtitle: { fontSize: 14, lineHeight: 20, color: '#64748B', marginBottom: 24, textAlign: 'center' },
    modalActions: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
    modalBtnCancel: {
        paddingHorizontal: 20, paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(241,245,249,0.8)',
        alignItems: 'center', flex: 1,
    },
    modalBtnAction: {
        paddingHorizontal: 20, paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: '#EF4444',
        alignItems: 'center', flex: 1,
    },
    modalBtnTextCancel: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
    modalBtnTextAction: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
