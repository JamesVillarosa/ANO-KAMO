import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
    User,
    Moon,
    Volume2,
    Sparkles,
    Trash2,
    Download,
    Info,
    Shield,
    FileText,
    ChevronRight,
    Heart,
} from 'lucide-react-native';
import { gradientColors, darkGradientColors, glassCard, darkGlassCard } from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';

export default function SettingsScreen() {
    const { isDarkMode, toggleTheme } = useTheme();
    const activeGradient = isDarkMode ? darkGradientColors : gradientColors;
    const activeGlassCard = isDarkMode ? darkGlassCard : glassCard;

    const [highQualityAudio, setHighQualityAudio] = useState(true);
    const [autoDetectTone, setAutoDetectTone] = useState(true);

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
                <View style={[styles.profileCard, activeGlassCard]}>
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
                </View>

                {/* Preferences */}
                <Text style={styles.sectionLabel}>PREFERENCES</Text>
                <View style={[styles.sectionCard, activeGlassCard]}>
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
                    <View style={[styles.separator, isDarkMode && styles.separatorDark]} />
                    <SettingsItem
                        icon={Volume2}
                        iconColor="#10B981"
                        title="High Quality Audio"
                        subtitle="Better voice quality (uses more data)"
                        right={
                            <Switch
                                value={highQualityAudio}
                                onValueChange={setHighQualityAudio}
                                trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                                thumbColor="#FFF"
                            />
                        }
                    />
                    <View style={[styles.separator, isDarkMode && styles.separatorDark]} />
                    <SettingsItem
                        icon={Sparkles}
                        iconColor="#8B5CF6"
                        title="Auto-detect Tone"
                        subtitle="Automatically suggest translation tone"
                        right={
                            <Switch
                                value={autoDetectTone}
                                onValueChange={setAutoDetectTone}
                                trackColor={{ false: '#E2E8F0', true: '#8B5CF6' }}
                                thumbColor="#FFF"
                            />
                        }
                    />
                </View>

                {/* Data */}
                <Text style={styles.sectionLabel}>ACCOUNT & DATA</Text>
                <View style={[styles.sectionCard, activeGlassCard]}>
                    <SettingsItem
                        icon={Trash2}
                        iconColor="#EF4444"
                        title="Clear History"
                        onPress={() => { }}
                    />
                    <View style={[styles.separator, isDarkMode && styles.separatorDark]} />
                    <SettingsItem
                        icon={Download}
                        iconColor="#F59E0B"
                        title="Language Packages"
                        subtitle="Download for offline use"
                        onPress={() => { }}
                    />
                </View>

                {/* About */}
                <Text style={styles.sectionLabel}>ABOUT</Text>
                <View style={[styles.sectionCard, activeGlassCard]}>
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
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Made with</Text>
                    <Heart size={14} color="#EF4444" fill="#EF4444" />
                    <Text style={styles.footerText}>for the Philippines</Text>
                </View>
            </ScrollView>
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
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarDark: { backgroundColor: '#1E293B' },
    profileInfo: { flex: 1, marginLeft: 14 },
    profileName: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
    profileEmail: { fontSize: 13, color: '#64748B', marginTop: 2 },
    editBtn: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    editBtnDark: { backgroundColor: '#1E293B' },
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
});
