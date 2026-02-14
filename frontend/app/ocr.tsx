import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    Clipboard,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Camera,
    ImagePlus,
    Zap,
    ZapOff,
    ChevronDown,
    Volume2,
    Copy,
    BookOpen,
    Heart,
} from 'lucide-react-native';
import { gradientColors, glassCard, SUPPORTED_LANGUAGES } from '../src/theme';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import DictionaryModal from '../src/components/DictionaryModal';

export default function OCRScreen() {
    const [image, setImage] = useState<string | null>(null);
    const [flashOn, setFlashOn] = useState(false);
    const [extractedText, setExtractedText] = useState('');
    const [translation, setTranslation] = useState('');
    const [processing, setProcessing] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);

    // Languages
    const [sourceLang, setSourceLang] = useState('tl');
    const [targetLang, setTargetLang] = useState('en');
    const [pickerTarget, setPickerTarget] = useState<'source' | 'target' | null>(null);

    // Dictionary
    const [dictVisible, setDictVisible] = useState(false);
    const [dictWord, setDictWord] = useState('');

    const handleCapture = () => {
        setProcessing(true);
        // Simulate capture + OCR + translate
        setTimeout(() => {
            setImage('captured');
            setExtractedText('Salamat sa iyong tulong.');
            setTranslation('Thank you for your help.');
            setProcessing(false);
        }, 2000);
    };

    const handleGallery = () => {
        setProcessing(true);
        setTimeout(() => {
            setImage('gallery');
            setExtractedText('Magandang umaga sa lahat.');
            setTranslation('Good morning to everyone.');
            setProcessing(false);
        }, 1500);
    };

    const copyText = (text: string) => {
        Clipboard.setString(text);
        Alert.alert('Copied', 'Text copied to clipboard');
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={[...gradientColors]} style={styles.bg} />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Language Selectors */}
                <View style={styles.langRow}>
                    <TouchableOpacity style={styles.langChip} onPress={() => setPickerTarget('source')}>
                        <Text style={styles.langChipText}>{SUPPORTED_LANGUAGES[sourceLang]}</Text>
                        <ChevronDown size={14} color="#3B82F6" />
                    </TouchableOpacity>
                    <Text style={styles.arrow}>→</Text>
                    <TouchableOpacity style={styles.langChip} onPress={() => setPickerTarget('target')}>
                        <Text style={styles.langChipText}>{SUPPORTED_LANGUAGES[targetLang]}</Text>
                        <ChevronDown size={14} color="#3B82F6" />
                    </TouchableOpacity>
                </View>

                {/* Camera Viewfinder */}
                <View style={styles.viewfinder}>
                    {image ? (
                        <View style={styles.imagePlaceholder}>
                            <Camera size={60} color="#94A3B8" />
                            <Text style={styles.imgPlaceholderText}>Image Captured</Text>
                            {translation ? (
                                <View style={styles.overlayBox}>
                                    <Text style={styles.overlayText}>{translation}</Text>
                                </View>
                            ) : null}
                        </View>
                    ) : (
                        <View style={styles.cameraPlaceholder}>
                            <Camera size={60} color="#CBD5E1" />
                            <Text style={styles.placeholderText}>Camera Viewfinder</Text>
                            <Text style={styles.placeholderSubtext}>Point at text to translate</Text>
                        </View>
                    )}
                </View>

                {/* Camera Controls */}
                <View style={styles.controls}>
                    <TouchableOpacity style={styles.controlBtn} onPress={handleGallery}>
                        <ImagePlus size={22} color="#3B82F6" />
                        <Text style={styles.controlLabel}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.shutterBtn} onPress={handleCapture}>
                        {processing ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <View style={styles.shutterInner} />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.controlBtn} onPress={() => setFlashOn(!flashOn)}>
                        {flashOn ? (
                            <Zap size={22} color="#F59E0B" />
                        ) : (
                            <ZapOff size={22} color="#64748B" />
                        )}
                        <Text style={styles.controlLabel}>Flash</Text>
                    </TouchableOpacity>
                </View>

                {/* Results */}
                {extractedText ? (
                    <View style={styles.resultCard}>
                        <Text style={styles.resultLabel}>DETECTED TEXT</Text>
                        <Text style={styles.resultText}>{extractedText}</Text>

                        <View style={styles.resultDivider} />

                        <Text style={styles.resultLabel}>TRANSLATION</Text>
                        <Text style={[styles.resultText, { color: '#3B82F6' }]}>{translation}</Text>

                        <View style={styles.resultActions}>
                            <TouchableOpacity style={styles.actionBtn}>
                                <Volume2 size={18} color="#3B82F6" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => copyText(translation)}>
                                <Copy size={18} color="#3B82F6" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => {
                                const w = translation.split(/\s+/)[0];
                                if (w) { setDictWord(w); setDictVisible(true); }
                            }}>
                                <BookOpen size={18} color="#3B82F6" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => setIsFavorite(!isFavorite)}>
                                <Heart size={18} color={isFavorite ? '#EF4444' : '#94A3B8'} fill={isFavorite ? '#EF4444' : 'none'} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}
            </ScrollView>

            <BottomNav />

            <LanguagePicker
                visible={pickerTarget !== null}
                onDismiss={() => setPickerTarget(null)}
                onSelect={(code) => {
                    if (pickerTarget === 'source') setSourceLang(code);
                    else setTargetLang(code);
                }}
                selected={pickerTarget === 'source' ? sourceLang : targetLang}
            />

            <DictionaryModal
                visible={dictVisible}
                onDismiss={() => setDictVisible(false)}
                word={dictWord}
                sourceLang={sourceLang}
                targetLang={targetLang}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    scroll: { paddingTop: 100, paddingHorizontal: 20, paddingBottom: 120 },

    /* Lang Row */
    langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    langChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(241,245,249,0.9)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    langChipText: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginRight: 4 },
    arrow: { fontSize: 18, color: '#94A3B8', marginHorizontal: 12 },

    /* Viewfinder */
    viewfinder: {
        width: '100%',
        height: 300,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#1E293B',
        marginBottom: 20,
    },
    cameraPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    placeholderText: { color: '#94A3B8', fontSize: 16, fontWeight: '600', marginTop: 12 },
    placeholderSubtext: { color: '#64748B', fontSize: 13, marginTop: 4 },
    imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    imgPlaceholderText: { color: '#94A3B8', fontSize: 14, marginTop: 8 },
    overlayBox: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 16,
        backgroundColor: 'rgba(59,130,246,0.85)',
        padding: 12,
        borderRadius: 12,
    },
    overlayText: { color: '#FFF', fontSize: 15, fontWeight: '600', textAlign: 'center' },

    /* Controls */
    controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 24 },
    controlBtn: { alignItems: 'center' },
    controlLabel: { fontSize: 11, color: '#64748B', marginTop: 4, fontWeight: '600' },
    shutterBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    shutterInner: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderColor: '#FFF' },

    /* Result */
    resultCard: {
        ...glassCard,
        padding: 20,
    },
    resultLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 6 },
    resultText: { fontSize: 17, fontWeight: '600', color: '#1E293B', marginBottom: 14 },
    resultDivider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 14 },
    resultActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
