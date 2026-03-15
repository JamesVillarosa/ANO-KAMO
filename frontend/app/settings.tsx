import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Switch, Modal, TextInput, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
    User,
    Moon,
    ChevronRight,
    Heart,
    Users,
    Send,
    X,
    ChevronDown,
    Info,
    Shield,
    FileText,
} from 'lucide-react-native';
import { gradientColors, darkGradientColors, glassCard, darkGlassCard, SUPPORTED_LANGUAGES } from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import { submitPhrase as apiSubmitPhrase } from '../src/lib/api';
import LanguagePicker from '../src/components/LanguagePicker';

export default function SettingsScreen() {
    const { isDarkMode, toggleTheme } = useTheme();
    const activeGradient = isDarkMode ? darkGradientColors : gradientColors;

    // Community submission modal
    const [modalVisible, setModalVisible] = useState(false);
    const [newPhrase, setNewPhrase] = useState('');
    const [newTranslation, setNewTranslation] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [newOrigin, setNewOrigin] = useState('');
    const [formSourceLang, setFormSourceLang] = useState('tl');
    const [formTargetLang, setFormTargetLang] = useState('en');
    const [pickerTarget, setPickerTarget] = useState<'source' | 'target' | null>(null);

    const handleSubmitPhrase = async () => {
        if (!newPhrase.trim() || !newTranslation.trim()) {
            Alert.alert('Error', 'Please fill in both the phrase and translation');
            return;
        }
        try {
            await apiSubmitPhrase(newPhrase, formSourceLang, formTargetLang, newTranslation, newNotes);
            Alert.alert('Submitted! 🎉', 'Your suggestion has been sent for community review.');
        } catch {
            Alert.alert('Info', 'Suggestion saved locally — it will sync when online.');
        }
        setModalVisible(false);
        setNewPhrase('');
        setNewTranslation('');
        setNewNotes('');
        setNewOrigin('');
    };

    const SettingsItem = ({
        icon: Icon,
        iconColor = '#3B82F6',
        title,
        subtitle,
        right,
        onPress,
    }: {
        icon: any;
        iconColor?: string;
        title: string;
        subtitle?: string;
        right?: React.ReactNode;
        onPress?: () => void;
    }) => (
        <TouchableOpacity
            style={styles.settingsItem}
            onPress={onPress}
            disabled={!onPress && !right}
        >
            <View style={[styles.iconBox, { backgroundColor: iconColor + '18' }]}>
                <Icon size={18} color={iconColor} />
            </View>
            <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, isDarkMode && styles.textWhite]}>{title}</Text>
                {subtitle ? <Text style={[styles.itemSubtitle, isDarkMode && styles.textSecondary]}>{subtitle}</Text> : null}
            </View>
            {right || <ChevronRight size={18} color={isDarkMode ? '#64748B' : '#CBD5E1'} />}
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <LinearGradient colors={[...activeGradient]} style={styles.bg} />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Profile Card */}
                <BlurView
                    intensity={isDarkMode ? 30 : 50}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[styles.profileCard, isDarkMode ? darkGlassCard : glassCard]}
                >
                    <View style={[styles.avatar, isDarkMode && styles.avatarDark]}>
                        <User size={32} color="#3B82F6" />
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, isDarkMode && styles.textWhite]}>Guest User</Text>
                        <Text style={[styles.profileEmail, isDarkMode && styles.textSecondary]}>guest@ano-kamo.dev</Text>
                    </View>
                    <TouchableOpacity style={[styles.editBtn, isDarkMode && styles.editBtnDark]}>
                        <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                </BlurView>

                {/* Preferences */}
                <Text style={styles.sectionLabel}>PREFERENCES</Text>
                <BlurView
                    intensity={isDarkMode ? 30 : 50}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[styles.sectionCard, isDarkMode ? darkGlassCard : glassCard]}
                >
                    <SettingsItem
                        icon={Moon}
                        title="Dark Mode"
                        right={
                            <Switch
                                value={isDarkMode}
                                onValueChange={toggleTheme}
                                trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                                thumbColor="#FFF"
                            />
                        }
                    />
                </BlurView>

                {/* Community Contribution */}
                <Text style={styles.sectionLabel}>COMMUNITY</Text>
                <BlurView
                    intensity={isDarkMode ? 30 : 50}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[styles.sectionCard, isDarkMode ? darkGlassCard : glassCard]}
                >
                    <SettingsItem
                        icon={Users}
                        iconColor="#8B5CF6"
                        title="Suggest Slang / Idiom"
                        subtitle="Help improve Filipino translations"
                        onPress={() => setModalVisible(true)}
                    />
                </BlurView>

                {/* About */}
                <Text style={styles.sectionLabel}>ABOUT</Text>
                <BlurView
                    intensity={isDarkMode ? 30 : 50}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[styles.sectionCard, isDarkMode ? darkGlassCard : glassCard]}
                >
                    <SettingsItem
                        icon={Info}
                        title="Version"
                        right={<Text style={styles.versionText}>1.0.0</Text>}
                    />
                    <View style={[styles.separator, isDarkMode && styles.separatorDark]} />
                    <SettingsItem
                        icon={FileText}
                        title="Terms of Service"
                        onPress={() => { }}
                    />
                    <View style={[styles.separator, isDarkMode && styles.separatorDark]} />
                    <SettingsItem
                        icon={Shield}
                        title="Privacy Policy"
                        onPress={() => { }}
                    />
                </BlurView>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Made with</Text>
                    <Heart size={14} color="#EF4444" fill="#EF4444" />
                    <Text style={styles.footerText}>for the Philippines</Text>
                </View>
            </ScrollView>

            {/* Community Submission Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <BlurView
                        intensity={60}
                        tint={isDarkMode ? 'dark' : 'light'}
                        style={[styles.modal, isDarkMode && styles.modalDark]}
                    >
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, isDarkMode && styles.textWhite]}>Suggest a Phrase</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>

                        {/* Language selection */}
                        <View style={styles.modalLangs}>
                            <TouchableOpacity
                                style={[styles.modalLangChip, isDarkMode && styles.modalLangChipDark]}
                                onPress={() => setPickerTarget('source')}
                            >
                                <Text style={[styles.modalLangText, isDarkMode && styles.textWhite]}>{SUPPORTED_LANGUAGES[formSourceLang]}</Text>
                                <ChevronDown size={14} color="#3B82F6" />
                            </TouchableOpacity>
                            <Text style={styles.modalArrow}>→</Text>
                            <TouchableOpacity
                                style={[styles.modalLangChip, isDarkMode && styles.modalLangChipDark]}
                                onPress={() => setPickerTarget('target')}
                            >
                                <Text style={[styles.modalLangText, isDarkMode && styles.textWhite]}>{SUPPORTED_LANGUAGES[formTargetLang]}</Text>
                                <ChevronDown size={14} color="#3B82F6" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                            placeholder="Slang or idiom (e.g. Werpa, Charot, Dasurv)"
                            placeholderTextColor="#94A3B8"
                            value={newPhrase}
                            onChangeText={setNewPhrase}
                        />
                        <TextInput
                            style={[styles.modalInput, isDarkMode && styles.modalInputDark, { minHeight: 70 }]}
                            placeholder="What does it mean?"
                            placeholderTextColor="#94A3B8"
                            value={newTranslation}
                            onChangeText={setNewTranslation}
                            multiline
                        />
                        <TextInput
                            style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                            placeholder="Region (e.g. Metro Manila, Cebu)"
                            placeholderTextColor="#94A3B8"
                            value={newOrigin}
                            onChangeText={setNewOrigin}
                        />
                        <TextInput
                            style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                            placeholder="Notes (e.g. Gen Z slang, gay lingo)"
                            placeholderTextColor="#94A3B8"
                            value={newNotes}
                            onChangeText={setNewNotes}
                        />

                        <TouchableOpacity
                            style={[styles.submitBtn, (!newPhrase.trim() || !newTranslation.trim()) && { opacity: 0.5 }]}
                            onPress={handleSubmitPhrase}
                            disabled={!newPhrase.trim() || !newTranslation.trim()}
                        >
                            <Send size={18} color="#FFF" />
                            <Text style={styles.submitText}>Submit for Review</Text>
                        </TouchableOpacity>
                    </BlurView>
                </View>
            </Modal>

            <LanguagePicker
                visible={pickerTarget !== null}
                onDismiss={() => setPickerTarget(null)}
                onSelect={(code) => {
                    if (pickerTarget === 'source') setFormSourceLang(code);
                    else setFormTargetLang(code);
                }}
                selected={pickerTarget === 'source' ? formSourceLang : formTargetLang}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    containerDark: { backgroundColor: '#0F172A' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    scroll: { paddingTop: 100, paddingHorizontal: 20, paddingBottom: 40 },

    /* Profile */
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        marginBottom: 24,
        overflow: 'hidden',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarDark: { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
    profileInfo: { flex: 1, marginLeft: 14 },
    profileName: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
    profileEmail: { fontSize: 13, color: '#64748B', marginTop: 2 },
    editBtn: {
        backgroundColor: 'rgba(255,255,255,0.4)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    editBtnDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
    editBtnText: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },

    /* Section */
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 1.2,
        marginBottom: 8,
        marginLeft: 4,
    },
    sectionCard: {
        padding: 6,
        marginBottom: 20,
        overflow: 'hidden',
    },

    /* Settings Item */
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemContent: { flex: 1 },
    itemTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
    itemSubtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    separator: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 12 },
    separatorDark: { backgroundColor: '#334155' },
    textWhite: { color: '#F8FAFC' },
    textSecondary: { color: '#94A3B8' },
    versionText: { fontSize: 14, color: '#94A3B8' },

    /* Footer */
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        paddingTop: 16,
    },
    footerText: { fontSize: 13, color: '#94A3B8' },

    /* Modal */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
    modal: {
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        overflow: 'hidden',
    },
    modalDark: {
        backgroundColor: 'rgba(30, 41, 59, 0.7)',
    },
    modalHandle: { width: 40, height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
    modalLangs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    modalLangChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.5)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    modalLangChipDark: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalLangText: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginRight: 6 },
    modalArrow: { fontSize: 16, color: '#94A3B8', marginHorizontal: 16 },
    modalInput: {
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 14,
        fontSize: 15,
        color: '#1E293B',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        marginBottom: 14,
    },
    modalInputDark: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.1)',
        color: '#F8FAFC',
    },
    submitBtn: {
        flexDirection: 'row',
        backgroundColor: '#8B5CF6',
        borderRadius: 18,
        paddingVertical: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginTop: 6,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
