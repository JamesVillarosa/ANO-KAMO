import React from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Type, Camera, MessageSquare } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const TABS = [
    { key: 'text', label: 'Text', icon: Type, route: '/' },
    { key: 'camera', label: 'Camera', icon: Camera, route: '/translate' },
    { key: 'conversation', label: 'Conversation', icon: MessageSquare, route: '/conversation' },
];

export default function BottomNav() {
    const router = useRouter();
    const pathname = usePathname();
    const { isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();

    const activeTab = pathname === '/' ? 'text'
        : pathname === '/translate' ? 'camera'
        : pathname === '/conversation' ? 'conversation'
        : 'text';

    const activeColor = isDarkMode ? '#F8FAFC' : '#1E293B';
    const inactiveColor = '#94A3B8';

    const navStyle = isDarkMode ? styles.navDark : styles.navLight;

    const NavContent = () => (
        <>
            {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const IconComponent = tab.icon;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.item, isActive && (isDarkMode ? styles.itemActiveDark : styles.itemActiveLight)]}
                        onPress={() => {
                            if (!(tab.route === '/' && pathname === '/') && tab.route !== pathname) {
                                router.push(tab.route as any);
                            }
                        }}
                        activeOpacity={0.75}
                    >
                        <IconComponent size={18} color={isActive ? activeColor : inactiveColor} strokeWidth={isActive ? 2.5 : 2} />
                        <Text style={[styles.label, isActive ? (isDarkMode ? styles.labelActiveDark : styles.labelActiveLight) : styles.labelInactive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </>
    );

    return (
        <View style={[styles.container, { bottom: 28 + insets.bottom }]} pointerEvents="box-none">
            {Platform.OS === 'ios' ? (
                <BlurView intensity={28} tint={isDarkMode ? 'dark' : 'light'} style={[styles.nav, navStyle]}>
                    <NavContent />
                </BlurView>
            ) : (
                <View style={[styles.nav, navStyle]}>
                    <NavContent />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    nav: {
        flexDirection: 'row',
        borderRadius: 40,
        padding: 6,
        width: width * 0.88,
        justifyContent: 'space-between',
        overflow: 'hidden',
    },
    navLight: {
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.95)',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 10,
    },
    navDark: {
        backgroundColor: 'rgba(15,23,42,0.9)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
    },
    item: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 30,
        gap: 6,
    },
    itemActiveLight: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    itemActiveDark: {
        backgroundColor: '#1E293B',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        elevation: 3,
    },
    label: { fontSize: 12, fontWeight: '600' },
    labelActiveLight: { color: '#1E293B' },
    labelActiveDark: { color: '#F8FAFC' },
    labelInactive: { color: '#94A3B8' },
});
