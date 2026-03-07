import React, { useState, useCallback } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import WordCardModal from './WordCardModal';

interface SelectableWordProps {
    text: string;
    sourceLang: string;
    targetLang: string;
    style?: any;
    isDarkMode?: boolean;
}

/**
 * Renders translation text where each word is tappable.
 * Tapping a word opens the WordCardModal dictionary lookup for that word.
 */
export default function SelectableWord({
    text,
    sourceLang,
    targetLang,
    style,
    isDarkMode = false,
}: SelectableWordProps) {
    const [selectedWord, setSelectedWord] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    const handleWordPress = useCallback((word: string) => {
        // Strip punctuation for lookup
        const clean = word.replace(/[.,!?;:"""''()[\]{}]/g, '').trim();
        if (clean.length > 0) {
            setSelectedWord(clean);
            setModalVisible(true);
        }
    }, []);

    const handleSynonymPress = useCallback((synonym: string) => {
        setSelectedWord(synonym);
    }, []);

    const words = text.split(/(\s+)/);

    return (
        <>
            <Text style={style}>
                {words.map((segment, index) => {
                    // Keep whitespace segments as-is
                    if (/^\s+$/.test(segment)) {
                        return <Text key={index}>{segment}</Text>;
                    }
                    return (
                        <Text
                            key={index}
                            onPress={() => handleWordPress(segment)}
                            style={styles.word}
                        >
                            {segment}
                        </Text>
                    );
                })}
            </Text>

            <WordCardModal
                visible={modalVisible}
                onDismiss={() => setModalVisible(false)}
                word={selectedWord}
                sourceLang={sourceLang}
                targetLang={targetLang}
                onSynonymPress={handleSynonymPress}
            />
        </>
    );
}

const styles = StyleSheet.create({
    word: {
        // Words are tappable — subtle underline hint on press (handled by React Native)
    },
});
