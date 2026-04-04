import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
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

    BackHandler,
} from 'react-native';

import { Text, ActivityIndicator, Portal, Modal as PaperModal } from 'react-native-paper';
import { GlassBlur as BlurView } from '../src/components/GlassBlur';
import FluidAura from '../src/components/FluidAura';
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
import { getHistory, toggleFavorite, deleteHistory, clearAllHistory, getConversationHistory, deleteConversation, toggleConversationStar, clearAllConversations } from '../src/lib/api';
import { useTheme } from '../src/context/ThemeContext';
import { SUPPORTED_LANGUAGES, LANGUAGE_COLORS } from '../src/theme';
import { useConversation, Message } from '../src/context/ConversationContext';
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
    _allIds?: string[]; // merged translation_ids (for 3-way chat dedup)
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
    translations?: { lang: string; text: string }[];
    language: string;
    timestamp: string;
}

// Single-letter language initials shown in the mini bubble header
const LANG_INITIALS: Record<string, string> = {
    tl: 'T', en: 'E', ceb: 'C', hil: 'H',
};

interface ConvParticipant {
    speaker_label: string;
    preferred_language: string;
}

interface ConversationGroup {
    conversation_id: string;
    mode: string;
    started_at: string;
    is_starred: boolean;
    participants: ConvParticipant[];
    messages: ConvMessage[];
}

