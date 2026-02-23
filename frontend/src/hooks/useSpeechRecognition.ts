/**
 * useSpeechRecognition — Custom hook for Web Speech API
 * Provides real-time speech-to-text for Tagalog, English, Cebuano, and Hiligaynon.
 * Free, browser-native (Chrome/Edge only).
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

// Map app language codes to Web Speech API BCP-47 locales
const LANG_TO_LOCALE: Record<string, string> = {
    tl: 'fil',        // Tagalog → Filipino
    en: 'en-US',      // English
    ceb: 'fil',       // Cebuano → closest: Filipino
    hil: 'fil',       // Hiligaynon → closest: Filipino
};

interface SpeechRecognitionHook {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    startListening: () => void;
    stopListening: () => void;
    isSupported: boolean;
}

export function useSpeechRecognition(langCode: string): SpeechRecognitionHook {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const recognitionRef = useRef<any>(null);

    // Only supported on web (Chrome/Edge)
    const isSupported =
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch { }
                recognitionRef.current = null;
            }
        };
    }, []);

    const startListening = useCallback(() => {
        if (!isSupported) {
            console.warn('Speech recognition is not supported in this browser.');
            return;
        }

        // Stop any existing session
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch { }
        }

        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        const recognition = new SpeechRecognition();
        const locale = LANG_TO_LOCALE[langCode] || 'fil';

        recognition.lang = locale;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            setTranscript('');
            setInterimTranscript('');
        };

        recognition.onresult = (event: any) => {
            let finalText = '';
            let interimText = '';

            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalText += result[0].transcript;
                } else {
                    interimText += result[0].transcript;
                }
            }

            setTranscript(finalText);
            setInterimTranscript(interimText);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [isSupported, langCode]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch { }
        }
        setIsListening(false);
    }, []);

    return {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        isSupported,
    };
}
