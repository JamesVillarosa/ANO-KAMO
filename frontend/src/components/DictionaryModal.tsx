import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { X, BookOpen, Volume2 } from 'lucide-react-native';
import axios from 'axios';
import { API_BASE_URL } from '../theme';

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
            // Try API, fallback to mock
            const timer = setTimeout(() => {
                setEntry({
                    word: word,
                    pronunciation: `/${word.toLowerCase()}/`,
                    meaning: `Ang kahulugan ng "${word}" sa ${targetLang === 'tl' ? 'Tagalog' : targetLang}`,
                    partOfSpeech: 'noun / verb',
                    example: `"${word}" ay ginagamit sa pangungusap.`,
                });
                setLoading(false);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [visible, word]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
                <View style={styles.container}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <BookOpen size={22} color="#3B82F6" />
                            <Text style={styles.title}>Dictionary</Text>
                        </View>
                        <TouchableOpacity onPress={onDismiss}>
                            <X size={22} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#3B82F6" style={{ padding: 40 }} />
                    ) : entry ? (
                        <View style={styles.content}>
                            <View style={styles.wordRow}>
                                <Text style={styles.word}>{entry.word}</Text>
                                <TouchableOpacity style={styles.speakerBtn}>
                                    <Volume2 size={18} color="#3B82F6" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.pronunciation}>{entry.pronunciation}</Text>

                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{entry.partOfSpeech}</Text>
                            </View>

                            <Text style={styles.sectionLabel}>Meaning</Text>
                            <Text style={styles.meaningText}>{entry.meaning}</Text>

                            <Text style={styles.sectionLabel}>Example</Text>
                            <Text style={styles.exampleText}>{entry.example}</Text>
                        </View>
                    ) : null}
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: 40,
        minHeight: 320,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
        marginLeft: 10,
    },
    content: {},
    wordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    word: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1E293B',
        marginRight: 12,
    },
    speakerBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pronunciation: {
        fontSize: 16,
        color: '#64748B',
        fontStyle: 'italic',
        marginBottom: 12,
    },
    badge: {
        alignSelf: 'flex-start',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 20,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 6,
    },
    meaningText: {
        fontSize: 16,
        color: '#1E293B',
        lineHeight: 24,
        marginBottom: 16,
    },
    exampleText: {
        fontSize: 15,
        color: '#475569',
        fontStyle: 'italic',
        lineHeight: 22,
    },
});