function ConversationGroupCard({
    group,
    isExpanded,
    onToggle,
    isDarkMode,
    onDelete,
    onToggleStar,
}: {
    group: ConversationGroup;
    isExpanded: boolean;
    onToggle: () => void;
    isDarkMode: boolean;
    onDelete: () => void;
    onToggleStar: () => void;
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
            <View style={styles.cardActions}>
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={[styles.actionBtn, isDarkMode && styles.actionBtnDark]} onPress={onToggleStar}>
                    <Star
                        size={15}
                        color={group.is_starred ? '#F59E0B' : (isDarkMode ? '#64748B' : '#94A3B8')}
                        fill={group.is_starred ? '#F59E0B' : 'none'}
                    />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, isDarkMode && styles.actionBtnDark]} onPress={onDelete}>
                    <Trash2 size={15} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                </TouchableOpacity>
            </View>

            {/* Expanded: mini chat log */}
            {isExpanded && (
                <ScrollView
                    style={styles.convChatLog}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                >
                    {(() => {
                        const seenIds = new Set<string>();
                        return group.messages.filter(m => {
                            if (seenIds.has(m.message_id)) return false;
                            seenIds.add(m.message_id);
                            return true;
                        });
                    })().map((msg) => {
                        const speakerAbc = msg.speaker_abc;
                        const isA = speakerAbc === 'A';
                        const isC = speakerAbc === 'C';
                        const srcInitial = LANG_INITIALS[msg.language] ?? msg.language.slice(0, 1).toUpperCase();

                        // Fallback target lang: pick the first participant whose index differs from speaker
                        const speakerIdx = isA ? 0 : isC ? 2 : 1;
                        const fallbackTargetLang =
                            group.participants.find((_, i) => i !== speakerIdx)?.preferred_language ?? '?';

                        // Use parsed translations array; fall back to translated_text for old records
                        const transList: { lang: string; text: string }[] =
                            msg.translations && msg.translations.length > 0
                                ? msg.translations
                                : msg.translated_text
                                    ? [{ lang: fallbackTargetLang, text: msg.translated_text }]
                                    : [];

                        // Color from message language (matches conversation screen language colors)
                        const msgLangColor = LANGUAGE_COLORS[msg.language];
                        const bubbleBg = msgLangColor
                            ? msgLangColor.bg.replace('0.42', '0.2')
                            : isA ? 'rgba(59,130,246,0.15)' : isC ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
                        const bubbleBgDark = msgLangColor
                            ? msgLangColor.bg.replace('0.42', '0.28')
                            : isA ? 'rgba(59,130,246,0.25)' : isC ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)';
                        const labelCol = msgLangColor?.light ?? (isA ? '#3B82F6' : isC ? '#D97706' : '#EF4444');

                        return (
                            <View
                                key={msg.message_id}
                                style={[
                                    styles.convMsgRow,
                                    isA ? styles.convMsgRight : isC ? styles.convMsgCenter : styles.convMsgLeft,
                                ]}
                            >
                                <View style={[
                                    styles.convBubble,
                                    { backgroundColor: bubbleBg },
                                    isDarkMode && { backgroundColor: bubbleBgDark },
                                ]}>
                                    {/* Source language initial */}
                                    <Text style={[styles.convSpeakerLabel, { color: labelCol }]}>
                                        {srcInitial}
                                    </Text>
                                    {/* Source text — bold */}
                                    <Text style={[styles.convMsgText, isDarkMode && styles.textWhite]}>
                                        {msg.text}
                                    </Text>
                                    {/* One row per translation */}
                                    {transList.map((tr, idx) => (
                                        <View key={idx} style={styles.convTransRow}>
                                            <Text style={[styles.convTransInitial, isDarkMode && { color: '#8E8E93' }]}>
                                                {LANG_INITIALS[tr.lang] ?? tr.lang.slice(0, 1).toUpperCase()}
                                            </Text>
                                            <Text style={[styles.convMsgTrans, { flexShrink: 1 }, isDarkMode && styles.textSecondary]}>
                                                {tr.text}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </BlurView>
    );
}

// Merge duplicate chat items that share the same input_text/input_language
// and were created within 5 seconds of each other (3-way chat creates one record per target lang)
function mergeChatDuplicates(items: HistoryItem[]): HistoryItem[] {
    const result: HistoryItem[] = [];
    for (const item of items) {
        if (item.translation_type !== 'chat') {
            result.push(item);
            continue;
        }
        const existing = result.find(r =>
            r.translation_type === 'chat' &&
            r.input_text === item.input_text &&
            r.input_language === item.input_language &&
            Math.abs(
                normalizeTimestamp(r.timestamp).getTime() -
                normalizeTimestamp(item.timestamp).getTime()
            ) < 5000
        );
        if (existing) {
            // Merge outputs, skipping duplicate target languages
            for (const out of item.outputs) {
                if (!existing.outputs.some(o => o.target_language === out.target_language)) {
                    existing.outputs.push(out);
                }
            }
            // Track all merged IDs so delete can remove all underlying records
            if (!existing._allIds) existing._allIds = [existing.translation_id];
            existing._allIds.push(item.translation_id);
        } else {
            result.push({ ...item, outputs: [...item.outputs] });
        }
    }
    return result;
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
    const router = useRouter();
    const tts = useTextToSpeech();
    const {
        messages: ctxMessages,
        conversationId: ctxConvId,
        langs: ctxLangs,
        viewMode: ctxViewMode,
    } = useConversation();
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
            setItems(mergeChatDuplicates(res || []));
            setConvGroups(convRes || []);
        } catch {
            setItems([]);
            setConvGroups([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Overlay context messages onto the matching conversation group so history always
    // reflects the current session state (including retroactively-regenerated translations)
    const effectiveConvGroups = useMemo<ConversationGroup[]>(() => {
        if (!ctxConvId || ctxMessages.length === 0) return convGroups;
        return convGroups.map(group => {
            if (group.conversation_id !== ctxConvId) return group;
            // Map context Message[] → ConvMessage[]
            const ctxConvMessages: ConvMessage[] = ctxMessages
                .filter(m => m.mode !== 'face_to_face')
                .map(m => ({
                    message_id: m.id,
                    speaker_abc: m.speaker === 0 ? 'A' : m.speaker === 1 ? 'B' : 'C',
                    text: m.text,
                    translated_text: m.translations[0]?.text ?? '',
                    translations: m.translations.length > 0 ? m.translations : undefined,
                    language: m.lang,
                    timestamp: group.messages[0]?.timestamp ?? group.started_at,
                }));
            // Update participants to reflect current languages in the session
            const numParticipants = ctxViewMode === 'three_way' ? 3 : 2;
            const ctxParticipants: ConvParticipant[] = Array.from({ length: numParticipants }, (_, i) => ({
                speaker_label: (['A', 'B', 'C'] as const)[i],
                preferred_language: ctxLangs[i as 0 | 1 | 2],
            }));
            return { ...group, messages: ctxConvMessages, participants: ctxParticipants };
        });
    }, [convGroups, ctxConvId, ctxMessages, ctxLangs, ctxViewMode]);

    // Re-fetch every time the tab comes into focus so new translations appear immediately
    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    // Android hardware back button: dismiss modals first, then go back
    useEffect(() => {
        const onBack = () => {
            if (confirmModal.visible) {
                setConfirmModal(prev => ({ ...prev, visible: false }));
                return true;
            }
            if (detailItem) {
                setDetailItem(null);
                return true;
            }
            router.back();
            return true;
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
        return () => sub.remove();
    }, [confirmModal.visible, detailItem, router]);

    const handleToggleFav = async (outputId: string) => {
        const toggle = (prev: HistoryItem[]) => prev.map(item => ({
            ...item,
            outputs: item.outputs.map(o =>
                o.output_id === outputId ? { ...o, is_favorite: !o.is_favorite } : o
            ),
        }));
        const toggleDetail = (prev: HistoryItem | null) => prev ? {
            ...prev,
            outputs: prev.outputs.map(o =>
                o.output_id === outputId ? { ...o, is_favorite: !o.is_favorite } : o
            ),
        } : null;
        // Optimistic update — reflect immediately in UI
        setItems(toggle);
        setDetailItem(toggleDetail);
        try {
            await toggleFavorite(outputId);
        } catch {
            // Revert on error
            setItems(toggle);
            setDetailItem(toggleDetail);
        }
    };

    const handleDelete = (item: HistoryItem) => {
        showConfirm(
            'Delete Entry?',
            'This will permanently remove this translation from your history.',
            async () => {
                try {
                    const deviceId = await getDeviceId();
                    const idsToDelete = item._allIds ?? [item.translation_id];
                    await Promise.all(idsToDelete.map(id => deleteHistory(id, deviceId)));
                    setItems(prev => prev.filter(h => h.translation_id !== item.translation_id));
                } catch {}
            },
            'Delete', true,
        );
    };

    const handleDeleteConversation = (convId: string) => {
        showConfirm(
            'Delete Conversation?',
            'This will permanently remove this conversation and all its messages.',
            async () => {
                try {
                    const deviceId = await getDeviceId();
                    await deleteConversation(convId, deviceId);
                    setConvGroups(prev => prev.filter(g => g.conversation_id !== convId));
                } catch {}
            },
            'Delete', true,
        );
    };

    const handleToggleConvStar = async (convId: string) => {
        try {
            await toggleConversationStar(convId);
            setConvGroups(prev => prev.map(g =>
                g.conversation_id === convId ? { ...g, is_starred: !g.is_starred } : g
            ));
        } catch {}
    };

    const handleClearAll = () => {
        showConfirm(
            'Clear History',
            'Are you sure you want to delete all history? This cannot be undone.',
            async () => {
                try {
                    const deviceId = await getDeviceId();
                    await Promise.all([
                        clearAllHistory(deviceId),
                        clearAllConversations(deviceId),
                    ]);
                    setItems([]);
                    setConvGroups([]);
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
                            onPress={() => handleDelete(item)}
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
            <FluidAura isDarkMode={isDarkMode} />
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
                ) : activeTab === 'favorites' ? (() => {
                    const starredConvs = effectiveConvGroups.filter(g => g.is_starred);
                    const favItems = items.filter(i => i.outputs?.some(o => o.is_favorite));
                    const favSections = groupBySections(favItems);

                    if (starredConvs.length === 0 && favItems.length === 0) {
                        return (
                            <View style={styles.center}>
                                <Clock size={52} color={isDarkMode ? '#334155' : '#E2E8F0'} />
                                <Text style={[styles.emptyText, isDarkMode && styles.textSecondary]}>
                                    No favorites yet
                                </Text>
                                <Text style={[styles.emptySubText, isDarkMode && { color: '#475569' }]}>
                                    Star a translation to save it here
                                </Text>
                            </View>
                        );
                    }

                    return (
                        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                            {starredConvs.length > 0 && (
                                <View>
                                    <Text style={[styles.sectionHeader, isDarkMode && { color: '#64748B' }]}>
                                        CONVERSATIONS
                                    </Text>
                                    {starredConvs.map(group => (
                                        <ConversationGroupCard
                                            key={group.conversation_id}
                                            group={group}
                                            isExpanded={expandedConvId === group.conversation_id}
                                            isDarkMode={isDarkMode}
                                            onToggle={() => {
                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                setExpandedConvId(prev =>
                                                    prev === group.conversation_id ? null : group.conversation_id
                                                );
                                            }}
                                            onDelete={() => handleDeleteConversation(group.conversation_id)}
                                            onToggleStar={() => handleToggleConvStar(group.conversation_id)}
                                        />
                                    ))}
                                </View>
                            )}
                            {favSections.map(section => (
                                <View key={section.title}>
                                    <Text style={[styles.sectionHeader, isDarkMode && { color: '#64748B' }]}>
                                        {section.title.toUpperCase()}
                                    </Text>
                                    {section.data.map(item => (
                                        <React.Fragment key={item.translation_id}>
                                            {renderItem({ item } as any)}
                                        </React.Fragment>
                                    ))}
                                </View>
                            ))}
                        </ScrollView>
                    );
                })() : (() => {
                    // Build unified history: non-chat items + conversation groups, sorted by date
                    type MixedItem =
                        | { type: 'single'; item: HistoryItem; timestamp: string }
                        | { type: 'conversation'; group: ConversationGroup; timestamp: string };

                    const singleItems: MixedItem[] = items
                        .filter(i => i.translation_type !== 'chat')
                        .map(i => ({ type: 'single' as const, item: i, timestamp: i.timestamp }));

                    const convItems: MixedItem[] = effectiveConvGroups.map(g => ({
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
                                                    onDelete={() => handleDeleteConversation(displayItem.group.conversation_id)}
                                                    onToggleStar={() => handleToggleConvStar(displayItem.group.conversation_id)}
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

            {/* Detail Modal — conditionally rendered so it never intercepts back button when closed */}
            {detailItem && (
            <Modal
                visible
                transparent
                animationType="slide"
                onRequestClose={() => setDetailItem(null)}
            >
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
            </Modal>
            )}

            {/* Confirmation Modal */}
            <Portal>
                <PaperModal
                    visible={confirmModal.visible}
                    onDismiss={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
                    contentContainerStyle={styles.glassModalContainer}
                >
                    <BlurView intensity={60} tint={isDarkMode ? 'dark' : 'light'} style={[styles.glassModalBlur, isDarkMode && styles.glassModalBlurDark]}>
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
    },
    toggleRowDark: {
        backgroundColor: 'rgba(255,255,255,0.09)',
        borderColor: 'rgba(255,255,255,0.12)',
    },
    toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 26, alignItems: 'center' },
    toggleActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    toggleActiveDark: {
        backgroundColor: 'rgba(255,255,255,0.22)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
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
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
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
        backgroundColor: '#1E293B',
        borderColor: 'rgba(255,255,255,0.1)',
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
    convMsgCenter: { alignItems: 'center' },
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
        fontStyle: 'italic',
    },
    convTransRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 5,
        marginTop: 3,
        flexShrink: 1,
    },
    convTransInitial: {
        fontSize: 9,
        fontWeight: '700',
        color: '#8E8E93',
        minWidth: 10,
        marginTop: 2,
    },

    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 10 },
    actionBtn: {
        width: 32, height: 32, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },
    actionBtnDark: {},

    list: { paddingBottom: 100 },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
    emptyText: { fontSize: 17, fontWeight: '700', color: '#94A3B8', marginTop: 16 },
    emptySubText: { fontSize: 13, color: '#CBD5E1', marginTop: 6, textAlign: 'center' },

    /* Detail Modal */
    detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    detailModal: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: 40,
        maxHeight: '85%',
        overflow: 'hidden',
    },
    detailModalDark: { backgroundColor: '#0F172A' },
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
    glassModalBlur: { padding: 24, borderRadius: 28, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.97)' },
    glassModalBlurDark: { backgroundColor: 'rgba(15,23,42,0.97)' },
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
