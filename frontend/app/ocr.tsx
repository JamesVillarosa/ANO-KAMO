import React, { useState } from 'react';
import { StyleSheet, View, Image, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, Card, IconButton, useTheme, Surface } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';

export default function OCRScreen() {
    const theme = useTheme();
    const [image, setImage] = useState<string | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [extractedText, setExtractedText] = useState('');
    const [translation, setTranslation] = useState('');

    const pickImage = () => {
        // Mock image pick
        setImage('https://placekitten.com/400/300'); // Placeholder
    };

    const processImage = () => {
        setExtracting(true);
        setTimeout(() => {
            setExtractedText('Salamat sa iyong tulong.');
            setTranslation('Thank you for your help.');
            setExtracting(false);
        }, 2000);
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Surface style={styles.cameraPlaceholder} elevation={1}>
                    {image ? (
                        <Image source={{ uri: image }} style={styles.previewImage} />
                    ) : (
                        <View style={styles.noImage}>
                            <IconButton icon="camera-plus" size={60} iconColor="#94A3B8" onPress={pickImage} />
                            <Text variant="bodyLarge" style={styles.placeholderText}>
                                Take a photo or upload an image
                            </Text>
                        </View>
                    )}
                </Surface>

                <View style={styles.actions}>
                    <Button
                        mode="contained"
                        onPress={pickImage}
                        icon="image-plus"
                        style={styles.actionButton}
                    >
                        Select Image
                    </Button>
                    <Button
                        mode="contained"
                        onPress={processImage}
                        disabled={!image || extracting}
                        loading={extracting}
                        style={[styles.actionButton, { backgroundColor: '#10B981' }]}
                        icon="auto-fix"
                    >
                        Extract & Translate
                    </Button>
                </View>

                {extractedText ? (
                    <Card style={styles.resultCard}>
                        <Card.Content>
                            <Text variant="labelSmall" style={styles.resultLabel}>DETECTED TEXT (TAGALOG)</Text>
                            <Text variant="titleLarge" style={styles.textValue}>{extractedText}</Text>

                            <View style={styles.divider} />

                            <Text variant="labelSmall" style={styles.resultLabel}>TRANSLATION (ENGLISH)</Text>
                            <Text variant="titleLarge" style={[styles.textValue, { color: theme.colors.primary }]}>
                                {translation}
                            </Text>

                            <View style={styles.resultActions}>
                                <IconButton icon="volume-high" />
                                <IconButton icon="content-copy" />
                                <IconButton icon="share-variant" />
                            </View>
                        </Card.Content>
                    </Card>
                ) : null}
            </ScrollView>
        </View>
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
    cameraPlaceholder: {
        width: '100%',
        height: 300,
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    noImage: {
        alignItems: 'center',
    },
    placeholderText: {
        color: '#94A3B8',
        marginTop: 8,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        marginBottom: 20,
    },
    actionButton: {
        flex: 0.48,
        borderRadius: 12,
    },
    resultCard: {
        borderRadius: 16,
        backgroundColor: '#fff',
        elevation: 4,
    },
    resultLabel: {
        color: '#64748B',
        marginBottom: 4,
    },
    textValue: {
        fontWeight: '600',
        marginBottom: 16,
    },
    divider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginBottom: 16,
    },
    resultActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
});
