/**
 * GlassBlur — drop-in replacement for expo-blur's BlurView.
 *
 * On iOS  : delegates to the real BlurView (native frosted glass).
 * On Android: BlurView doesn't blur at all — it just shows as white or
 *   transparent.  We replace it with a plain View whose background colour
 *   matches the intended tint so cards look clean and intentional.
 */
import React from 'react';
import { Platform, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';

interface Props {
    intensity?: number;
    tint?: 'light' | 'dark' | 'default' | 'extraLight' | 'prominent' | 'systemMaterial' | 'systemThickMaterial' | 'systemThinMaterial' | 'systemUltraThinMaterial' | 'systemChromeMaterial' | 'systemChromeMaterialDark' | 'systemChromeMaterialLight';
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    [key: string]: any;
}

export function GlassBlur({ intensity = 40, tint = 'light', style, children, ...rest }: Props) {
    if (Platform.OS === 'ios') {
        return (
            <BlurView intensity={intensity} tint={tint} style={style} {...rest}>
                {children}
            </BlurView>
        );
    }

    // Android fallback: simulate the glass tint with a subtle rgba background.
    const isDark = tint === 'dark' || tint === 'systemChromeMaterialDark';
    const androidBg: ViewStyle = isDark
        ? { backgroundColor: 'rgba(255, 255, 255, 0.07)' }
        : { backgroundColor: 'rgba(255, 255, 255, 0.38)' };

    return (
        <View style={[androidBg, style]} {...rest}>
            {children}
        </View>
    );
}

// Also export as default so it can be used as a named OR default import.
export default GlassBlur;
