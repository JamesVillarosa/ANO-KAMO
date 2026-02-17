import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { X, Volume2 } from 'lucide-react-native';
import { dictionaryLookup } from '../lib/api';
import { useTheme } from '../context/ThemeContext';

interface DictionaryModalProps {
    visible: boolean;
    onDismiss: () => void;
    word: string;
    sourceLang: string;
    targetLang: string;
}

interface DictionaryEntry {
    word: string;
    pronunciation: string;
    meaning: string;
    partOfSpeech: string;
    synonyms: string[];
    example: string;
}

export default function DictionaryModal({
    visible,
    onDismiss,
    word,
    sourceLang,
    targetLang,
}: DictionaryModalProps) {
    const { isDarkMode } = useTheme();
    const [loading, setLoading] = useState(false);
    const [entry, setEntry] = useState<DictionaryEntry | null>(null);

    useEffect(() => {
        if (visible && word) {
            setLoading(true);
            dictionaryLookup(word, sourceLang, targetLang).then(res => {
                setEntry({
                    word: res.word || word,
                    pronunciation: res.pronunciation || `/${word.toLowerCase()}/`,
                    meaning: res.definition || `Meaning of "${word}"`,
                    partOfSpeech: res.part_of_speech || 'Word',
                    synonyms: res.synonyms || [],
                    example: res.example_sentence || '',
                });
                setLoading(false);
            }).catch(() => {
                setEntry({
                    word: word,
                    pronunciation: `/${word.toLowerCase()}/`,
                    meaning: `Ang kahulugan ng "${word}".`,
                    partOfSpeech: 'Word',
                    synonyms: [],
                    example: `Ginamit niya ang "${word}" sa pangungusap.`,
                });
                setLoading(false);
            });
        } else {
            setEntry(null);
        }
    }, [visible, word]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <View style={[styles.container, isDarkMode && styles.containerDark]}>
                    {/* Close button */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
                        <X size={22} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                    </TouchableOpacity>

                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                        </View>
                    ) : entry ? (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                            {/* Word */}
                            <View style={styles.wordRow}>
                                <Text style={[styles.word, isDarkMode && styles.textWhite]}>{entry.word}</Text>
                                <TouchableOpacity style={styles.speakerBtn}>
                                    <Volume2 size={20} color="#3B82F6" />
                                </TouchableOpacity>
                            </View>

                            {/* Part of Speech */}
                            <View style={[styles.posBadge, isDarkMode && styles.posBadgeDark]}>
                                <Text style={[styles.posText, isDarkMode && styles.posTextDark]}>{entry.partOfSpeech}</Text>
                            </View>

                            {/* Pronunciation */}
                            <Text style={styles.pronunciation}>{entry.pronunciation}</Text>

                            {/* Synonyms */}
                            {entry.synonyms && entry.synonyms.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>Synonyms</Text>
                                    <View style={styles.synonymsRow}>
                                        {entry.synonyms.map((s, i) => (
                                            <View key={i} style={[styles.synonymChip, isDarkMode && styles.synonymChipDark]}>
                                                <Text style={styles.synonymText}>{s}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}

                            {/* Definition */}
                            <Text style={styles.sectionTitle}>Definition</Text>
                            <Text style={[styles.definitionText, isDarkMode && styles.textSecondary]}>{entry.meaning}</Text>

                            {/* Example */}
                            <Text style={styles.sectionTitle}>Example</Text>
                            <View style={[styles.exampleBox, isDarkMode && styles.exampleBoxDark]}>
                                <Text style={[styles.exampleText, isDarkMode && styles.textMuted]}>"{entry.example}"</Text>
                            </View>
                        </ScrollView>
                    ) : null}
                </View>
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
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 28,
        width: '100%',
        maxWidth: 380,
        maxHeight: '75%',
    },
    containerDark: {
        backgroundColor: '#1E293B',
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
    },
    scroll: {
        paddingTop: 8,
    },
    wordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    word: {
        fontSize: 36,
        fontWeight: '800',
        color: '#1E293B',
        marginRight: 14,
    },
    textWhite: { color: '#FFFFFF' },
    speakerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    posBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(100, 116, 139, 0.1)',
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 10,
        marginBottom: 8,
    },
    posBadgeDark: { backgroundColor: 'rgba(148, 163, 184, 0.2)' },
    posText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    posTextDark: { color: '#94A3B8' },
    pronunciation: {
        fontSize: 16,
        color: '#64748B',
        fontStyle: 'italic',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
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
        paddingVertical: 6,
        borderRadius: 12,
    },
    synonymChipDark: { backgroundColor: 'rgba(96, 165, 250, 0.15)' },
    synonymText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3B82F6',
    },
    definitionText: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 24,
        marginBottom: 18,
    },
    textSecondary: { color: '#CBD5E1' },
    exampleBox: {
        backgroundColor: 'rgba(100, 116, 139, 0.05)',
        borderRadius: 14,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#3B82F6',
    },
    exampleBoxDark: { backgroundColor: 'rgba(148, 163, 184, 0.1)' },
    exampleText: {
        fontSize: 14,
        color: '#64748B',
        fontStyle: 'italic',
        lineHeight: 22,
    },
    textMuted: { color: '#94A3B8' },
});
