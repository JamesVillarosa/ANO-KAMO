import React from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, usePathname } from 'expo-router';
import { Type, Camera, MessageSquare } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const TABS = [
    { key: 'text', label: 'Text', icon: Type, route: '/' },
    { key: 'camera', label: 'Camera', icon: Camera, route: '/ocr' },
    { key: 'conversation', label: 'Conversation', icon: MessageSquare, route: '/conversation' },
];

export default function BottomNav() {
    const router = useRouter();
    const pathname = usePathname();

    const activeTab = pathname === '/' ? 'text'
        : pathname === '/ocr' ? 'camera'
            : pathname === '/conversation' ? 'conversation'
                : 'text';

    return (
        <View style={styles.container}>
            <View style={styles.nav}>
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const IconComponent = tab.icon;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.item, isActive && styles.itemActive]}
                            onPress={() => {
                                if (tab.route !== `/${pathname.replace('/', '')}` && !(tab.route === '/' && pathname === '/')) {
                                    router.push(tab.route as any);
                                }
                            }}
                        >
                            <IconComponent size={20} color={isActive ? '#1E293B' : '#64748B'} />
                            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    nav: {
        flexDirection: 'row',
        backgroundColor: 'rgba(241, 245, 249, 0.95)',
        borderRadius: 40,
        padding: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        width: width * 0.88,
        justifyContent: 'space-between',
    },
    item: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 30,
    },
    itemActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        marginLeft: 6,
    },
    labelActive: {
        color: '#1E293B',
    },
});
