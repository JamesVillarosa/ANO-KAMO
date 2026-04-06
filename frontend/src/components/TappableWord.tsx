import React, { useState, useCallback, useRef, useMemo, memo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Animated, ToastAndroid, Platform, Alert } from 'react-native';
import WordCardModal from './WordCardModal';

interface TappableWordProps {
    text: string;
    sourceLang: string;
    targetLang: string;
    style?: any;
    isDarkMode?: boolean;
    disabled?: boolean;
}

/**
 * Renders translation text where each word is tappable.
 * Tapping a word opens the WordCardModal dictionary lookup for that word.
 * Features: Dotted underline, 5% opacity background, and press animation.
 */
function TappableWord({
    text,
    sourceLang,
    targetLang,
    style,
    isDarkMode = false,
    disabled = false,
}: TappableWordProps) {
    const [selectedWord, setSelectedWord] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    // Animation ref
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const showToast = (message: string) => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.SHORT);
        } else {
            Alert.alert('', message);
        }
    };

    const handleWordPress = useCallback((word: string) => {
        if (disabled) {
            showToast("Generate a translation first to use the dictionary.");
            return;
        }

        // Animation: Scale down
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.98,
                duration: 50,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 50,
                useNativeDriver: true,
            }),
        ]).start();

        // Strip punctuation for lookup
        const clean = word.replace(/[.,!?;:"""''()[\]{}]/g, '').trim();
        if (clean.length > 0) {
            setSelectedWord(clean);
            setModalVisible(true);
        }
    }, [disabled, scaleAnim]);

    const handleSynonymPress = useCallback((synonym: string) => {
        setSelectedWord(synonym);
    }, []);

    const words = useMemo(() => text.split(/(\s+)/), [text]);

    return (
        <View style={styles.container}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
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
                                style={[
                                    styles.word,
                                    !disabled && styles.wordActive,
                                    isDarkMode && styles.wordDark
                                ]}
                            >
                                {segment}
                            </Text>
                        );
                    })}
                </Text>
            </Animated.View>

            <WordCardModal
                visible={modalVisible}
                onDismiss={() => setModalVisible(false)}
                word={selectedWord}
                sourceLang={sourceLang}
                targetLang={targetLang}
                onSynonymPress={handleSynonymPress}
            />
        </View>
    );
}

export default memo(TappableWord);

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    word: {
        // Default style
    },
    wordActive: {
        borderBottomWidth: 1,
        borderStyle: 'dotted',
        borderBottomColor: 'rgba(59, 130, 246, 0.5)',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
    },
    wordDark: {
        borderBottomColor: 'rgba(255, 255, 255, 0.3)',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
});
