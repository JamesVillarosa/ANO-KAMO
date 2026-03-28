import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { GlassBlur as BlurView } from './GlassBlur';
import { Text } from 'react-native-paper';
import { X, Volume2 } from 'lucide-react-native';
import { dictionaryLookup } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useTextToSpeech } from '../hooks/useTextToSpeech';

interface WordCardModalProps {
    visible: boolean;
    onDismiss: () => void;
    word: string;
    sourceLang: string;
    targetLang: string;
    onSynonymPress?: (synonym: string) => void;
}

interface WordEntry {
    word: string;
    root: string;
    pronunciation: string;
    definition: string;
    partOfSpeech: string;
    synonyms: string[];
    example: string;
    exampleTranslation: string;
}

export default function WordCardModal({
    visible,
    onDismiss,
    word,
    sourceLang,
    targetLang,
    onSynonymPress,
}: WordCardModalProps) {
    const { isDarkMode } = useTheme();
    const tts = useTextToSpeech();
    const [loading, setLoading] = useState(false);
    const [entry, setEntry] = useState<WordEntry | null>(null);

    useEffect(() => {
        if (visible && word) {
            setLoading(true);
            dictionaryLookup(word, sourceLang, targetLang).then(res => {
                setEntry({
                    word: res.word || word,
                    root: res.root || word,
                    pronunciation: res.pronunciation || '',
                    definition: res.definition || '(Definition unavailable)',
                    partOfSpeech: res.part_of_speech || '',
                    synonyms: res.synonyms || [],
                    example: res.example_sentence || '',
                    exampleTranslation: res.example_translation || '',
                });
                setLoading(false);
            }).catch(() => {
                setEntry({
                    word: word,
                    root: word,
                    pronunciation: '',
                    definition: '(Dictionary temporarily unavailable. Please try again.)',
                    partOfSpeech: '',
                    synonyms: [],
                    example: '',
                    exampleTranslation: '',
                });
                setLoading(false);
            });
        } else {
            setEntry(null);
        }
    }, [visible, word]);

    const handleSynonymPress = (synonym: string) => {
        if (onSynonymPress) {
            onSynonymPress(synonym);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <BlurView
                    intensity={65}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[styles.container, isDarkMode && styles.containerDark]}
                >
                    {/* Close button */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
                        <X size={22} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                    </TouchableOpacity>

                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={styles.loadingText}>Looking up word...</Text>
                        </View>
                    ) : entry ? (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                            {/* Word Header */}
                            <View style={styles.wordRow}>
                                <Text style={[styles.word, isDarkMode && styles.textWhite]}>
                                    {entry.word}
                                </Text>
                                <TouchableOpacity
                                    style={styles.speakerBtn}
                                    onPress={() => tts.speak(entry.word, sourceLang)}
                                >
                                    <Volume2 size={20} color="#3B82F6" />
                                </TouchableOpacity>
                            </View>

                            {/* Part of Speech Badge */}
                            {entry.partOfSpeech ? (
                                <View style={[styles.posBadge, isDarkMode && styles.posBadgeDark]}>
                                    <Text style={[styles.posText, isDarkMode && styles.posTextDark]}>
                                        {entry.partOfSpeech}
                                    </Text>
                                </View>
                            ) : null}

                            {/* Pronunciation */}
                            {entry.pronunciation ? (
                                <Text style={styles.pronunciation}>{entry.pronunciation}</Text>
                            ) : null}

                            {/* Synonyms */}
                            {entry.synonyms && entry.synonyms.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>Synonyms</Text>
                                    <View style={styles.synonymsRow}>
                                        {entry.synonyms.map((s, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={[styles.synonymChip, isDarkMode && styles.synonymChipDark]}
                                                onPress={() => handleSynonymPress(s)}
                                            >
                                                <Text style={styles.synonymText}>{s}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}

                            {/* Definition */}
                            <Text style={styles.sectionTitle}>Definition</Text>
                            <Text style={[styles.definitionText, isDarkMode && styles.textSecondary]}>
                                {entry.definition}
                            </Text>

                            {/* Example Section */}
                            {entry.example ? (
                                <>
                                    <Text style={styles.sectionTitle}>Example</Text>
                                    <View style={[styles.exampleBox, isDarkMode && styles.exampleBoxDark]}>
                                        {/* Target language example (Natural usage) */}
                                        <Text style={[styles.exampleText, isDarkMode && styles.textMuted]}>
                                            "{entry.example}"
                                        </Text>

                                        {/* Source language translation (Instant clarity) */}
                                        {entry.exampleTranslation ? (
                                            <Text style={[styles.exampleSubText, isDarkMode && styles.textSecondaryMuted]}>
                                                {entry.exampleTranslation}
                                            </Text>
                                        ) : null}
                                    </View>
                                </>
                            ) : null}
                        </ScrollView>
                    ) : null}
                </BlurView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderRadius: 36,
        padding: 28,
        width: '100%',
        maxWidth: 380,
        maxHeight: '78%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    containerDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        padding: 4,
    },
    loadingWrap: {
        paddingVertical: 60,
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#64748B',
    },
    scroll: {
        paddingTop: 8,
    },
    wordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    word: {
        fontSize: 36,
        fontWeight: '800',
        color: '#1E293B',
        marginRight: 14,
    },
    textWhite: { color: '#FFFFFF' },
    speakerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    posBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(100, 116, 139, 0.1)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 8,
    },
    posBadgeDark: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
    posText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
    },
    posTextDark: { color: '#94A3B8' },
    pronunciation: {
        fontSize: 17,
        color: '#64748B',
        marginBottom: 20,
        letterSpacing: 1.5,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#3B82F6',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 8,
        marginTop: 4,
    },
    synonymsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 18,
    },
    synonymChip: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 14,
    },
    synonymChipDark: { backgroundColor: 'rgba(96, 165, 250, 0.15)' },
    synonymText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3B82F6',
    },
    definitionText: {
        fontSize: 16,
        color: '#475569',
        lineHeight: 24,
        marginBottom: 20,
    },
    textSecondary: { color: '#CBD5E1' },
    exampleBox: {
        backgroundColor: 'rgba(59, 130, 246, 0.04)',
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.1)',
    },
    exampleBoxDark: {
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderColor: 'rgba(59, 130, 246, 0.15)',
    },
    exampleText: {
        fontSize: 16,
        color: '#3B82F6',
        fontWeight: '600',
        lineHeight: 22,
        marginBottom: 4,
    },
    exampleSubText: {
        fontSize: 13,
        color: '#64748B',
        fontStyle: 'italic',
        lineHeight: 18,
    },
    textMuted: { color: '#60A5FA' },
    textSecondaryMuted: { color: '#94A3B8' },
});
