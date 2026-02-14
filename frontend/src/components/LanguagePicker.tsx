import React from 'react';
import { StyleSheet, View, TouchableOpacity, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { Check, X } from 'lucide-react-native';
import { SUPPORTED_LANGUAGES } from '../theme';

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
    const languages = Object.entries(SUPPORTED_LANGUAGES).filter(
        ([code]) => !exclude.includes(code)
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={onDismiss}>
                            <X size={22} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                    {languages.map(([code, name]) => (
                        <TouchableOpacity
                            key={code}
                            style={[styles.option, selected === code && styles.optionSelected]}
                            onPress={() => { onSelect(code); onDismiss(); }}
                        >
                            <Text style={[styles.optionText, selected === code && styles.optionTextSelected]}>
                                {name}
                            </Text>
                            {selected === code && <Check size={18} color="#3B82F6" />}
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        width: '80%',
        maxWidth: 340,
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
    option: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        marginBottom: 4,
    },
    optionSelected: {
        backgroundColor: '#EFF6FF',
    },
    optionText: {
        fontSize: 16,
        color: '#475569',
    },
    optionTextSelected: {
        color: '#3B82F6',
        fontWeight: '600',
    },
});
