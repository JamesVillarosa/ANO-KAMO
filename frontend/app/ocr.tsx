/**
 * OCR Screen — Capture & Gallery with Google Lens-Style Overlay
 *
 * Phases implemented:
 * 1. No real-time OCR — live camera is a clean preview only
 * 2. Shutter / Gallery → OCR (Tesseract) → translate → overlay
 * 3. Language switch reuses stored OCR blocks, only re-translates
 * 4. Tapping any overlay block opens the Dictionary popup
 * 5. Bottom action bar: Retake/Choose Another | Copy | TTS
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    Dimensions,
    Image as RNImage,
    Platform,
    ActivityIndicator,
    Modal,
    Alert,
    ToastAndroid,
} from 'react-native';
import { Text } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
    Camera,
    Zap,
    ZapOff,
    ImageIcon,
    X,
    ChevronDown,
    Globe,
    ArrowRight,
    Copy,
    Volume2,
    Check,
} from 'lucide-react-native';
import { useTheme } from '../src/context/ThemeContext';
import {
    gradientColors,
    darkGradientColors,
    SUPPORTED_LANGUAGES,
    LANGUAGE_COLORS,
} from '../src/theme';
import { ocrProcessFull, ocrTranslateBlocks } from '../src/lib/api';
import { getDeviceId } from '../src/utils/device';
import LanguagePicker from '../src/components/LanguagePicker';
import WordCardModal from '../src/components/WordCardModal';
import SentenceBreakdownSheet from '../src/components/SentenceBreakdownSheet';
import { useTextToSpeech } from '../src/hooks/useTextToSpeech';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SOURCE_LANGUAGES: Record<string, string> = {
    tl: 'Tagalog',
    ceb: 'Cebuano',
    hil: 'Hiligaynon',
    en: 'English',
};

// ─── Types ───

interface RawOcrBlock {
    text: string;
    box: number[]; // [x, y, width, height]
    confidence: number;
}

interface TranslatedOcrBlock {
    text: string;
    translated_text: string;
    box: number[];
    confidence: number;
}

function showToast(msg: string) {
    if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert('', msg);
}

// ─── Component ───

export default function OCRScreen() {
    const { isDarkMode } = useTheme();
    const tts = useTextToSpeech();
    const activeGradient = isDarkMode ? darkGradientColors : gradientColors;

    // Camera
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [torchOn, setTorchOn] = useState(false);

    // Languages
    const [sourceLang, setSourceLang] = useState('tl');
    const [targetLang, setTargetLang] = useState('en');
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showTargetPicker, setShowTargetPicker] = useState(false);

    // Capture state
    const [capturedUri, setCapturedUri] = useState<string | null>(null);
    const [captureMode, setCaptureMode] = useState<'capture' | 'gallery'>('capture');

    // OCR state
    const [rawOcrBlocks, setRawOcrBlocks] = useState<RawOcrBlock[]>([]);
    const [translatedBlocks, setTranslatedBlocks] = useState<TranslatedOcrBlock[]>([]);
    const [ocrImageDims, setOcrImageDims] = useState({ width: 0, height: 0 });
    const [isProcessing, setIsProcessing] = useState(false);
    const [isRetranslating, setIsRetranslating] = useState(false);
    const [fullTranslatedText, setFullTranslatedText] = useState('');

    // Dictionary / breakdown popup
    const [dictVisible, setDictVisible] = useState(false);
    const [dictWord, setDictWord] = useState('');
    const [breakdownVisible, setBreakdownVisible] = useState(false);
    const [breakdownText, setBreakdownText] = useState('');

    const deviceIdRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        getDeviceId().then(id => { deviceIdRef.current = id; });
    }, []);

    // Language switch: reuse stored blocks, only re-translate
    useEffect(() => {
        if (rawOcrBlocks.length === 0) return;
        retranslateBlocks(sourceLang, targetLang);
    }, [targetLang, sourceLang]);

    // ─── Core pipeline functions ───

    const retranslateBlocks = async (srcLang: string, tgtLang: string) => {
        setIsRetranslating(true);
        try {
            const result = await ocrTranslateBlocks(rawOcrBlocks, srcLang, tgtLang, deviceIdRef.current);
            if (result.blocks) {
                setTranslatedBlocks(result.blocks);
                setFullTranslatedText(result.blocks.map(b => b.translated_text).filter(Boolean).join(' '));
            }
        } catch (e) {
            console.error('Retranslate error:', e);
        } finally {
            setIsRetranslating(false);
        }
    };

    const processImageForOCR = async (imageBase64: string, mode: 'capture' | 'gallery') => {
        setIsProcessing(true);
        setTranslatedBlocks([]);
        setRawOcrBlocks([]);
        setCaptureMode(mode);

        try {
            const deviceId = deviceIdRef.current || await getDeviceId();
            const result = await ocrProcessFull(imageBase64, targetLang, sourceLang, deviceId);

            if (!result.blocks || result.blocks.length === 0) {
                showToast('No text found in this image.');
                resetCapture();
                return;
            }

            setOcrImageDims({ width: result.image_width, height: result.image_height });
            // Store raw blocks (text + coords only) for language-switch retranslation
            setRawOcrBlocks(result.blocks.map((b: any) => ({
                text: b.text,
                box: b.box,
                confidence: b.confidence,
            })));
            setTranslatedBlocks(result.blocks);
            setFullTranslatedText(result.full_translated_text || '');
        } catch (err) {
            console.error('OCR error:', err);
            showToast('Could not process image. Please try again.');
            resetCapture();
        } finally {
            setIsProcessing(false);
        }
    };

    // ─── Event handlers ───

    const handleCapture = async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: true,
                skipProcessing: false,
            });
            if (photo?.uri && photo?.base64) {
                setCapturedUri(photo.uri);
                processImageForOCR(photo.base64, 'capture');
            }
        } catch (err) {
            console.error('Capture error:', err);
        }
    };

    const handleGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
                base64: true,
                allowsEditing: false,
            });
            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                let b64 = asset.base64;
                if (!b64 && asset.uri) {
                    b64 = await FileSystem.readAsStringAsync(asset.uri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                }
                if (b64) {
                    setCapturedUri(asset.uri);
                    processImageForOCR(b64, 'gallery');
                }
            }
        } catch (err) {
            console.error('Gallery error:', err);
        }
    };

    const resetCapture = () => {
        setCapturedUri(null);
        setRawOcrBlocks([]);
        setTranslatedBlocks([]);
        setOcrImageDims({ width: 0, height: 0 });
        setIsProcessing(false);
        setIsRetranslating(false);
        setFullTranslatedText('');
    };

    const handleBlockTap = (translatedText: string) => {
        const words = translatedText.trim().split(/\s+/).filter(Boolean);
        if (words.length === 1) {
            const clean = words[0].replace(/[.,!?;:"""''()\[\]{}]/g, '').trim();
            setDictWord(clean);
            setDictVisible(true);
        } else {
            setBreakdownText(translatedText);
            setBreakdownVisible(true);
        }
    };

    const handleCopyAll = async () => {
        if (!fullTranslatedText) return;
        await Clipboard.setStringAsync(fullTranslatedText);
        showToast('Copied to clipboard');
    };

    const handleTTSAll = () => {
        if (!fullTranslatedText) return;
        if (tts.ttsState === 'playing') tts.stop();
        else tts.speak(fullTranslatedText, targetLang);
    };

    // ─── Permission screens ───

    if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

    if (!permission.granted) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <LinearGradient colors={[...activeGradient]} style={styles.bg} />
                <Camera size={64} color="#94A3B8" />
                <Text style={{ color: '#64748B', marginTop: 16, fontSize: 16 }}>
                    Camera permission is required
                </Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ─── Captured Image View ───

    if (capturedUri) {
        // Compute layout using backend image dimensions (authoritative for bounding boxes)
        const imgW = ocrImageDims.width || SCREEN_W;
        const imgH = ocrImageDims.height || SCREEN_H;
        const imgAspect = imgW / imgH;
        const screenAspect = SCREEN_W / SCREEN_H;

        let effectiveW: number, effectiveH: number, offsetX = 0, offsetY = 0;
        if (imgAspect > screenAspect) {
            effectiveW = SCREEN_W;
            effectiveH = SCREEN_W / imgAspect;
            offsetY = (SCREEN_H - effectiveH) / 2;
        } else {
            effectiveH = SCREEN_H;
            effectiveW = SCREEN_H * imgAspect;
            offsetX = (SCREEN_W - effectiveW) / 2;
        }

        const scaleX = effectiveW / imgW;
        const scaleY = effectiveH / imgH;

        return (
            <View style={styles.capturedContainer}>
                {/* Frozen image */}
                <RNImage
                    source={{ uri: capturedUri }}
                    style={[styles.capturedImage, {
                        width: effectiveW,
                        height: effectiveH,
                        left: offsetX,
                        top: offsetY,
                    }]}
                    resizeMode="contain"
                />

                {/* Google Lens-style overlay blocks */}
                {translatedBlocks.length > 0 && (
                    <View
                        style={[styles.overlayContainer, {
                            width: effectiveW,
                            height: effectiveH,
                            left: offsetX,
                            top: offsetY,
                        }]}
                    >
                        {translatedBlocks.map((block, idx) => {
                            const [bx, by, bw, bh] = block.box;
                            if (!block.translated_text || bw < 1 || bh < 1) return null;

                            const left = bx * scaleX;
                            const top = by * scaleY;
                            const width = Math.max(bw * scaleX, 30);
                            const height = Math.max(bh * scaleY, 16);
                            const fontSize = Math.max(Math.min(height * 0.6, 14), 9);

                            return (
                                <TouchableOpacity
                                    key={`block-${idx}`}
                                    style={[styles.overlayBlock, {
                                        left,
                                        top,
                                        width,
                                        height,
                                        backgroundColor: isDarkMode
                                            ? 'rgba(30,30,30,0.92)'
                                            : 'rgba(255,255,255,0.92)',
                                    }]}
                                    onPress={() => handleBlockTap(block.translated_text)}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[styles.overlayText, {
                                            fontSize,
                                            color: isDarkMode ? '#FFF' : '#1C1C1E',
                                        }]}
                                        numberOfLines={2}
                                        adjustsFontSizeToFit
                                    >
                                        {block.translated_text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Full-screen loading overlay (first OCR run) */}
                {isProcessing && (
                    <View style={styles.loadingOverlay}>
                        <BlurView intensity={30} tint="dark" style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={styles.loadingText}>Extracting & Translating…</Text>
                        </BlurView>
                    </View>
                )}

                {/* Subtle retranslation indicator (language switch) */}
                {isRetranslating && !isProcessing && (
                    <View style={styles.retranslatingIndicator}>
                        <ActivityIndicator size="small" color="#FFF" />
                    </View>
                )}

                {/* Top bar: close + language picker + (spacer) */}
                <View style={styles.capturedTopBar}>
                    <TouchableOpacity style={styles.iconBtn} onPress={resetCapture}>
                        <X size={22} color="#FFF" />
                    </TouchableOpacity>

                    <BlurView intensity={40} tint="dark" style={styles.topLangBar}>
                        <TouchableOpacity style={styles.langChip} onPress={() => setShowSourcePicker(true)}>
                            <Globe size={12} color="#60A5FA" />
                            <Text style={styles.langChipText}>{SOURCE_LANGUAGES[sourceLang] || sourceLang}</Text>
                            <ChevronDown size={10} color="#94A3B8" />
                        </TouchableOpacity>

                        <ArrowRight size={13} color="#64748B" />

                        <TouchableOpacity style={styles.langChip} onPress={() => setShowTargetPicker(true)}>
                            <Globe size={12} color="#10B981" />
                            <Text style={styles.langChipText}>{SUPPORTED_LANGUAGES[targetLang] || targetLang}</Text>
                            <ChevronDown size={10} color="#94A3B8" />
                        </TouchableOpacity>
                    </BlurView>

                    <View style={{ width: 44 }} />
                </View>

                {/* Bottom action bar */}
                {!isProcessing && (
                    <View style={styles.actionBar}>
                        <BlurView intensity={60} tint="dark" style={styles.actionBarBlur}>
                            <TouchableOpacity onPress={resetCapture}>
                                <Text style={styles.retakeText}>
                                    {captureMode === 'gallery' ? 'Choose Another' : 'Retake'}
                                </Text>
                            </TouchableOpacity>

                            <View style={styles.actionBtnsRight}>
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    onPress={handleCopyAll}
                                    disabled={!fullTranslatedText}
                                >
                                    <Copy size={20} color={fullTranslatedText ? '#FFF' : '#64748B'} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    onPress={handleTTSAll}
                                    disabled={!fullTranslatedText}
                                >
                                    <Volume2
                                        size={20}
                                        color={tts.ttsState === 'playing' ? '#3B82F6' : (fullTranslatedText ? '#FFF' : '#64748B')}
                                    />
                                </TouchableOpacity>
                            </View>
                        </BlurView>
                    </View>
                )}

                {/* Language pickers */}
                <SourceLanguagePicker
                    visible={showSourcePicker}
                    onDismiss={() => setShowSourcePicker(false)}
                    onSelect={setSourceLang}
                    selected={sourceLang}
                    isDarkMode={isDarkMode}
                />
                <LanguagePicker
                    visible={showTargetPicker}
                    onDismiss={() => setShowTargetPicker(false)}
                    onSelect={setTargetLang}
                    selected={targetLang}
                    exclude={[sourceLang]}
                    title="Translate To"
                />

                {/* Single-word dictionary */}
                <WordCardModal
                    visible={dictVisible}
                    onDismiss={() => setDictVisible(false)}
                    word={dictWord}
                    sourceLang={targetLang}
                    targetLang={sourceLang}
                />

                {/* Multi-word sentence breakdown */}
                <SentenceBreakdownSheet
                    visible={breakdownVisible}
                    onClose={() => setBreakdownVisible(false)}
                    text={breakdownText}
                    sourceLang={targetLang}
                    targetLang={sourceLang}
                    onWordPress={(word) => {
                        setBreakdownVisible(false);
                        setDictWord(word);
                        setTimeout(() => setDictVisible(true), 300);
                    }}
                />
            </View>
        );
    }

    // ─── Live Camera View (clean preview, no overlays) ───

    return (
        <View style={styles.container}>
            <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                enableTorch={torchOn}
            />

            {/* Language selector bar */}
            <View style={styles.langBarAbsolute}>
                <BlurView
                    intensity={50}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={styles.langBarInner}
                >
                    <TouchableOpacity style={styles.langBtnCamera} onPress={() => setShowSourcePicker(true)}>
                        <Globe size={14} color="#3B82F6" />
                        <Text style={styles.langBtnText}>{SOURCE_LANGUAGES[sourceLang] || sourceLang}</Text>
                        <ChevronDown size={12} color="#94A3B8" />
                    </TouchableOpacity>

                    <ArrowRight size={16} color="#64748B" />

                    <TouchableOpacity style={styles.langBtnCamera} onPress={() => setShowTargetPicker(true)}>
                        <Globe size={14} color="#10B981" />
                        <Text style={styles.langBtnText}>{SUPPORTED_LANGUAGES[targetLang] || targetLang}</Text>
                        <ChevronDown size={12} color="#94A3B8" />
                    </TouchableOpacity>
                </BlurView>
            </View>

            {/* Bottom controls: torch | shutter | gallery */}
            <View style={styles.controls}>
                <BlurView intensity={40} tint="dark" style={styles.controlsBlur}>
                    <TouchableOpacity style={styles.controlBtn} onPress={() => setTorchOn(t => !t)}>
                        {torchOn
                            ? <Zap size={22} color="#FCD34D" fill="#FCD34D" />
                            : <ZapOff size={22} color="#FFFFFF" />
                        }
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.shutterBtn} onPress={handleCapture}>
                        <View style={styles.shutterInner} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.controlBtn} onPress={handleGallery}>
                        <ImageIcon size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                </BlurView>
            </View>

            {/* Language pickers */}
            <SourceLanguagePicker
                visible={showSourcePicker}
                onDismiss={() => setShowSourcePicker(false)}
                onSelect={setSourceLang}
                selected={sourceLang}
                isDarkMode={isDarkMode}
            />
            <LanguagePicker
                visible={showTargetPicker}
                onDismiss={() => setShowTargetPicker(false)}
                onSelect={setTargetLang}
                selected={targetLang}
                exclude={[sourceLang]}
                title="Translate To"
            />
        </View>
    );
}

