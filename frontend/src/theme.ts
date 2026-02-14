import { DefaultTheme } from 'react-native-paper';

export const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: '#3B82F6',
        accent: '#6366F1',
        background: '#EDF1F7',
        surface: 'rgba(255, 255, 255, 0.85)',
        text: '#1E293B',
        secondaryText: '#64748B',
        error: '#EF4444',
        placeholder: '#94A3B8',
        white: '#FFFFFF',
        success: '#10B981',
        warning: '#F59E0B',
    },
    roundness: 24,
};

export const gradientColors = ['#E0E7FF', '#F0F4FF', '#FFFFFF'] as const;

export const glassCard = {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
};

export const SUPPORTED_LANGUAGES: Record<string, string> = {
    tl: 'Tagalog',
    ceb: 'Cebuano',
    hil: 'Hiligaynon',
    en: 'English',
};

export const TONE_OPTIONS = [
    'neutral', 'formal', 'casual', 'friendly',
    'polite', 'angry', 'joking', 'sarcastic', 'playful',
];

export const TONE_COLORS: Record<string, string> = {
    neutral: '#64748B',
    formal: '#3B82F6',
    casual: '#10B981',
    friendly: '#F59E0B',
    polite: '#8B5CF6',
    angry: '#EF4444',
    joking: '#EC4899',
    sarcastic: '#F97316',
    playful: '#06B6D4',
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
