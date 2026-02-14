import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { X, Volume2 } from 'lucide-react-native';
import axios from 'axios';
import { API_BASE_URL, SUPPORTED_LANGUAGES } from '../theme';

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
    const [loading, setLoading] = useState(false);
    const [entry, setEntry] = useState<DictionaryEntry | null>(null);

    useEffect(() => {
        if (visible && word) {
            setLoading(true);
            // Try API first, fallback to mock
            axios.post(`${API_BASE_URL}/api/v1/dictionary`, {
                word, source_lang: sourceLang, target_lang: targetLang,
            }).then(res => {
                setEntry(res.data);
                setLoading(false);
            }).catch(() => {
                // Mock data
                setEntry({
                    word: word,
                    pronunciation: `/${word.toLowerCase()}/`,
                    meaning: `Ang kahulugan ng "${word}" sa ${SUPPORTED_LANGUAGES[targetLang] || targetLang}. Ito ay isang salita na karaniwan ginagamit sa pang-araw-araw na pakikipag-usap.`,
                    partOfSpeech: 'Adjective (Slang/Colloquial)',
                    synonyms: ['takot', 'kinakabahan'],
                    example: `Buhay na naman pala ang pamilya, ${word} talaga ang taong iyon!`,
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
                <View style={styles.container}>
                    {/* Close button */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
                        <X size={22} color="#94A3B8" />
                    </TouchableOpacity>

                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                        </View>
                    ) : entry ? (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                            {/* Word */}
                            <View style={styles.wordRow}>
                                <Text style={styles.word}>{entry.word}</Text>
                                <TouchableOpacity style={styles.speakerBtn}>
                                    <Volume2 size={20} color="#3B82F6" />
                                </TouchableOpacity>
                            </View>

                            {/* Part of Speech */}
                            <View style={styles.posBadge}>
                                <Text style={styles.posText}>{entry.partOfSpeech}</Text>
                            </View>

                            {/* Pronunciation */}
                            <Text style={styles.pronunciation}>{entry.pronunciation}</Text>

                            {/* Synonyms */}
                            {entry.synonyms && entry.synonyms.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>Synonyms</Text>
                                    <View style={styles.synonymsRow}>
                                        {entry.synonyms.map((s, i) => (
                                            <View key={i} style={styles.synonymChip}>
                                                <Text style={styles.synonymText}>{s}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}

                            {/* Definition */}
                            <Text style={styles.sectionTitle}>Definition</Text>
                            <Text style={styles.definitionText}>{entry.meaning}</Text>

                            {/* Example */}
                            <Text style={styles.sectionTitle}>Example</Text>
                            <View style={styles.exampleBox}>
                                <Text style={styles.exampleText}>"{entry.example}"</Text>
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
        backgroundColor: '#1E293B',
        borderRadius: 28,
        padding: 28,
        width: '100%',
        maxWidth: 380,
        maxHeight: '75%',
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

    /* Word */
    wordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    word: {
        fontSize: 36,
        fontWeight: '800',
        color: '#FFFFFF',
        marginRight: 14,
    },
    speakerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    /* Part of Speech */
    posBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(100, 116, 139, 0.3)',
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 10,
        marginBottom: 8,
    },
    posText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
    },

    /* Pronunciation */
    pronunciation: {
        fontSize: 16,
        color: '#64748B',
        fontStyle: 'italic',
        marginBottom: 20,
    },

    /* Sections */
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 8,
        marginTop: 4,
    },

    /* Synonyms */
    synonymsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 18,
    },
    synonymChip: {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 12,
    },
    synonymText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#60A5FA',
    },

    /* Definition */
    definitionText: {
        fontSize: 15,
        color: '#CBD5E1',
        lineHeight: 24,
        marginBottom: 18,
    },

    /* Example */
    exampleBox: {
        backgroundColor: 'rgba(100, 116, 139, 0.15)',
        borderRadius: 14,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#3B82F6',
    },
    exampleText: {
        fontSize: 14,
        color: '#94A3B8',
        fontStyle: 'italic',
        lineHeight: 22,
    },
});
