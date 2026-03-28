import React from 'react';
import { Platform, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';

interface Props {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    intensity?: number;
    dark?: boolean;
}

export default function GlassCard({ children, style, intensity = 40, dark }: Props) {
    const { isDarkMode } = useTheme();
    const useDark = dark !== undefined ? dark : isDarkMode;

    const baseStyle: ViewStyle = useDark ? {
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 8,
        overflow: 'hidden',
    } : {
        backgroundColor: 'rgba(255,255,255,0.75)',
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.95)',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 6,
        overflow: 'hidden',
    };

    if (Platform.OS === 'ios') {
        return (
            <BlurView intensity={intensity} tint={useDark ? 'dark' : 'light'} style={[baseStyle, style]}>
                {children}
            </BlurView>
        );
    }
    return <View style={[baseStyle, style]}>{children}</View>;
}
