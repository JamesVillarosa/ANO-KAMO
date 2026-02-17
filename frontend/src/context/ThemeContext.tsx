import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    mode: ThemeMode;
    isDarkMode: boolean;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [mode, setMode] = useState<ThemeMode>(systemColorScheme === 'dark' ? 'dark' : 'light');

    useEffect(() => {
        // Load saved theme preference
        const loadTheme = async () => {
            const savedTheme = await AsyncStorage.getItem('theme_mode');
            if (savedTheme === 'light' || savedTheme === 'dark') {
                setMode(savedTheme);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = async () => {
        const newMode = mode === 'light' ? 'dark' : 'light';
        setMode(newMode);
        await AsyncStorage.setItem('theme_mode', newMode);
    };

    return (
        <ThemeContext.Provider value={{ mode, isDarkMode: mode === 'dark', toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
