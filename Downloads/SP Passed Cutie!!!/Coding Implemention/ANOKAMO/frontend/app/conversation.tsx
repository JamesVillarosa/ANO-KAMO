import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Text, TextInput, IconButton, useTheme, Surface, Avatar } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';

interface Message {
    id: string;
    text: string;
    lang: string;
    sender: 'me' | 'other';
    translation?: string;
}

export default function ConversationScreen() {
    const theme = useTheme();
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', text: 'Hello, how are you?', lang: 'en', sender: 'me', translation: 'Halo, paano ka?' },
        { id: '2', text: 'Mabuti naman, salamat!', lang: 'tl', sender: 'other', translation: 'I am fine, thank you!' },
    ]);
    const [inputText, setInputText] = useState('');
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [messages]);

    const sendMessage = () => {
        if (!inputText.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            text: inputText,
            lang: 'en',
            sender: 'me',
            translation: `[MOCK] Translated ${inputText}`,
        };

        setMessages([...messages, newMessage]);
        setInputText('');
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <View style={styles.langBar}>
                <Surface style={styles.langChip}>
                    <Text style={styles.langText}>English</Text>
                </Surface>
                <IconButton icon="swap-horizontal" size={20} />
                <Surface style={[styles.langChip, { backgroundColor: '#10B981' }]}>
                    <Text style={[styles.langText, { color: '#fff' }]}>Tagalog</Text>
                </Surface>
            </View>

            <ScrollView
                ref={scrollViewRef}
                style={styles.chatContainer}
                contentContainerStyle={styles.chatContent}
            >
                {messages.map((msg) => (
                    <View
                        key={msg.id}
                        style={[
                            styles.messageWrapper,
                            msg.sender === 'me' ? styles.myMessageWrapper : styles.otherMessageWrapper
                        ]}
                    >
                        <View style={[
                            styles.bubble,
                            msg.sender === 'me' ? styles.myBubble : styles.otherBubble
                        ]}>
                            <Text style={msg.sender === 'me' ? styles.myText : styles.otherText}>
                                {msg.text}
                            </Text>
                            <View style={styles.bubbleDivider} />
                            <Text style={[
                                styles.translationText,
                                msg.sender === 'me' ? styles.myTranslation : styles.otherTranslation
                            ]}>
                                {msg.translation}
                            </Text>
                        </View>
                    </View>
                ))}
            </ScrollView>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={100}
            >
                <Surface style={styles.inputBar} elevation={4}>
                    <IconButton icon="microphone" mode="contained" containerColor={theme.colors.error} iconColor="white" />
                    <TextInput
                        mode="flat"
                        placeholder="Type or speak..."
                        value={inputText}
                        onChangeText={setInputText}
                        style={styles.input}
                        underlineColor="transparent"
                        activeUnderlineColor="transparent"
                    />
                    <IconButton
                        icon="send"
                        onPress={sendMessage}
                        disabled={!inputText.trim()}
                        iconColor={inputText.trim() ? theme.colors.primary : '#94A3B8'}
                    />
                </Surface>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9',
    },
    langBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    langChip: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#E2E8F0',
    },
    langText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    chatContainer: {
        flex: 1,
    },
    chatContent: {
        padding: 16,
        paddingBottom: 20,
    },
    messageWrapper: {
        marginBottom: 16,
        flexDirection: 'row',
        width: '100%',
    },
    myMessageWrapper: {
        justifyContent: 'flex-end',
    },
    otherMessageWrapper: {
        justifyContent: 'flex-start',
    },
    bubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 20,
        elevation: 1,
    },
    myBubble: {
        backgroundColor: '#1E40AF',
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
    },
    myText: {
        color: '#fff',
        fontSize: 16,
    },
    otherText: {
        color: '#1E293B',
        fontSize: 16,
    },
    bubbleDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginVertical: 8,
    },
    translationText: {
        fontSize: 14,
        fontStyle: 'italic',
    },
    myTranslation: {
        color: '#BFDBFE',
    },
    otherTranslation: {
        color: '#64748B',
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    input: {
        flex: 1,
        backgroundColor: 'transparent',
        height: 48,
    },
});
