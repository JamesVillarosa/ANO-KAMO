/**
 * useTextToSpeech — Plays audio from backend TTS endpoint.
 * Fixed: audio session awaited before playback, shouldPlay:false + separate playAsync,
 * proper unload before re-use, and state tracking (idle/loading/playing).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API = `${BASE_URL}/api/v1`;

export type TtsState = 'idle' | 'loading' | 'playing';

interface TextToSpeechHook {
    speak: (text: string, langCode: string, onFinish?: () => void) => void;
    stop: () => void;
    isSupported: boolean;
    ttsState: TtsState;
    playingText: string;
}

export function useTextToSpeech(): TextToSpeechHook {
    const soundRef = useRef<Audio.Sound | null>(null);
    const [ttsState, setTtsState] = useState<TtsState>('idle');
    const [playingText, setPlayingText] = useState('');
    // Prevents concurrent speak() calls (double-tap protection)
    const isLoadingRef = useRef(false);
    // Cancellation token: incremented by stop() so speak() aborts after any async op
    const cancelTokenRef = useRef(0);
    const isSupported = true;

    // Set up audio session once at mount so the first speak() has no setup delay
    useEffect(() => {
        Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            staysActiveInBackground: false,
        }).catch(() => {});
    }, []);

    const stop = useCallback(async () => {
        // Increment token so any in-flight speak() detects cancellation
        cancelTokenRef.current += 1;
        isLoadingRef.current = false;
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch { }
            soundRef.current = null;
        }
        // Cancel web speech fallback if active
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setTtsState('idle');
        setPlayingText('');
    }, []);

    const speak = useCallback(async (text: string, langCode: string, onFinish?: () => void) => {
        // Collapse newlines/vertical spacing into single spaces so TTS reads
        // multi-line signage (e.g. "Bawal\nTumawid\nDito") as one flowing sentence.
        const normalizedText = text.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (!normalizedText) return;
        // Shadow the parameter so all downstream code uses the normalised string
        text = normalizedText;
        // Double-tap guard: reject if a load is already in progress
        if (isLoadingRef.current) return;
        isLoadingRef.current = true;

        // Capture token at the start — if it changes, stop() was called during our await
        const myToken = ++cancelTokenRef.current;
        const isCancelled = () => cancelTokenRef.current !== myToken;

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

            // Audio session is already configured at mount — no await needed here

            const ttsUrl = `${API}/speech/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(langCode)}`;
            const isWeb = Platform.OS === 'web';

            if (isWeb) {
                // Fetch fully before creating sound
                const response = await fetch(ttsUrl, {
                    headers: { 'ngrok-skip-browser-warning': 'true' },
                });

                if (isCancelled()) { setTtsState('idle'); setPlayingText(''); return; }

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
                if (isCancelled()) { setTtsState('idle'); setPlayingText(''); return; }

                const blobUrl = URL.createObjectURL(blob);

                // Load with shouldPlay:false, then play separately
                const { sound } = await Audio.Sound.createAsync(
                    { uri: blobUrl },
                    { shouldPlay: false, progressUpdateIntervalMillis: 100 }
                );

                if (isCancelled()) {
                    sound.unloadAsync().catch(() => {});
                    URL.revokeObjectURL(blobUrl);
                    setTtsState('idle');
                    setPlayingText('');
                    return;
                }

                soundRef.current = sound;

                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        setTtsState('idle');
                        setPlayingText('');
                        sound.unloadAsync();
                        soundRef.current = null;
                        URL.revokeObjectURL(blobUrl);
                        onFinish?.();
                    }
                });

                setTtsState('playing');
                await sound.playAsync();
            } else {
                // Native: fetch with headers first (bypasses tunnel browser-warning pages
                // that cause the native media player to receive HTML instead of audio).
                // Retry up to 2 times on transient gateway errors (502/503/504).
                let response: Response | null = null;
                for (let attempt = 0; attempt <= 2; attempt++) {
                    if (isCancelled()) { setTtsState('idle'); setPlayingText(''); return; }
                    response = await fetch(ttsUrl, {
                        headers: { 'ngrok-skip-browser-warning': 'true' },
                    });
                    if (response.ok || ![502, 503, 504].includes(response.status)) break;
                    if (attempt < 2) await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
                }
                response = response!;

                if (isCancelled()) { setTtsState('idle'); setPlayingText(''); return; }

                if (!response.ok) {
                    throw new Error(`TTS request failed with status ${response.status}`);
                }

                // 204 No Content = backend has no audio for this language
                if (response.status === 204) {
                    setTtsState('idle');
                    setPlayingText('');
                    return;
                }

                const arrayBuffer = await response.arrayBuffer();
                if (isCancelled()) { setTtsState('idle'); setPlayingText(''); return; }

                if (arrayBuffer.byteLength === 0) {
                    setTtsState('idle');
                    setPlayingText('');
                    return;
                }

                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                const base64 = btoa(binary);

                const tempUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
                await FileSystem.writeAsStringAsync(tempUri, base64, {
                    encoding: 'base64',
                });

                if (isCancelled()) {
                    FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
                    setTtsState('idle');
                    setPlayingText('');
                    return;
                }

                const { sound } = await Audio.Sound.createAsync(
                    { uri: tempUri },
                    { shouldPlay: false, progressUpdateIntervalMillis: 100 }
                );

                if (isCancelled()) {
                    sound.unloadAsync().catch(() => {});
                    FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
                    setTtsState('idle');
                    setPlayingText('');
                    return;
                }

                soundRef.current = sound;

                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        setTtsState('idle');
                        setPlayingText('');
                        sound.unloadAsync();
                        soundRef.current = null;
                        FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
                        onFinish?.();
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
        } finally {
            // Release the guard once loading is done (playback continues independently)
            isLoadingRef.current = false;
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
