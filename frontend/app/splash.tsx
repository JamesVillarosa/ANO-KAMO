import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { gradientColors } from '../src/theme';

export default function SplashScreen() {
    const router = useRouter();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.6)).current;
    const taglineAnim = useRef(new Animated.Value(0)).current;
    const dotOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Logo entrance
        Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 900,
                easing: Easing.out(Easing.back(1.5)),
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 700,
                useNativeDriver: true,
            }),
        ]).start(() => {
            // Tagline fade in
            Animated.timing(taglineAnim, {
                toValue: 1,
                duration: 500,
                delay: 200,
                useNativeDriver: true,
            }).start();

            // Loading dots pulse
            Animated.loop(
                Animated.sequence([
                    Animated.timing(dotOpacity, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(dotOpacity, {
                        toValue: 0.2,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ]),
            ).start();
        });

        // Navigate after 3s to allow user to appreciate the logo
        const timer = setTimeout(() => {
            router.replace('/index' as any);
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.container}>
            <LinearGradient colors={[...gradientColors]} style={styles.bg} />

            <Animated.View
                style={[
                    styles.logoWrap,
                    { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
                ]}
            >
                {/* Image Logo */}
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../assets/logo.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </View>

                {/* Title */}
                <Text style={styles.title}>ANO-KAMO?</Text>

                {/* Tagline */}
                <Animated.View style={{ opacity: taglineAnim }}>
                    <Text style={styles.tagline}>
                        Your Filipino Language Companion
                    </Text>
                </Animated.View>
            </Animated.View>

            {/* Loading dots */}
            <Animated.View style={[styles.dotsRow, { opacity: dotOpacity }]}>
                <View style={styles.dot} />
                <View style={[styles.dot, { marginHorizontal: 6 }]} />
                <View style={styles.dot} />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    logoWrap: {
        alignItems: 'center',
    },
    logoContainer: {
        width: 140,
        height: 140,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        padding: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    logoImage: {
        width: '90%',
        height: '90%',
    },
    title: {
        fontSize: 38,
        fontWeight: '900',
        letterSpacing: 3,
        color: '#1E293B',
        marginBottom: 8,
    },
    tagline: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    dotsRow: {
        flexDirection: 'row',
        position: 'absolute',
        bottom: 100,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3B82F6',
    },
});
