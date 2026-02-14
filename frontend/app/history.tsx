import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator } from 'react-native';
import { Text, List, IconButton, useTheme, Surface, Searchbar } from 'react-native-paper';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export default function HistoryScreen() {
    const theme = useTheme();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchHistory = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/v1/history`);
            setHistory(response.data);
        } catch (error) {
            console.error('Fetch history error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const filteredHistory = history.filter(item =>
        item.input_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.output_texts[0].toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderItem = ({ item }: { item: any }) => (
        <Surface style={styles.historyItem} elevation={1}>
            <View style={styles.itemContent}>
                <View style={styles.langBadges}>
                    <Text style={styles.badge}>{item.source_lang.toUpperCase()}</Text>
                    <IconButton icon="arrow-right" size={12} style={styles.arrow} />
                    <Text style={styles.badge}>{item.target_langs[0].toUpperCase()}</Text>
                </View>
                <Text variant="titleMedium" style={styles.inputText}>{item.input_text}</Text>
                <Text variant="bodyMedium" style={styles.outputText}>{item.output_texts[0]}</Text>
                <Text variant="bodySmall" style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </View>
            <View style={styles.itemActions}>
                <IconButton
                    icon={item.is_favorite ? "heart" : "heart-outline"}
                    iconColor={item.is_favorite ? theme.colors.error : '#94A3B8'}
                    onPress={() => { }}
                />
                <IconButton icon="delete-outline" iconColor="#EF4444" onPress={() => { }} />
            </View>
        </Surface>
    );

    return (
        <View style={styles.container}>
            <Searchbar
                placeholder="Search history..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchBar}
            />

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredHistory}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <IconButton icon="history" size={60} iconColor="#E2E8F0" />
                            <Text variant="bodyLarge" style={styles.emptyText}>No history yet</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    searchBar: {
        margin: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
    },
    listContent: {
        padding: 16,
        paddingTop: 0,
    },
    historyItem: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    itemContent: {
        flex: 1,
    },
    langBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    badge: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748B',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    arrow: {
        margin: 0,
        width: 20,
    },
    inputText: {
        fontWeight: '600',
        color: '#1E293B',
    },
    outputText: {
        color: '#3B82F6',
        marginTop: 4,
    },
    dateText: {
        color: '#94A3B8',
        marginTop: 8,
    },
    itemActions: {
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        color: '#94A3B8',
    },
});
