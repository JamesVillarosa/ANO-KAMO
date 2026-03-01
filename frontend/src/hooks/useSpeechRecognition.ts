/**
 * useSpeechRecognition — Records audio via expo-av, auto-stops on silence,
 * sends to Groq Whisper V3 via backend for transcription.
 * Works on iPhone, Android, and Web.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { transcribeAudio } from '../lib/api';

// Silence detection config
const SILENCE_THRESHOLD = -40;       // dB — below this = silence
const SILENCE_DURATION_MS = 2000;    // auto-stop after 2s of silence
const METERING_INTERVAL_MS = 300;    // check audio level every 300ms

interface SpeechRecognitionHook {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    startListening: () => void;
    stopListening: () => void;
    isSupported: boolean;
    isProcessing: boolean;
}

export function useSpeechRecognition(langCode: string): SpeechRecognitionHook {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const recordingRef = useRef<Audio.Recording | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isStoppingRef = useRef(false);

    const isSupported = true;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (recordingRef.current) {
                try { recordingRef.current.stopAndUnloadAsync(); } catch { }
                recordingRef.current = null;
            }
        };
    }, []);

    const processRecording = useCallback(async (recording: Audio.Recording) => {
        setIsProcessing(true);
        setInterimTranscript('Transcribing...');

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();

            if (!uri) {
                setInterimTranscript('');
                setIsProcessing(false);
                return;
            }

            // Reset audio mode for playback
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

            // Send to Groq Whisper via backend
            const result = await transcribeAudio(uri, langCode);
            const text = result.text || '';

            setTranscript(text);
            setInterimTranscript('');
            setIsProcessing(false);

        } catch (error) {
            console.error('Transcription failed:', error);
            setTranscript('');
            setInterimTranscript('');
            setIsProcessing(false);
        }
    }, [langCode]);

    const startListening = useCallback(async () => {
        if (isStoppingRef.current) return;

        try {
            // Request permissions
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                console.warn('Microphone permission not granted');
                return;
            }

            // Configure audio mode for recording
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Reset state
            setTranscript('');
            setInterimTranscript('Listening...');
            isStoppingRef.current = false;

            // Start recording with metering enabled
            const { recording } = await Audio.Recording.createAsync(
                {
                    ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
                    isMeteringEnabled: true,
                }
            );

            recordingRef.current = recording;
            setIsListening(true);

            // Monitor audio levels for silence detection
            recording.setProgressUpdateInterval(METERING_INTERVAL_MS);
            recording.setOnRecordingStatusUpdate((status) => {
                if (!status.isRecording || isStoppingRef.current) return;

                const metering = status.metering ?? -160;

                if (metering < SILENCE_THRESHOLD) {
                    // Silence detected — start/continue silence timer
                    if (!silenceTimerRef.current) {
                        silenceTimerRef.current = setTimeout(() => {
                            // Still silent after SILENCE_DURATION_MS → auto-stop
                            if (recordingRef.current && !isStoppingRef.current) {
                                isStoppingRef.current = true;
                                setIsListening(false);
                                setInterimTranscript('Transcribing...');

                                const rec = recordingRef.current;
                                recordingRef.current = null;
                                silenceTimerRef.current = null;
                                processRecording(rec);
                            }
                        }, SILENCE_DURATION_MS);
                    }
                } else {
                    // Sound detected — reset silence timer
                    if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                    }
                }
            });

        } catch (error) {
            console.error('Failed to start recording:', error);
            setIsListening(false);
        }
    }, [processRecording]);

    const stopListening = useCallback(async () => {
        if (isStoppingRef.current || !recordingRef.current) return;
        isStoppingRef.current = true;

        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        setIsListening(false);

        const rec = recordingRef.current;
        recordingRef.current = null;
        await processRecording(rec);
    }, [processRecording]);

    return {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        isSupported,
        isProcessing,
    };
}
