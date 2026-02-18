import React from 'react';
import { StyleSheet, View, TouchableOpacity, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { Check, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { SUPPORTED_LANGUAGES } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface LanguagePickerProps {
    visible: boolean;
    onDismiss: () => void;
    onSelect: (langCode: string) => void;
    selected: string;
    exclude?: string[];
    title?: string;
}

export default function LanguagePicker({
    visible,
    onDismiss,
    onSelect,
    selected,
    exclude = [],
    title = 'Select Language',
}: LanguagePickerProps) {
    const { isDarkMode } = useTheme();
    const languages = Object.entries(SUPPORTED_LANGUAGES).filter(
        ([code]) => !exclude.includes(code)
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
                <BlurView
                    intensity={60}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[styles.container, isDarkMode && styles.containerDark]}
                >
                    <View style={styles.header}>
                        <Text style={[styles.title, isDarkMode && styles.textWhite]}>{title}</Text>
                        <TouchableOpacity onPress={onDismiss}>
                            <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                        </TouchableOpacity>
                    </View>
                    {languages.map(([code, name]) => (
                        <TouchableOpacity
                            key={code}
                            style={[
                                styles.option,
                                selected === code && (isDarkMode ? styles.optionSelectedDark : styles.optionSelected)
                            ]}
                            onPress={() => { onSelect(code); onDismiss(); }}
                        >
                            <Text style={[
                                styles.optionText,
                                isDarkMode && styles.textSecondary,
                                selected === code && (isDarkMode ? styles.optionTextSelectedDark : styles.optionTextSelected)
                            ]}>
                                {name}
                            </Text>
                            {selected === code && <Check size={18} color="#3B82F6" />}
                        </TouchableOpacity>
                    ))}
                </BlurView>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderRadius: 32,
        padding: 24,
        width: '85%',
        maxWidth: 360,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    containerDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.7)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
    },
    textWhite: { color: '#FFFFFF' },
    option: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 6,
    },
    optionSelected: {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
    },
    optionSelectedDark: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
    },
    optionText: {
        fontSize: 16,
        color: '#475569',
    },
    textSecondary: { color: '#94A3B8' },
    optionTextSelected: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    optionTextSelectedDark: {
        color: '#60A5FA',
        fontWeight: '600',
    },
});
