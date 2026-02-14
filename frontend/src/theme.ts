import { DefaultTheme } from 'react-native-paper';

export const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: '#3B82F6', // Brighter blue
        accent: '#6366F1',  // Indigo/Purple
        background: '#EDF1F7',
        surface: 'rgba(255, 255, 255, 0.85)', // Semi-transparent for glass effect
        text: '#1E293B',
        secondaryText: '#64748B',
        error: '#EF4444',
        placeholder: '#94A3B8',
        white: '#FFFFFF',
    },
    roundness: 24, // More rounded corners as seen in the photo
};
