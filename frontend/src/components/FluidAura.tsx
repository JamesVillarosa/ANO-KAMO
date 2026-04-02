/**
 * FluidAura — App background.
 *
 * Light mode: static background image (ano-kamo-background.jpg) — soft
 *   lavender/purple/rose gradient that defines the app's visual identity.
 * Dark mode:  animated mesh-gradient — deep navy base + breathing indigo,
 *   dark-teal, and violet blobs with warm umber accent.
 *
 * All dark-mode animations run on the native thread (opacity only).
 */
import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';

interface Props {
    isDarkMode?: boolean;
}

export default function FluidAura({ isDarkMode = false }: Props) {

    // ── Light mode: background image ─────────────────────────────
    if (!isDarkMode) {
        return (
            <ImageBackground
                source={require('../../assets/background.jpg')}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                pointerEvents="none"
            />
        );
    }

    // ── Dark mode: background image ───────────────────────────────
    return (
        <ImageBackground
            source={require('../../assets/background-dark.jpg')}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            pointerEvents="none"
        />
    );
}

const styles = StyleSheet.create({});
