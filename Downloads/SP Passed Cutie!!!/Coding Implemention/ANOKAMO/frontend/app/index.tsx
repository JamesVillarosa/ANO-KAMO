import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Mic,
  Camera,
  MessageSquare,
  Repeat,
  ChevronDown,
  Type,
} from 'lucide-react-native';
import axios from 'axios';
import { theme } from '../src/theme';

const { width } = Dimensions.get('window');

// API Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const SUPPORTED_LANGUAGES = {
  tl: 'Tagalog',
  ceb: 'Cebuano',
  hil: 'Hiligaynon',
  en: 'English',
};

export default function HomeScreen() {
  const router = useRouter();
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('tl');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('text'); // 'text', 'camera', 'conversation'

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      setTranslatedText('');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/translate`, {
        text: sourceText,
        source_lang: sourceLang,
        target_lang: targetLang,
      });
      setTranslatedText(response.data.output_text);
    } catch (error) {
      console.error('Translation error:', error);
      setTranslatedText('Error: Connection failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (sourceText.length > 2) {
        handleTranslate();
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [sourceText, sourceLang, targetLang]);

  const swapLanguages = () => {
    const oldSource = sourceLang;
    const oldTarget = targetLang;
    setSourceLang(oldTarget);
    setTargetLang(oldSource);

    const oldSourceText = sourceText;
    const oldTranslatedText = translatedText;
    setSourceText(oldTranslatedText.replace(/^\[[A-Z]+\]\s/, '')); // Remove language tag if present
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#E0E7FF', '#F0F4FF', '#FFFFFF']}
        style={styles.background}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Glass Card */}
          <View style={styles.glassCard}>
            {/* Source Section */}
            <View style={styles.langSection}>
              <TouchableOpacity style={styles.langSelector}>
                <Text style={styles.langText}>{SUPPORTED_LANGUAGES[sourceLang as keyof typeof SUPPORTED_LANGUAGES]}</Text>
                <ChevronDown size={18} color={theme.colors.primary} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Ilagay ang teksto"
                placeholderTextColor="#94A3B8"
                multiline
                value={sourceText}
                onChangeText={setSourceText}
              />
              <View style={styles.inputFooter}>
                <TouchableOpacity style={styles.iconCircle}>
                  <Mic size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider with Swap Button */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.swapButton} onPress={swapLanguages}>
                <Repeat size={20} color={theme.colors.white} />
              </TouchableOpacity>
            </View>

            {/* Target Section */}
            <View style={styles.langSection}>
              <TouchableOpacity style={styles.langSelector}>
                <Text style={styles.langText}>{SUPPORTED_LANGUAGES[targetLang as keyof typeof SUPPORTED_LANGUAGES]}</Text>
                <ChevronDown size={18} color={theme.colors.primary} />
              </TouchableOpacity>
              <View style={styles.translatedArea}>
                {isLoading ? (
                  <ActivityIndicator style={{ alignSelf: 'flex-start' }} color={theme.colors.primary} />
                ) : (
                  <Text style={[styles.translatedText, !translatedText && { color: '#94A3B8' }]}>
                    {translatedText || 'Isulod ang teksto'}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Bottom Nav */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'text' && styles.navItemActive]}
            onPress={() => setActiveTab('text')}
          >
            <Type size={20} color={activeTab === 'text' ? '#1E293B' : '#64748B'} />
            <Text style={[styles.navText, activeTab === 'text' && styles.navTextActive]}>Text</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'camera' && styles.navItemActive]}
            onPress={() => router.push('/ocr')}
          >
            <Camera size={20} color={activeTab === 'camera' ? '#1E293B' : '#64748B'} />
            <Text style={[styles.navText, activeTab === 'camera' && styles.navTextActive]}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'conversation' && styles.navItemActive]}
            onPress={() => router.push('/conversation')}
          >
            <MessageSquare size={20} color={activeTab === 'conversation' ? '#1E293B' : '#64748B'} />
            <Text style={[styles.navText, activeTab === 'conversation' && styles.navTextActive]}>Conversation</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    marginTop: 100, // Space for header
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 150, // Space for floating nav
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  langSection: {
    width: '100%',
  },
  langSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  langText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginRight: 6,
  },
  input: {
    fontSize: 18,
    color: '#1E293B',
    minHeight: 80,
    maxHeight: 150,
    textAlignVertical: 'top',
    padding: 0,
  },
  inputFooter: {
    flexDirection: 'row',
    marginTop: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
    height: 40,
    position: 'relative',
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  swapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: '50%',
    marginLeft: -20,
    zIndex: 1,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  translatedArea: {
    minHeight: 80,
  },
  translatedText: {
    fontSize: 18,
    color: '#1E293B',
    paddingTop: 0,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(241, 245, 249, 0.95)',
    borderRadius: 40,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    width: width * 0.85,
    justifyContent: 'space-between',
  },
  navItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 30,
  },
  navItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  navText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 8,
  },
  navTextActive: {
    color: '#1E293B',
  },
});
