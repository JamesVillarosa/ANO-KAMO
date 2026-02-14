import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    Alert,
    Clipboard,
    Dimensions,
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
    RotateCcw,
} from 'lucide-react-native';
import { gradientColors, glassCard, SUPPORTED_LANGUAGES } from '../src/theme';
import { ocrExtract } from '../src/lib/api';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import DictionaryModal from '../src/components/DictionaryModal';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');

export default function OCRScreen() {
    const [hasResult, setHasResult] = useState(false);
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

    const processImage = async (uri: string) => {
        setProcessing(true);
        try {
            const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
            const res = await ocrExtract(b64, targetLang, sourceLang);
            setExtractedText(res.extracted_text || 'No text detected');
            setTranslation(res.translated_text || '');
            setHasResult(true);
        } catch (e: any) {
            Alert.alert('OCR Error', e?.message || 'Could not process image');
        }
        setProcessing(false);
    };

    const handleCapture = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required'); return; }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false });
        if (!result.canceled && result.assets?.[0]?.uri) {
            await processImage(result.assets[0].uri);
        }
    };

    const handleGallery = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission needed', 'Gallery access is required'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: false });
        if (!result.canceled && result.assets?.[0]?.uri) {
            await processImage(result.assets[0].uri);
        }
    };

    const resetCamera = () => {
        setHasResult(false);
        setExtractedText('');
        setTranslation('');
        setIsFavorite(false);
    };

    const copyText = (text: string) => {
        Clipboard.setString(text);
        Alert.alert('Copied', 'Text copied to clipboard');
    };

    return (
        <View style={styles.container}>
            {/* Camera Viewfinder (full screen) */}
            <View style={styles.viewfinder}>
                {/* Simulated dark camera background */}
                <View style={styles.cameraFeed}>
                    {hasResult ? (
                        <View style={styles.resultOverlay}>
                            <Camera size={50} color="#475569" />
                            <Text style={styles.capturedLabel}>Image Captured</Text>
                        </View>
                    ) : (
                        <View style={styles.cameraEmpty}>
                            <Camera size={50} color="#475569" />
                            <Text style={styles.cameraHint}>Point camera at text</Text>
                        </View>
                    )}
                </View>

                {/* Top Language Bar */}
                <View style={styles.topBar}>
                    <TouchableOpacity
                        style={styles.langChip}
                        onPress={() => setPickerTarget('source')}
                    >
                        <Text style={styles.langChipText}>
                            {SUPPORTED_LANGUAGES[sourceLang]}
                        </Text>
                        <ChevronDown size={14} color="#FFF" />
                    </TouchableOpacity>

                    <Text style={styles.arrowIcon}>→</Text>

                    <TouchableOpacity
                        style={styles.langChip}
                        onPress={() => setPickerTarget('target')}
                    >
                        <Text style={styles.langChipText}>
                            {SUPPORTED_LANGUAGES[targetLang]}
                        </Text>
                        <ChevronDown size={14} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Translation Overlay on Image */}
                {hasResult && translation ? (
                    <View style={styles.transOverlay}>
                        <Text style={styles.transOverlayText}>{translation}</Text>
                    </View>
                ) : null}

                {/* Bottom Controls */}
                <View style={styles.bottomControls}>
                    {/* Left: Gallery */}
                    <TouchableOpacity style={styles.sideBtn} onPress={handleGallery}>
                        <ImagePlus size={22} color="#FFF" />
                    </TouchableOpacity>

                    {/* Center: Shutter */}
                    {hasResult ? (
                        <TouchableOpacity style={styles.shutterBtn} onPress={resetCamera}>
                            <RotateCcw size={28} color="#FFF" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.shutterBtn} onPress={handleCapture} disabled={processing}>
                            {processing ? (
                                <ActivityIndicator color="#FFF" size="large" />
                            ) : (
                                <View style={styles.shutterInner} />
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Right: Flash */}
                    <TouchableOpacity style={styles.sideBtn} onPress={() => setFlashOn(!flashOn)}>
                        {flashOn ? (
                            <Zap size={22} color="#F59E0B" />
                        ) : (
                            <ZapOff size={22} color="#FFF" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Result Actions Bar */}
                {hasResult ? (
                    <View style={styles.resultBar}>
                        <TouchableOpacity style={styles.resultAction}>
                            <Volume2 size={18} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.resultAction} onPress={() => copyText(translation)}>
                            <Copy size={18} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.resultAction} onPress={() => {
                            const w = translation.split(/\s+/)[0];
                            if (w) { setDictWord(w); setDictVisible(true); }
                        }}>
                            <BookOpen size={18} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.resultAction} onPress={() => setIsFavorite(!isFavorite)}>
                            <Heart
                                size={18}
                                color={isFavorite ? '#EF4444' : '#FFF'}
                                fill={isFavorite ? '#EF4444' : 'none'}
                            />
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>

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
    container: { flex: 1 },

    /* Camera Full Screen */
    viewfinder: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    cameraFeed: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraEmpty: {
        alignItems: 'center',
    },
    cameraHint: {
        color: '#64748B',
        fontSize: 14,
        marginTop: 10,
    },
    resultOverlay: {
        alignItems: 'center',
    },
    capturedLabel: {
        color: '#64748B',
        fontSize: 14,
        marginTop: 10,
    },

    /* Top Language Bar */
    topBar: {
        position: 'absolute',
        top: 100,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    langChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 24,
    },
    langChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        marginRight: 6,
    },
    arrowIcon: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.5)',
        marginHorizontal: 14,
    },

    /* Translation Overlay */
    transOverlay: {
        position: 'absolute',
        bottom: 220,
        left: 24,
        right: 24,
        backgroundColor: 'rgba(59, 130, 246, 0.9)',
        padding: 16,
        borderRadius: 16,
    },
    transOverlayText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 24,
    },

    /* Bottom Controls */
    bottomControls: {
        position: 'absolute',
        bottom: 120,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 40,
    },
    sideBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shutterBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    shutterInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
    },

    /* Result Actions */
    resultBar: {
        position: 'absolute',
        bottom: 180,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    resultAction: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
