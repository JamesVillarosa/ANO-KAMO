import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    Alert,
    Clipboard,
    Dimensions,
    Image,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
    Camera as CameraIcon,
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
import { gradientColors, glassCard, SUPPORTED_LANGUAGES, darkGradientColors } from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import { ocrExtract } from '../src/lib/api';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import DictionaryModal from '../src/components/DictionaryModal';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width, height } = Dimensions.get('window');

export default function OCRScreen() {
    const { isDarkMode } = useTheme();
    const [hasResult, setHasResult] = useState(false);
    const [flashOn, setFlashOn] = useState(false);
    const [extractedText, setExtractedText] = useState('');
    const [translation, setTranslation] = useState('');
    const [processing, setProcessing] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    // Camera
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);

    // Languages
    const [sourceLang, setSourceLang] = useState('tl');
    const [targetLang, setTargetLang] = useState('en');
    const [pickerTarget, setPickerTarget] = useState<'source' | 'target' | null>(null);

    // Dictionary
    const [dictVisible, setDictVisible] = useState(false);
    const [dictWord, setDictWord] = useState('');

    useEffect(() => {
        if (!permission || !permission.granted) {
            requestPermission();
        }
    }, [permission]);

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
        if (!cameraRef.current) return;
        setProcessing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: true,
            });
            if (photo && photo.uri) {
                setCapturedImage(photo.uri);
                const res = await ocrExtract(photo.base64 || '', targetLang, sourceLang);
                setExtractedText(res.extracted_text || 'No text detected');
                setTranslation(res.translated_text || '');
                setHasResult(true);
            }
        } catch (e: any) {
            Alert.alert('OCR Error', e?.message || 'Could not process image');
        }
        setProcessing(false);
    };

    const handleGallery = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission needed', 'Gallery access is required'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true });
        if (!result.canceled && result.assets?.[0]?.uri) {
            setCapturedImage(result.assets[0].uri);
            if (result.assets[0].base64) {
                setProcessing(true);
                try {
                    const res = await ocrExtract(result.assets[0].base64, targetLang, sourceLang);
                    setExtractedText(res.extracted_text || 'No text detected');
                    setTranslation(res.translated_text || '');
                    setHasResult(true);
                } catch (e: any) {
                    Alert.alert('OCR Error', e?.message || 'Could not process image');
                }
                setProcessing(false);
            } else {
                await processImage(result.assets[0].uri);
            }
        }
    };

    const resetCamera = () => {
        setHasResult(false);
        setExtractedText('');
        setTranslation('');
        setIsFavorite(false);
        setCapturedImage(null);
    };

    const copyText = (text: string) => {
        Clipboard.setString(text);
        Alert.alert('Copied', 'Text copied to clipboard');
    };

    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <LinearGradient colors={isDarkMode ? darkGradientColors : gradientColors} style={styles.bg} />
            {/* Camera Viewfinder (full screen) */}
            <View style={styles.viewfinder}>
                {hasResult ? (
                    <Image source={{ uri: capturedImage || '' }} style={styles.cameraFeed} />
                ) : (permission && permission.granted) ? (
                    <CameraView
                        ref={cameraRef}
                        style={styles.cameraFeed}
                        enableTorch={flashOn}
                        facing="back"
                    />
                ) : (
                    <View style={styles.cameraEmpty}>
                        <CameraIcon size={50} color="#475569" />
                        <Text style={styles.cameraHint}>
                            {permission?.status === 'denied'
                                ? 'Camera permission denied'
                                : 'Requesting camera permission...'}
                        </Text>
                    </View>
                )}

                {/* Top Language Bar */}
                <BlurView intensity={30} tint="dark" style={styles.topBar}>
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
                </BlurView>

                {/* Translation Overlay on Image */}
                {hasResult && translation ? (
                    <BlurView intensity={40} tint="dark" style={styles.transOverlay}>
                        <Text style={styles.transOverlayText}>{translation}</Text>
                    </BlurView>
                ) : null}

                {/* Bottom Controls Area */}
                <View style={styles.bottomArea}>
                    <BlurView intensity={40} tint="dark" style={styles.bottomControls}>
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
                    </BlurView>
                </View>

                {/* Result Actions Bar */}
                {hasResult ? (
                    <BlurView intensity={35} tint="dark" style={styles.resultBar}>
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
                    </BlurView>
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
    container: { flex: 1, backgroundColor: '#FFF' },
    containerDark: { backgroundColor: '#0F172A' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

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
        color: '#94A3B8',
        fontSize: 14,
        marginTop: 10,
    },

    /* Top Language Bar */
    topBar: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    langChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    langChipText: {
        fontSize: 14,
        fontWeight: '700',
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
        bottom: 240,
        left: 24,
        right: 24,
        backgroundColor: 'rgba(59, 130, 246, 0.4)',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        overflow: 'hidden',
    },
    transOverlayText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 26,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },

    /* Bottom Controls */
    bottomArea: {
        position: 'absolute',
        bottom: 110,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    bottomControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 32,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 32,
        paddingVertical: 20,
        borderRadius: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
    },
    sideBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shutterBtn: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
    },
    shutterInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFFFFF',
    },

    /* Result Actions */
    resultBar: {
        position: 'absolute',
        bottom: 230,
        alignSelf: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 8,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
    },
    resultAction: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
