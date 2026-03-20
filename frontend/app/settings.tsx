import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Switch, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
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
import GlassNotification from '../src/components/GlassNotification';

export default function SettingsScreen() {
    const { isDarkMode, toggleTheme } = useTheme();
    const activeGradient = isDarkMode ? darkGradientColors : gradientColors;

    // Community submission modal
    const [modalVisible, setModalVisible] = useState(false);
    const [newPhrase, setNewPhrase] = useState('');
    const [newTranslation, setNewTranslation] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [newOrigin, setNewOrigin] = useState('');
    const [newSampleSentence, setNewSampleSentence] = useState('');
    const [formSourceLang, setFormSourceLang] = useState('tl');
    const [formTargetLang, setFormTargetLang] = useState('en');
    const [pickerTarget, setPickerTarget] = useState<'source' | 'target' | null>(null);

    // Legal modals
    const [tosVisible, setTosVisible] = useState(false);
    const [privacyVisible, setPrivacyVisible] = useState(false);

    // Notification state
    const [notifVisible, setNotifVisible] = useState(false);
    const [notifMessage, setNotifMessage] = useState('');

    const showNotification = (msg: string) => {
        setNotifMessage(msg);
        setNotifVisible(true);
    };

    const handleSubmitPhrase = async () => {
        if (!newPhrase.trim() || !newTranslation.trim()) {
            showNotification('Please fill in both phrase and translation.');
            return;
        }
        try {
            await apiSubmitPhrase(newPhrase, 'tl', 'en', newTranslation, newNotes, newOrigin, newSampleSentence);
            showNotification('Slang submission received. Thank you.');
        } catch {
            showNotification('Suggestion saved locally for sync.');
        }
        setModalVisible(false);
        setNewPhrase('');
        setNewTranslation('');
        setNewNotes('');
        setNewOrigin('');
        setNewSampleSentence('');
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
                {/* App Logo Header */}
                <BlurView
                    intensity={isDarkMode ? 30 : 50}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[styles.logoCard, isDarkMode ? darkGlassCard : glassCard]}
                >
                    <Text style={[styles.logoTitle, isDarkMode && styles.textWhite]}>ANO-KAMO?</Text>
                    <Text style={[styles.logoTagline, isDarkMode && styles.textSecondary]}>
                        AI-Powered Filipino Translation
                    </Text>
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
                        onPress={() => setTosVisible(true)}
                    />
                    <View style={[styles.separator, isDarkMode && styles.separatorDark]} />
                    <SettingsItem
                        icon={Shield}
                        title="Privacy Policy"
                        onPress={() => setPrivacyVisible(true)}
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
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ width: '100%' }}
                    >
                        <BlurView
                            intensity={60}
                            tint={isDarkMode ? 'dark' : 'light'}
                            style={[styles.modal, isDarkMode && styles.modalDark]}
                        >
                            <View style={styles.modalHandle} />
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                <View style={styles.modalHeader}>
                                    <Text style={[styles.modalTitle, isDarkMode && styles.textWhite]}>Suggest a Slang</Text>
                                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                                        <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
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
                                    style={[styles.modalInput, isDarkMode && styles.modalInputDark, { minHeight: 60 }]}
                                    placeholder="Sample sentence (e.g. 'Omsim ka talaga!')"
                                    placeholderTextColor="#94A3B8"
                                    value={newSampleSentence}
                                    onChangeText={setNewSampleSentence}
                                    multiline
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
                            </ScrollView>
                        </BlurView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Terms of Service Modal */}
            <Modal visible={tosVisible} transparent animationType="fade" onRequestClose={() => setTosVisible(false)}>
                <View style={styles.legalModalOverlay}>
                    <BlurView intensity={80} tint={isDarkMode ? 'dark' : 'light'} style={[styles.legalModal, isDarkMode && styles.modalDark]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, isDarkMode && styles.textWhite]}>Terms of Service</Text>
                            <TouchableOpacity onPress={() => setTosVisible(false)}>
                                <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.legalText, isDarkMode && styles.textWhite]}>
                                Welcome to Ano-Kamo?. By using our app, you agree to these terms.
                                {"\n\n"}
                                1. ACCEPTANCE OF TERMS{"\n"}
                                Use of Ano-Kamo? constitutes acceptance of these terms. If you do not agree, please discontinue use.
                                {"\n\n"}
                                2. SERVICE DESCRIPTION{"\n"}
                                Ano-Kamo? provides translation services between Filipino languages (Tagalog, Cebuano, Hiligaynon) and English. We aim for accuracy but do not guarantee it.
                                {"\n\n"}
                                3. USER CONDUCT{"\n"}
                                Users agree not to submit offensive, harmful, or illegal content through our community contribution features.
                                {"\n\n"}
                                4. INTELLECTUAL PROPERTY{"\n"}
                                All original content and software are the property of the Ano-Kamo? team.
                                {"\n\n"}
                                5. LIMITATION OF LIABILITY{"\n"}
                                We are not liable for any misunderstandings or damages resulting from incorrect translations or service interruptions.
                                {"\n\n"}
                                6. GOVERNING LAW{"\n"}
                                These terms follow the laws of the Republic of the Philippines.
                            </Text>
                        </ScrollView>
                    </BlurView>
                </View>
            </Modal>

            {/* Privacy Policy Modal */}
            <Modal visible={privacyVisible} transparent animationType="fade" onRequestClose={() => setPrivacyVisible(false)}>
                <View style={styles.legalModalOverlay}>
                    <BlurView intensity={80} tint={isDarkMode ? 'dark' : 'light'} style={[styles.legalModal, isDarkMode && styles.modalDark]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, isDarkMode && styles.textWhite]}>Privacy Policy</Text>
                            <TouchableOpacity onPress={() => setPrivacyVisible(false)}>
                                <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.legalText, isDarkMode && styles.textWhite]}>
                                Your privacy is important to us.
                                {"\n\n"}
                                1. DATA COLLECTION{"\n"}
                                We collect translation history and community suggestions. We do not sell your personal data.
                                {"\n\n"}
                                2. USE OF DATA{"\n"}
                                Collected data is used purely to improve translation models and user experience.
                                {"\n\n"}
                                3. DATA SECURITY{"\n"}
                                We implement industry-standard security to protect your data stored on our servers.
                                {"\n\n"}
                                4. THIRD-PARTY SERVICES{"\n"}
                                We may use third-party tools (like speech recognition) which have their own privacy policies.
                                {"\n\n"}
                                5. YOUR RIGHTS{"\n"}
                                You can clear your local history at any time through the History tab.
                                {"\n\n"}
                                6. UPDATES{"\n"}
                                We may update this policy occasionally. Continued use of the app implies acceptance of updates.
                            </Text>
                        </ScrollView>
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
            <GlassNotification
                visible={notifVisible}
                message={notifMessage}
                onHide={() => setNotifVisible(false)}
                isDarkMode={isDarkMode}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    containerDark: { backgroundColor: '#0F172A' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    scroll: { paddingTop: 100, paddingHorizontal: 20, paddingBottom: 40 },

    /* Logo Header */
    logoCard: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
        marginBottom: 24,
        overflow: 'hidden',
    },
    logoTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1E293B',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    logoTagline: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 6,
        letterSpacing: 0.5,
    },

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
    legalModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    legalModal: { width: '90%', maxHeight: '80%', padding: 24, borderRadius: 24, overflow: 'hidden' },
    legalText: { fontSize: 14, lineHeight: 22, color: '#475569' },
});
