import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { Text, FAB, Card, IconButton, useTheme, Chip, TextInput, Portal, Modal, Button } from 'react-native-paper';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export default function CommunityScreen() {
    const theme = useTheme();
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [newPhrase, setNewPhrase] = useState('');
    const [newTranslation, setNewTranslation] = useState('');

    const fetchSubmissions = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/v1/community/submissions`);
            setSubmissions(response.data);
        } catch (error) {
            console.error('Fetch submissions error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const handleSubmit = async () => {
        try {
            await axios.post(`${API_BASE_URL}/api/v1/community/submissions`, {
                phrase: newPhrase,
                source_lang: 'en',
                target_lang: 'tl',
                proposed_translation: newTranslation,
                notes: 'User submission via app',
            });
            setModalVisible(false);
            setNewPhrase('');
            setNewTranslation('');
            fetchSubmissions();
        } catch (error) {
            console.error('Submit error:', error);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <Card style={styles.card}>
            <Card.Content>
                <View style={styles.cardHeader}>
                    <Chip icon="check-circle" style={styles.statusChip}>{item.status}</Chip>
                    <View style={styles.votes}>
                        <IconButton icon="arrow-up" size={16} />
                        <Text variant="labelLarge">0</Text>
                        <IconButton icon="arrow-down" size={16} />
                    </View>
                </View>

                <Text variant="titleMedium" style={styles.phrase}>{item.phrase}</Text>
                <Text variant="headlineSmall" style={styles.translation}>{item.proposed_translation}</Text>

                <View style={styles.meta}>
                    <Text variant="bodySmall" style={styles.metaText}>
                        {item.source_lang.toUpperCase()} → {item.target_lang.toUpperCase()}
                    </Text>
                </View>
            </Card.Content>
        </Card>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text variant="bodyMedium" style={styles.headerSubtitle}>
                    Help improve Filipino translations by contributing phrases.
                </Text>
            </View>

            <FlatList
                data={submissions}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text variant="bodyLarge" style={styles.emptyText}>No submissions yet. Be the first!</Text>
                    </View>
                }
            />

            <Portal>
                <Modal
                    visible={modalVisible}
                    onDismiss={() => setModalVisible(false)}
                    contentContainerStyle={styles.modal}
                >
                    <Text variant="titleLarge" style={styles.modalTitle}>New Submission</Text>
                    <TextInput
                        label="Original Phrase (English)"
                        value={newPhrase}
                        onChangeText={setNewPhrase}
                        mode="outlined"
                        style={styles.modalInput}
                    />
                    <TextInput
                        label="Proposed Translation (Tagalog)"
                        value={newTranslation}
                        onChangeText={setNewTranslation}
                        mode="outlined"
                        style={styles.modalInput}
                        multiline
                    />
                    <View style={styles.modalActions}>
                        <Button onPress={() => setModalVisible(false)}>Cancel</Button>
                        <Button mode="contained" onPress={handleSubmit} disabled={!newPhrase || !newTranslation}>
                            Submit
                        </Button>
                    </View>
                </Modal>
            </Portal>

            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                color="white"
                onPress={() => setModalVisible(true)}
                label="Suggest Phrase"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerSubtitle: {
        color: '#64748B',
    },
    listContent: {
        padding: 16,
        paddingBottom: 80,
    },
    card: {
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: '#fff',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusChip: {
        height: 28,
        backgroundColor: '#ECFDF5',
    },
    votes: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    phrase: {
        color: '#64748B',
    },
    translation: {
        fontWeight: 'bold',
        color: '#1E293B',
        marginTop: 4,
    },
    meta: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 8,
    },
    metaText: {
        color: '#94A3B8',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        borderRadius: 28,
    },
    modal: {
        backgroundColor: 'white',
        padding: 24,
        margin: 20,
        borderRadius: 16,
    },
    modalTitle: {
        marginBottom: 16,
        fontWeight: 'bold',
    },
    modalInput: {
        marginBottom: 12,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 16,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        color: '#94A3B8',
    },
});
