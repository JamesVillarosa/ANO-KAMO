import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, View } from 'react-native';
import { Text } from 'react-native-paper';

interface GlassNotificationProps {
    visible: boolean;
    message: string;
    onHide: () => void;
    isDarkMode: boolean;
}

export default function GlassNotification({ visible, message, onHide, isDarkMode }: GlassNotificationProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-80)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 50, duration: 300, useNativeDriver: true }),
            ]).start();

            const timer = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                    Animated.timing(slideAnim, { toValue: -80, duration: 300, useNativeDriver: true }),
                ]).start(() => onHide());
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
        >
            {/* Solid pill — color inverts with theme so it always stands out */}
            <View style={[styles.pill, isDarkMode ? styles.pillDark : styles.pillLight]}>
                <Text style={[styles.text, isDarkMode ? styles.textDark : styles.textLight]}>
                    {message}
                </Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
    },
    pill: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 12,
    },
    // Light theme: dark pill so it contrasts against bright backgrounds
    pillLight: {
        backgroundColor: '#1d2737',
    },
    // Dark theme: lighter surface pill so it contrasts against dark backgrounds
    pillDark: {
        backgroundColor: '#334155',
    },
    text: {
        fontSize: 14,
        fontWeight: '600',
    },
    textLight: {
        color: '#F8FAFC',
    },
    textDark: {
        color: '#F1F5F9',
    },
});
