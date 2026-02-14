import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Card, Divider, IconButton, ActivityIndicator, useTheme, Chip } from 'react-native-paper';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const LANGUAGES = [
    { label: 'English', value: 'en' },
    { label: 'Tagalog', value: 'tl' },
    { label: 'Cebuano', value: 'ceb' },
    { label: 'Hiligaynon', value: 'hil' },
];

const TONES = ['neutral', 'formal', 'casual', 'friendly'];

export default function TranslateScreen() {
    const theme = useTheme();
    const [text, setText] = useState('');
    const [sourceLang, setSourceLang] = useState('en');
    const [targetLang, setTargetLang] = useState('tl');
    const [tone, setTone] = useState('neutral');
    const [translatedText, setTranslatedText] = useState('');
    const [loading, setLoading] = useState(false);
    const [detectedTone, setDetectedTone] = useState('');

    const handleTranslate = async () => {
        if (!text.trim()) return;

        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/v1/translate`, {
                text,
                source_lang: sourceLang,
                target_lang: targetLang,
                tone: tone === 'neutral' ? null : tone,
            });
            setTranslatedText(response.data.output_text);
            setDetectedTone(response.data.detected_tone);
        } catch (error) {
            console.error('Translation error:', error);
            setTranslatedText('Error: Could not connect to the translation server.');
        } finally {
            setLoading(false);
        }
    };

    const swapLanguages = () => {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Card style={styles.card}>
                    <Card.Content>
                        <View style={styles.languageRow}>
                            <View style={styles.langPicker}>
                                <Text variant="labelSmall">FROM</Text>
                                <Text variant="titleMedium">{LANGUAGES.find(l => l.value === sourceLang)?.label}</Text>
                            </View>

                            <IconButton
                                icon="swap-horizontal"
                                onPress={swapLanguages}
                                style={styles.swapButton}
                            />

                            <View style={styles.langPicker}>
                                <Text variant="labelSmall">TO</Text>
                                <Text variant="titleMedium">{LANGUAGES.find(l => l.value === targetLang)?.label}</Text>
                            </View>
                        </View>

                        <Divider style={styles.divider} />

                        <View style={styles.toneContainer}>
                            <Text variant="labelSmall" style={styles.toneLabel}>TONE:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {TONES.map(t => (
                                    <Chip
                                        key={t}
                                        selected={tone === t}
                                        onPress={() => setTone(t)}
                                        style={styles.chip}
                                        textStyle={styles.chipText}
                                    >
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </Chip>
                                ))}
                            </ScrollView>
                        </View>

                        <TextInput
                            mode="outlined"
                            placeholder="Enter text to translate..."
                            value={text}
                            onChangeText={setText}
                            multiline
                            numberOfLines={4}
                            style={styles.input}
                            outlineColor="transparent"
                            activeOutlineColor={theme.colors.primary}
                        />

                        <Button
                            mode="contained"
                            onPress={handleTranslate}
                            loading={loading}
                            disabled={loading || !text.trim()}
                            style={styles.translateButton}
                            labelStyle={styles.buttonLabel}
                        >
                            Translate
                        </Button>
                    </Card.Content>
                </Card>

                {translatedText ? (
                    <Card style={[styles.card, styles.resultCard]}>
                        <Card.Content>
                            <View style={styles.resultHeader}>
                                <Text variant="labelSmall">TRANSLATION ({targetLang.toUpperCase()})</Text>
                                {detectedTone && (
                                    <Chip size="small" style={styles.detectedChip}>
                                        Tone: {detectedTone}
                                    </Chip>
                                )}
                            </View>

                            <Text variant="headlineSmall" style={styles.translatedText}>
                                {translatedText}
                            </Text>

                            <View style={styles.resultActions}>
                                <IconButton icon="volume-high" onPress={() => { }} />
                                <IconButton icon="content-copy" onPress={() => { }} />
                                <IconButton icon="heart-outline" onPress={() => { }} />
                                <IconButton icon="share-variant" onPress={() => { }} />
                            </View>
                        </Card.Content>
                    </Card>
                ) : null}

                {loading && !translatedText && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator animating={true} color={theme.colors.primary} size="large" />
                        <Text style={styles.loadingText}>Translating...</Text>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        padding: 16,
    },
    card: {
        borderRadius: 16,
        elevation: 2,
        backgroundColor: '#FFFFFF',
        marginBottom: 16,
    },
    resultCard: {
        backgroundColor: '#EBF3FF',
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
    },
    languageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    langPicker: {
        flex: 1,
    },
    swapButton: {
        marginHorizontal: 8,
    },
    divider: {
        marginVertical: 12,
    },
    toneContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    toneLabel: {
        marginRight: 8,
    },
    chip: {
        marginRight: 6,
        height: 32,
    },
    chipText: {
        fontSize: 12,
    },
    input: {
        backgroundColor: '#F1F5F9',
        marginBottom: 16,
        fontSize: 16,
    },
    translateButton: {
        borderRadius: 12,
        paddingVertical: 4,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    detectedChip: {
        backgroundColor: '#DBEAFE',
    },
    translatedText: {
        fontWeight: '500',
        color: '#1E3A8A',
    },
    resultActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 12,
    },
    loadingContainer: {
        alignItems: 'center',
        marginTop: 32,
    },
    loadingText: {
        marginTop: 12,
        color: '#64748B',
    },
});
