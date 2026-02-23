/**
 * useTextToSpeech — Custom hook for Web Speech Synthesis API
 * Provides free text-to-speech with Filipino accent preference.
 * Browser-native (Chrome/Edge/Safari).
 */
import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

// Map app language codes to BCP-47 for voice selection
const LANG_TO_LOCALE: Record<string, string> = {
    tl: 'fil-PH',
    en: 'en-US',
    ceb: 'fil-PH',
    hil: 'fil-PH',
};

// Preferred voice name substrings for Filipino accent (ordered by preference)
const FILIPINO_VOICE_HINTS = ['filipino', 'fil', 'tagalog', 'google filipino', 'microsoft mark'];

function findBestVoice(langCode: string): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;

    const voices = window.speechSynthesis.getVoices();
    const locale = LANG_TO_LOCALE[langCode] || 'fil-PH';
    const langPrefix = locale.split('-')[0]; // 'fil' or 'en'

    // 1. Try exact locale match (e.g. fil-PH)
    const exactMatch = voices.find(v => v.lang === locale);
    if (exactMatch) return exactMatch;

    // 2. Try language prefix match (e.g. fil)
    const prefixMatch = voices.find(v => v.lang.startsWith(langPrefix));
    if (prefixMatch) return prefixMatch;

    // 3. Try hint-based search for Filipino voices
    if (langPrefix === 'fil') {
        for (const hint of FILIPINO_VOICE_HINTS) {
            const hintMatch = voices.find(v =>
                v.name.toLowerCase().includes(hint) ||
                v.lang.toLowerCase().includes(hint)
            );
            if (hintMatch) return hintMatch;
        }
    }

    // 4. Fallback: default voice
    return null;
}

interface TextToSpeechHook {
    speak: (text: string, langCode: string) => void;
    stop: () => void;
    isSpeaking: boolean;
    isSupported: boolean;
}

export function useTextToSpeech(): TextToSpeechHook {
    const isSpeakingRef = useRef(false);

    const isSupported =
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        'speechSynthesis' in window;

    const speak = useCallback((text: string, langCode: string) => {
        if (!isSupported || !text.trim()) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        const locale = LANG_TO_LOCALE[langCode] || 'fil-PH';
        utterance.lang = locale;
        utterance.rate = 0.9;  // Slightly slower for clarity
        utterance.pitch = 1.0;

        // Try to find the best Filipino voice
        const voice = findBestVoice(langCode);
        if (voice) {
            utterance.voice = voice;
        }

        utterance.onstart = () => { isSpeakingRef.current = true; };
        utterance.onend = () => { isSpeakingRef.current = false; };
        utterance.onerror = () => { isSpeakingRef.current = false; };

        window.speechSynthesis.speak(utterance);
    }, [isSupported]);

    const stop = useCallback(() => {
        if (isSupported) {
            window.speechSynthesis.cancel();
            isSpeakingRef.current = false;
        }
    }, [isSupported]);

    return {
        speak,
        stop,
        isSpeaking: isSpeakingRef.current,
        isSupported,
    };
}
