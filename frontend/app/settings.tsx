import React, { useState } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity,
    Switch, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Moon, ChevronRight, Heart, Users, Send, X,
    Info, Shield, FileText,
} from 'lucide-react-native';
import { gradientColors, darkGradientColors, SUPPORTED_LANGUAGES } from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import { submitPhrase as apiSubmitPhrase } from '../src/lib/api';
import GlassCard from '../src/components/GlassCard';
import LanguagePicker from '../src/components/LanguagePicker';
import GlassNotification from '../src/components/GlassNotification';

export default function SettingsScreen() {
    const { isDarkMode, toggleTheme } = useTheme();
    const activeGradient = isDarkMode ? darkGradientColors : gradientColors;

    const [modalVisible, setModalVisible] = useState(false);
    const [newPhrase, setNewPhrase] = useState('');
    const [newTranslation, setNewTranslation] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [newOrigin, setNewOrigin] = useState('');
    const [newSampleSentence, setNewSampleSentence] = useState('');
    const [formSourceLang, setFormSourceLang] = useState('tl');
    const [formTargetLang, setFormTargetLang] = useState('en');
    const [pickerTarget, setPickerTarget] = useState<'source' | 'target' | null>(null);
    const [tosVisible, setTosVisible] = useState(false);
    const [privacyVisible, setPrivacyVisible] = useState(false);
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
            showNotification('Slang submission received. Thank you!');
        } catch {
            showNotification('Suggestion saved locally for sync.');
        }
        setModalVisible(false);
        setNewPhrase(''); setNewTranslation(''); setNewNotes('');
        setNewOrigin(''); setNewSampleSentence('');
    };

    const SettingsItem = ({
        icon: Icon, iconColor = '#3B82F6', title, subtitle, right, onPress,
    }: {
        icon: any; iconColor?: string; title: string; subtitle?: string;
        right?: React.ReactNode; onPress?: () => void;
    }) => (
        <TouchableOpacity
            style={styles.settingsItem}
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
            disabled={!onPress && !right}
        >
            <View style={[styles.iconBox, { backgroundColor: iconColor + '1A' }]}>
                <Icon size={17} color={iconColor} />
            </View>
            <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, isDarkMode && styles.textLight]}>{title}</Text>
                {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
            </View>
            {right ?? <ChevronRight size={16} color={isDarkMode ? '#475569' : '#CBD5E1'} />}
        </TouchableOpacity>
    );

    const inputStyle = [styles.modalInput, isDarkMode && styles.modalInputDark];

    return (
        <View style={styles.container}>
            <LinearGradient colors={[...activeGradient]} style={StyleSheet.absoluteFill} />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Brand Header */}
                <GlassCard style={styles.brandCard}>
                    <Text style={[styles.brandTitle, isDarkMode && styles.textLight]}>ANO-KAMO?</Text>
                    <Text style={styles.brandTagline}>AI-Powered Filipino Translation</Text>
                </GlassCard>

                {/* Preferences */}
                <Text style={styles.sectionLabel}>Preferences</Text>
                <GlassCard style={styles.sectionCard}>
                    <SettingsItem
                        icon={Moon}
                        iconColor="#6366F1"
                        title="Dark Mode"
                        right={
                            <Switch
                                value={isDarkMode}
                                onValueChange={toggleTheme}
                                trackColor={{ false: '#E2E8F0', true: '#6366F1' }}
                                thumbColor="#FFF"
                            />
                        }
                    />
                </GlassCard>

                {/* Community */}
                <Text style={styles.sectionLabel}>Community</Text>
                <GlassCard style={styles.sectionCard}>
                    <SettingsItem
                        icon={Users}
                        iconColor="#8B5CF6"
                        title="Suggest Slang / Idiom"
                        subtitle="Help improve Filipino translations"
                        onPress={() => setModalVisible(true)}
                    />
                </GlassCard>

                {/* About */}
                <Text style={styles.sectionLabel}>About</Text>
                <GlassCard style={styles.sectionCard}>
                    <SettingsItem
                        icon={Info}
                        iconColor="#3B82F6"
                        title="Version"
                        right={<Text style={styles.versionText}>1.0.0</Text>}
                    />
                    <View style={[styles.divider, isDarkMode && styles.dividerDark]} />
                    <SettingsItem
                        icon={FileText}
                        iconColor="#10B981"
                        title="Terms of Service"
                        onPress={() => setTosVisible(true)}
                    />
                    <View style={[styles.divider, isDarkMode && styles.dividerDark]} />
                    <SettingsItem
                        icon={Shield}
                        iconColor="#F59E0B"
                        title="Privacy Policy"
                        onPress={() => setPrivacyVisible(true)}
                    />
                </GlassCard>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Made with</Text>
                    <Heart size={13} color="#EF4444" fill="#EF4444" />
                    <Text style={styles.footerText}>for the Philippines</Text>
                </View>
            </ScrollView>

            {/* Suggest Slang Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View style={[styles.modalSheet, isDarkMode ? styles.modalSheetDark : styles.modalSheetLight]}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, isDarkMode && styles.textLight]}>Suggest a Slang</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                                <X size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <TextInput style={inputStyle} placeholder="Slang or idiom (e.g. Werpa, Charot)" placeholderTextColor="#94A3B8" value={newPhrase} onChangeText={setNewPhrase} />
                            <TextInput style={[...inputStyle, { minHeight: 70 }]} placeholder="What does it mean?" placeholderTextColor="#94A3B8" value={newTranslation} onChangeText={setNewTranslation} multiline />
                            <TextInput style={inputStyle} placeholder="Region (e.g. Metro Manila, Cebu)" placeholderTextColor="#94A3B8" value={newOrigin} onChangeText={setNewOrigin} />
                            <TextInput style={[...inputStyle, { minHeight: 60 }]} placeholder="Sample sentence" placeholderTextColor="#94A3B8" value={newSampleSentence} onChangeText={setNewSampleSentence} multiline />
                            <TextInput style={inputStyle} placeholder="Notes (e.g. Gen Z slang, gay lingo)" placeholderTextColor="#94A3B8" value={newNotes} onChangeText={setNewNotes} />
                            <TouchableOpacity
                                style={[styles.submitBtn, (!newPhrase.trim() || !newTranslation.trim()) && { opacity: 0.45 }]}
                                onPress={handleSubmitPhrase}
                                disabled={!newPhrase.trim() || !newTranslation.trim()}
                            >
                                <Send size={17} color="#FFF" />
                                <Text style={styles.submitText}>Submit for Review</Text>
                            </TouchableOpacity>
                            <View style={{ height: 30 }} />
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Terms of Service Modal */}
            <Modal visible={tosVisible} transparent animationType="fade" onRequestClose={() => setTosVisible(false)}>
                <View style={styles.legalOverlay}>
                    <View style={[styles.legalModal, isDarkMode ? styles.modalSheetDark : styles.modalSheetLight]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, isDarkMode && styles.textLight]}>Terms of Service</Text>
                            <TouchableOpacity onPress={() => setTosVisible(false)} style={styles.closeBtn}>
                                <X size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.legalText, isDarkMode && styles.textLight]}>
                                {`Welcome to Ano-Kamo?. By using our app, you agree to these terms.\n\n1. ACCEPTANCE OF TERMS\nUse of Ano-Kamo? constitutes acceptance of these terms.\n\n2. SERVICE DESCRIPTION\nAno-Kamo? provides translation services between Filipino languages (Tagalog, Cebuano, Hiligaynon) and English. We aim for accuracy but do not guarantee it.\n\n3. USER CONDUCT\nUsers agree not to submit offensive, harmful, or illegal content.\n\n4. INTELLECTUAL PROPERTY\nAll original content and software are the property of the Ano-Kamo? team.\n\n5. LIMITATION OF LIABILITY\nWe are not liable for any misunderstandings from incorrect translations.\n\n6. GOVERNING LAW\nThese terms follow the laws of the Republic of the Philippines.`}
                            </Text>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Privacy Policy Modal */}
            <Modal visible={privacyVisible} transparent animationType="fade" onRequestClose={() => setPrivacyVisible(false)}>
                <View style={styles.legalOverlay}>
                    <View style={[styles.legalModal, isDarkMode ? styles.modalSheetDark : styles.modalSheetLight]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, isDarkMode && styles.textLight]}>Privacy Policy</Text>
                            <TouchableOpacity onPress={() => setPrivacyVisible(false)} style={styles.closeBtn}>
                                <X size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.legalText, isDarkMode && styles.textLight]}>
                                {`Your privacy is important to us.\n\n1. DATA COLLECTION\nWe collect translation history and community suggestions. We do not sell your personal data.\n\n2. USE OF DATA\nCollected data is used purely to improve translation models and user experience.\n\n3. DATA SECURITY\nWe implement industry-standard security to protect your data.\n\n4. THIRD-PARTY SERVICES\nWe may use third-party tools (speech recognition) which have their own privacy policies.\n\n5. YOUR RIGHTS\nYou can clear your local history at any time through the History tab.\n\n6. UPDATES\nWe may update this policy occasionally. Continued use implies acceptance.`}
                            </Text>
                        </ScrollView>
                    </View>
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
    container: { flex: 1 },
    scroll: { paddingTop: 110, paddingHorizontal: 20, paddingBottom: 60 },

    brandCard: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, marginBottom: 28 },
    brandTitle: { fontSize: 26, fontWeight: '900', letterSpacing: 3, color: '#1E293B' },
    brandTagline: { fontSize: 13, color: '#94A3B8', marginTop: 6, letterSpacing: 0.3 },

    sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#94A3B8', marginBottom: 10, marginLeft: 6, textTransform: 'uppercase' },
    sectionCard: { marginBottom: 24, padding: 6 },

    settingsItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 18 },
    iconBox: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    itemContent: { flex: 1 },
    itemTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
    itemSubtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginHorizontal: 14 },
    dividerDark: { backgroundColor: 'rgba(255,255,255,0.06)' },
    versionText: { fontSize: 14, fontWeight: '500', color: '#94A3B8' },

    textLight: { color: '#F8FAFC' },

    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 20, paddingBottom: 8 },
    footerText: { fontSize: 13, color: '#94A3B8' },

    /* Modals */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 20, maxHeight: '92%' },
    modalSheetLight: { backgroundColor: 'rgba(248,250,255,0.97)' },
    modalSheetDark: { backgroundColor: 'rgba(15,23,42,0.97)' },
    modalHandle: { width: 38, height: 4, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.06)', justifyContent: 'center', alignItems: 'center' },
    modalInput: {
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 13,
        fontSize: 15,
        color: '#1E293B',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
        marginBottom: 12,
    },
    modalInputDark: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.1)',
        color: '#F8FAFC',
    },
    submitBtn: {
        flexDirection: 'row',
        backgroundColor: '#8B5CF6',
        borderRadius: 16,
        paddingVertical: 15,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginTop: 4,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 5,
    },
    submitText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

    legalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    legalModal: { width: '100%', maxHeight: '80%', borderRadius: 24, padding: 24 },
    legalText: { fontSize: 14, lineHeight: 22, color: '#475569' },
});
