import { DefaultTheme, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const lightTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
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

export const darkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        primary: '#60A5FA',
        accent: '#818CF8',
        background: '#0F172A',
        surface: 'rgba(30, 41, 59, 0.85)',
        text: '#F8FAFC',
        secondaryText: '#94A3B8',
        error: '#F87171',
        placeholder: '#64748B',
        white: '#FFFFFF',
        success: '#34D399',
        warning: '#FBBF24',
    },
    roundness: 24,
};

// Legacy export for backward compatibility
export const theme = lightTheme;

export const gradientColors = ['#E0E7FF', '#F0F4FF', '#FFFFFF'] as const;
export const darkGradientColors = ['#1E293B', '#0F172A', '#020617'] as const;

// More vibrant iOS-style background gradients
export const vibrantGradients = {
    morning: ['#FF9A9E', '#FAD0C4', '#FAD0C4'],
    deepSea: ['#3B82F6', '#6366F1', '#8B5CF6'],
    sunset: ['#FF3D68', '#FF8E3C', '#FFD166'],
    aurora: ['#00C9FF', '#92FE9D', '#00C9FF'],
    glass: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)'],
};

export const glassCard = {
    backgroundColor: 'rgba(255, 255, 255, 0.45)', // More translucent for better blur
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)', // Brighter border for "glass" highlight
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
};

export const darkGlassCard = {
    ...glassCard,
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowOpacity: 0.25,
};

export const glassPill = {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
};

export const SUPPORTED_LANGUAGES: Record<string, string> = {
    tl: 'Tagalog',
    ceb: 'Cebuano',
    hil: 'Hiligaynon',
    en: 'English',
};

export const LANGUAGE_PLACEHOLDERS: Record<string, string> = {
    tl: 'Ilagay ang teksto',
    ceb: 'Isulod ang teksto',
    hil: 'Ibutang ang teksto',
    en: 'Insert the text',
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
