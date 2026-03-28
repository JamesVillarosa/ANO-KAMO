/**
 * FluidAura — Animated "Fluid Aura" mesh-gradient background.
 *
 * Light mode: soft lavender base + breathing misty-blue, peach, and
 *   indigo blobs with a whisper of warm umber at the bottom.
 * Dark mode:  deep navy base + breathing indigo, dark-teal, and
 *   violet blobs with the same umber warmth.
 *
 * All animations run on the native thread (opacity only).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
    isDarkMode?: boolean;
}

export default function FluidAura({ isDarkMode = false }: Props) {
    const a1 = useRef(new Animated.Value(0)).current;
    const a2 = useRef(new Animated.Value(0)).current;
    const a3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const breathe = (anim: Animated.Value, halfMs: number, delayMs: number) =>
            Animated.sequence([
                Animated.delay(delayMs),
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: 1,
                            duration: halfMs,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim, {
                            toValue: 0,
                            duration: halfMs,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ]),
                ),
            ]);

        const master = Animated.parallel([
            breathe(a1, 5000, 0),
            breathe(a2, 6500, 1800),
            breathe(a3, 4500, 3500),
        ]);
        master.start();
        return () => master.stop();
    }, []);

    if (isDarkMode) {
        return (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {/* Base: deep navy → dark indigo */}
                <LinearGradient
                    colors={['#0F172A', '#1E1B4B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                {/* Blob 1: indigo (top-right) */}
                <Animated.View style={[styles.blobTopRight, {
                    opacity: a1.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.5] }),
                }]}>
                    <LinearGradient
                        colors={['rgba(49,46,129,0.95)', 'rgba(49,46,129,0.4)', 'transparent']}
                        start={{ x: 1, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
                {/* Blob 2: dark teal (bottom-left) */}
                <Animated.View style={[styles.blobBottomLeft, {
                    opacity: a2.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.42] }),
                }]}>
                    <LinearGradient
                        colors={['rgba(30,58,95,0.95)', 'rgba(30,58,95,0.4)', 'transparent']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
                {/* Blob 3: deep violet (center) */}
                <Animated.View style={[styles.blobCenter, {
                    opacity: a3.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.38] }),
                }]}>
                    <LinearGradient
                        colors={['transparent', 'rgba(45,27,105,0.85)', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
                {/* Umber warmth accent */}
                <View style={styles.blobUmber}>
                    <LinearGradient
                        colors={['transparent', 'rgba(141,85,36,0.10)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                </View>
            </View>
        );
    }

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Base: soft lavender */}
            <LinearGradient
                colors={['#EEF2FF', '#E0E7FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {/* Blob 1: misty blue (top-right, breathing) */}
            <Animated.View style={[styles.blobTopRight, {
                opacity: a1.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.92] }),
            }]}>
                <LinearGradient
                    colors={['rgba(186,230,253,0.95)', 'rgba(224,242,254,0.55)', 'transparent']}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
            {/* Blob 2: light peach/rose (bottom-left, breathing) */}
            <Animated.View style={[styles.blobBottomLeft, {
                opacity: a2.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.82] }),
            }]}>
                <LinearGradient
                    colors={['rgba(254,205,211,0.95)', 'rgba(255,241,242,0.55)', 'transparent']}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
            {/* Blob 3: soft indigo/violet (center, breathing) */}
            <Animated.View style={[styles.blobCenter, {
                opacity: a3.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.55] }),
            }]}>
                <LinearGradient
                    colors={['transparent', 'rgba(199,210,254,0.88)', 'rgba(221,214,254,0.55)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
            {/* Umber warmth accent — "Kayumanggi" hint */}
            <View style={styles.blobUmber}>
                <LinearGradient
                    colors={['transparent', 'rgba(141,85,36,0.07)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    blobTopRight: {
        position: 'absolute',
        width: W * 1.1,
        height: H * 0.58,
        top: -H * 0.06,
        right: -W * 0.08,
    },
    blobBottomLeft: {
        position: 'absolute',
        width: W * 1.05,
        height: H * 0.52,
        bottom: -H * 0.04,
        left: -W * 0.08,
    },
    blobCenter: {
        position: 'absolute',
        width: W * 0.88,
        height: H * 0.42,
        top: H * 0.3,
        left: W * 0.06,
    },
    blobUmber: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: H * 0.3,
    },
});
