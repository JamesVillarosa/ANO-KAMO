import React, { useRef, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import RBSheet from 'react-native-raw-bottom-sheet';
import { X, BookOpen, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface SentenceBreakdownSheetProps {
    visible: boolean;
    onClose: () => void;
    text: string;
    sourceLang: string;
    targetLang: string;
    onWordPress: (word: string) => void;
}

/**
 * Bottom sheet that lists all key terms from a sentence.
 * Tapping a term opens the high-fidelity Word Card.
 */
export default function SentenceBreakdownSheet({
    visible,
    onClose,
    text,
    sourceLang,
    targetLang,
    onWordPress,
}: SentenceBreakdownSheetProps) {
    const { isDarkMode } = useTheme();
    const refRBSheet = useRef<any>(null);

    React.useEffect(() => {
        if (visible) {
            refRBSheet.current?.open();
        } else {
            refRBSheet.current?.close();
        }
    }, [visible]);

    // Simple tokenizer: split by space and remove duplicates / common small words
    const words = useMemo(() => {
        if (!text) return [];
        const cleanWords = text
            .split(/\s+/)
            .map(w => w.replace(/[.,!?;:"""''()[\]{}]/g, '').trim())
            .filter(w => w.length > 2); // Filter out tiny words
        return [...new Set(cleanWords)]; // Unique words
    }, [text]);

    return (
        <RBSheet
            ref={refRBSheet}
            onClose={onClose}
            height={450}
            openDuration={250}
            customStyles={{
                container: {
                    borderTopLeftRadius: 36,
                    borderTopRightRadius: 36,
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    padding: 24,
                },
                wrapper: {
                    backgroundColor: 'rgba(0,0,0,0.5)',
                },
                draggableIcon: {
                    backgroundColor: isDarkMode ? '#475569' : '#CBD5E1',
                    width: 60,
                },
            }}
        >
            <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                    <BookOpen size={20} color="#3B82F6" strokeWidth={2.5} />
                    <Text style={[styles.title, isDarkMode && styles.textWhite]}>Sentence Breakdown</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <X size={24} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                </TouchableOpacity>
            </View>

            <Text style={[styles.subtitle, isDarkMode && styles.textMuted]}>
                Tap any word below for a detailed dictionary lookup and regional usage notes.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
                {words.length > 0 ? (
                    words.map((word, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.item, isDarkMode && styles.itemDark]}
                            onPress={() => onWordPress(word)}
                        >
                            <View style={styles.itemContent}>
                                <View style={styles.bullet} />
                                <Text style={[styles.wordText, isDarkMode && styles.textWhite]}>{word}</Text>
                            </View>
                            <ChevronRight size={18} color="#3B82F6" />
                        </TouchableOpacity>
                    ))
                ) : (
                    <Text style={styles.emptyText}>No key terms found in this sentence.</Text>
                )}
            </ScrollView>
        </RBSheet>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1E293B',
    },
    closeBtn: {
        padding: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
        marginBottom: 20,
    },
    list: {
        paddingBottom: 40,
    },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.1)',
    },
    itemDark: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#3B82F6',
    },
    wordText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#3B82F6',
    },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        marginTop: 40,
        fontSize: 15,
    },
    textWhite: { color: '#F8FAFC' },
    textMuted: { color: '#94A3B8' },
});
