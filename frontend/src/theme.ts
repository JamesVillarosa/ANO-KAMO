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

export const gradientColors = ['#C7D2FE', '#EDE9FE', '#F8FAFF'] as const;
export const darkGradientColors = ['#1E1B4B', '#0F172A', '#020617'] as const;

// More vibrant iOS-style background gradients
export const vibrantGradients = {
    morning: ['#FF9A9E', '#FAD0C4', '#FAD0C4'],
    deepSea: ['#3B82F6', '#6366F1', '#8B5CF6'],
    sunset: ['#FF3D68', '#FF8E3C', '#FFD166'],
    aurora: ['#00C9FF', '#92FE9D', '#00C9FF'],
    glass: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)'],
};

export const glassCard = {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
    overflow: 'hidden',
};

export const darkGlassCard = {
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
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

export const liquidGlass = {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
};

export const SUPPORTED_LANGUAGES: Record<string, string> = {
    tl: 'Tagalog',
    ceb: 'Cebuano',
    hil: 'Hiligaynon',
    en: 'English',
};

export const LANGUAGE_COLORS: Record<string, { bg: string; text: string; trans: string; light: string }> = {
    tl: { bg: 'rgba(59, 130, 246, 0.85)', text: '#FFFFFF', trans: '#BFDBFE', light: '#3B82F6' },
    ceb: { bg: 'rgba(239, 68, 68, 0.85)', text: '#FFFFFF', trans: '#FECACA', light: '#EF4444' },
    hil: { bg: 'rgba(234, 179, 8, 0.85)', text: '#FFFFFF', trans: '#FEF08A', light: '#EAB308' },
    en: { bg: 'rgba(141, 85, 36, 0.85)', text: '#FFFFFF', trans: '#DEB887', light: '#8D5524' },
};

export const LANGUAGE_PLACEHOLDERS: Record<string, string> = {
    tl: 'Ilagay ang teksto',
    ceb: 'Isulod ang teksto',
    hil: 'Ibutang ang teksto',
    en: 'Insert the text',
};

export const TONE_OPTIONS = [
    'formal', 'street', 'respectful', 'urgent', 'angry', 'custom',
];

// Tone display names with Filipino cultural descriptions
export const TONE_LABELS: Record<string, { name: string; description: string }> = {
    formal: { name: 'Formal', description: 'Professional, academic, official' },
    street: { name: 'Street', description: 'Metro Manila street, Beki/Bekimon' },
    respectful: { name: 'Respectful', description: 'Using po, opo, honorifics' },
    urgent: { name: 'Urgent', description: 'Time-sensitive, pressing' },
    angry: { name: 'Angry', description: 'Direct, forceful, emotional' },
    custom: { name: 'Custom', description: 'Type your own tone' },
};

export const TONE_COLORS: Record<string, string> = {
    formal: '#3B82F6',
    street: '#EC4899',
    respectful: '#8B5CF6',
    urgent: '#DC2626',
    angry: '#EF4444',
    custom: '#6366F1',
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
