/**
 * useTextToSpeech — Plays audio from backend TTS endpoint.
 * Fixed: audio session awaited before playback, shouldPlay:false + separate playAsync,
 * proper unload before re-use, and state tracking (idle/loading/playing).
 */
import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API = `${BASE_URL}/api/v1`;

export type TtsState = 'idle' | 'loading' | 'playing';

interface TextToSpeechHook {
    speak: (text: string, langCode: string) => void;
    stop: () => void;
    isSupported: boolean;
    ttsState: TtsState;
    playingText: string;
}

export function useTextToSpeech(): TextToSpeechHook {
    const soundRef = useRef<Audio.Sound | null>(null);
    const [ttsState, setTtsState] = useState<TtsState>('idle');
    const [playingText, setPlayingText] = useState('');
    const isSupported = true;

    const stop = useCallback(async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch { }
            soundRef.current = null;
        }
        setTtsState('idle');
        setPlayingText('');
    }, []);

    const speak = useCallback(async (text: string, langCode: string) => {
        if (!text.trim()) return;

        try {
            // Unload any previous sound first
            if (soundRef.current) {
                try {
                    await soundRef.current.stopAsync();
                    await soundRef.current.unloadAsync();
                } catch { }
                soundRef.current = null;
            }

            setTtsState('loading');
            setPlayingText(text);

            // Audio session MUST be fully awaited before loading/playing
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                staysActiveInBackground: false,
            });

            const ttsUrl = `${API}/speech/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(langCode)}`;
            const isWeb = Platform.OS === 'web';

            if (isWeb) {
                // Fetch fully before creating sound
                const response = await fetch(ttsUrl, {
                    headers: { 'ngrok-skip-browser-warning': 'true' },
                });

                if (!response.ok) {
                    setTtsState('idle');
                    _webSpeechFallback(text, langCode);
                    return;
                }

                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('audio')) {
                    setTtsState('idle');
                    _webSpeechFallback(text, langCode);
                    return;
                }

                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);

                // Load with shouldPlay:false, then play separately
                const { sound } = await Audio.Sound.createAsync(
                    { uri: blobUrl },
                    { shouldPlay: false, progressUpdateIntervalMillis: 100 }
                );
                soundRef.current = sound;

                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        setTtsState('idle');
                        setPlayingText('');
                        sound.unloadAsync();
                        soundRef.current = null;
                        URL.revokeObjectURL(blobUrl);
                    }
                });

                setTtsState('playing');
                await sound.playAsync();
            } else {
                // Native: load with shouldPlay:false, then play separately
                const { sound } = await Audio.Sound.createAsync(
                    { uri: ttsUrl, headers: { 'ngrok-skip-browser-warning': 'true' } },
                    { shouldPlay: false, progressUpdateIntervalMillis: 100 }
                );
                soundRef.current = sound;

                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        setTtsState('idle');
                        setPlayingText('');
                        sound.unloadAsync();
                        soundRef.current = null;
                    }
                });

                setTtsState('playing');
                await sound.playAsync();
            }
        } catch (error) {
            console.error('TTS playback failed:', error);
            setTtsState('idle');
            setPlayingText('');
            if (Platform.OS === 'web') {
                _webSpeechFallback(text, langCode);
            }
        }
    }, []);

    return { speak, stop, isSupported, ttsState, playingText };
}

/**
 * Web Speech API fallback — works natively in Chrome/Safari/Firefox.
 */
function _webSpeechFallback(text: string, langCode: string) {
    try {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
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
