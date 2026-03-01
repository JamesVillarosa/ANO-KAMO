/**
 * useTextToSpeech — Plays audio from Azure TTS backend endpoint.
 * Natural Filipino accent (BlessicaNeural). Works on iPhone, Android, and Web via expo-av.
 */
import { useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import { getTtsUrl } from '../lib/api';

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

            // Load and play audio from gTTS backend
            const ttsUrl = getTtsUrl(text, langCode);
            const { sound } = await Audio.Sound.createAsync(
                { uri: ttsUrl },
                { shouldPlay: true }
            );

            soundRef.current = sound;

            // Cleanup when done
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                    soundRef.current = null;
                }
            });

        } catch (error) {
            console.error('TTS playback failed:', error);
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
