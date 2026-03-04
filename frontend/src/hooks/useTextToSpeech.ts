/**
 * useTextToSpeech — Plays audio from backend TTS endpoint.
 * Fetches audio with proper headers (including ngrok-skip-browser-warning),
 * then plays via expo-av. Works on iPhone, Android, and Web.
 */
import { useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API = `${BASE_URL}/api/v1`;

interface TextToSpeechHook {
    speak: (text: string, langCode: string) => void;
    stop: () => void;
    isSupported: boolean;
}

export function useTextToSpeech(): TextToSpeechHook {
    const soundRef = useRef<Audio.Sound | null>(null);
    const isSupported = true;

    const speak = useCallback(async (text: string, langCode: string) => {
        if (!text.trim()) return;

        try {
            // Stop any previous audio
            if (soundRef.current) {
                try {
                    await soundRef.current.stopAsync();
                    await soundRef.current.unloadAsync();
                } catch { }
                soundRef.current = null;
            }

            // Configure audio for playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });

            const ttsUrl = `${API}/speech/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(langCode)}`;

            // For web: fetch with ngrok header, create blob URL, then play
            // For native: can pass URL directly but still need header handling
            const isWeb = Platform.OS === 'web';

            if (isWeb) {
                // Fetch audio with ngrok-skip-browser-warning header
                const response = await fetch(ttsUrl, {
                    headers: {
                        'ngrok-skip-browser-warning': 'true',
                    },
                });

                if (!response.ok) {
                    console.error('TTS fetch failed:', response.status);
                    // Fallback: use Web Speech API
                    _webSpeechFallback(text, langCode);
                    return;
                }

                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('audio')) {
                    console.warn('TTS returned non-audio content, using Web Speech API fallback');
                    _webSpeechFallback(text, langCode);
                    return;
                }

                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);

                const { sound } = await Audio.Sound.createAsync(
                    { uri: blobUrl },
                    { shouldPlay: true }
                );
                soundRef.current = sound;

                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        sound.unloadAsync();
                        soundRef.current = null;
                        URL.revokeObjectURL(blobUrl);
                    }
                });
            } else {
                // Native: expo-av can handle remote URLs with custom headers
                const { sound } = await Audio.Sound.createAsync(
                    { uri: ttsUrl, headers: { 'ngrok-skip-browser-warning': 'true' } },
                    { shouldPlay: true }
                );
                soundRef.current = sound;

                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        sound.unloadAsync();
                        soundRef.current = null;
                    }
                });
            }
        } catch (error) {
            console.error('TTS playback failed:', error);
            // Last resort: Web Speech API
            if (Platform.OS === 'web') {
                _webSpeechFallback(text, langCode);
            }
        }
    }, []);

    const stop = useCallback(async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch { }
            soundRef.current = null;
        }
    }, []);

    return {
        speak,
        stop,
        isSupported,
    };
}

/**
 * Web Speech API fallback — works natively in Chrome/Safari/Firefox.
 * No backend needed, but only supports languages the browser has voices for.
 */
function _webSpeechFallback(text: string, langCode: string) {
    try {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const langMap: Record<string, string> = {
            'tl': 'fil-PH',
            'en': 'en-US',
            'ceb': 'fil-PH',
            'hil': 'fil-PH',
        };

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langMap[langCode] || 'fil-PH';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.error('Web Speech API fallback failed:', e);
    }
}