// ─────────── Source Language Picker ───────────

function SourceLanguagePicker({
    visible,
    onDismiss,
    onSelect,
    selected,
    isDarkMode,
}: {
    visible: boolean;
    onDismiss: () => void;
    onSelect: (code: string) => void;
    selected: string;
    isDarkMode: boolean;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <TouchableOpacity style={srcStyles.overlay} activeOpacity={1} onPress={onDismiss}>
                <View style={[srcStyles.container, isDarkMode && srcStyles.containerDark]}>
                    <View style={srcStyles.header}>
                        <Text style={[srcStyles.title, isDarkMode && { color: '#FFF' }]}>
                            Source Language
                        </Text>
                        <TouchableOpacity onPress={onDismiss}>
                            <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                        </TouchableOpacity>
                    </View>

                    {Object.entries(SOURCE_LANGUAGES).map(([code, name]) => (
                        <TouchableOpacity
                            key={code}
                            style={[
                                srcStyles.option,
                                selected === code && (isDarkMode ? srcStyles.optionSelectedDark : srcStyles.optionSelected),
                            ]}
                            onPress={() => { onSelect(code); onDismiss(); }}
                        >
                            <Text style={[
                                srcStyles.optionText,
                                isDarkMode && { color: '#94A3B8' },
                                selected === code && (isDarkMode
                                    ? { color: '#60A5FA', fontWeight: '600' as const }
                                    : { color: '#3B82F6', fontWeight: '600' as const }),
                            ]}>
                                {name}
                            </Text>
                            {selected === code && <Check size={18} color="#3B82F6" />}
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const srcStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        width: '85%',
        maxWidth: 360,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    containerDark: { backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.1)' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
    option: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 6,
    },
    optionSelected: { backgroundColor: 'rgba(59,130,246,0.12)' },
    optionSelectedDark: { backgroundColor: 'rgba(59,130,246,0.2)' },
    optionText: { fontSize: 16, color: '#475569' },
});

// ─────────── Styles ───────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    camera: { flex: 1 },

    // Camera — language bar (absolute, above controls)
    langBarAbsolute: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 110 : 90,
        left: 16,
        right: 16,
        zIndex: 10,
    },
    langBarInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    langBtnCamera: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    langBtnText: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },

    // Camera — bottom controls
    controls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    },
    controlsBlur: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 32,
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 40,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    controlBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    shutterBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },

    // Permission
    permissionBtn: {
        marginTop: 24,
        backgroundColor: '#3B82F6',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 24,
    },
    permissionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

    // Captured image view
    capturedContainer: { flex: 1, backgroundColor: '#000' },
    capturedImage: { position: 'absolute' },

    // Overlay blocks container
    overlayContainer: { position: 'absolute', zIndex: 10 },
    overlayBlock: {
        position: 'absolute',
        borderRadius: 3,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 2,
    },
    overlayText: {
        fontWeight: '500',
        textAlign: 'center',
    },

    // Processing overlays
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 20,
    },
    loadingBox: {
        alignItems: 'center',
        padding: 28,
        borderRadius: 24,
        overflow: 'hidden',
    },
    loadingText: { color: '#CBD5E1', fontSize: 14, fontWeight: '600', marginTop: 12 },
    retranslatingIndicator: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 120 : 100,
        right: 20,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 15,
    },

    // Captured — top bar
    capturedTopBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 56 : 36,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topLangBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    langChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    langChipText: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },

    // Captured — bottom action bar
    actionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
    },
    actionBarBlur: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        paddingBottom: Platform.OS === 'ios' ? 32 : 18,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    retakeText: {
        color: '#3B82F6',
        fontSize: 15,
        fontWeight: '600',
    },
    actionBtnsRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    actionIconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
