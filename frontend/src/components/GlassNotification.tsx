import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Dimensions, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Text } from 'react-native-paper';
import { liquidGlass } from '../theme';

interface GlassNotificationProps {
    visible: boolean;
    message: string;
    onHide: () => void;
    isDarkMode: boolean;
}

export default function GlassNotification({ visible, message, onHide, isDarkMode }: GlassNotificationProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 50, duration: 400, useNativeDriver: true }),
            ]).start();

            const timer = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
                    Animated.timing(slideAnim, { toValue: -100, duration: 400, useNativeDriver: true }),
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
                {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                }
            ]}
        >
            <BlurView
                intensity={30}
                tint={isDarkMode ? 'dark' : 'light'}
                style={[styles.pill, liquidGlass, isDarkMode && styles.pillDark]}
            >
                <Text style={[styles.text, isDarkMode && styles.textDark]}>{message}</Text>
            </BlurView>
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
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.4)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    pillDark: {
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
    },
    text: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    textDark: {
        color: '#F8FAFC',
    },
});
