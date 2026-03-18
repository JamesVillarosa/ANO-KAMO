/**
 * OCR Screen — Real-time Live Scan + Post-Capture Translation Overlay
 *
 * Features:
 * 1. Language pickers (Source + Target) on the camera HUD
 * 2. Real-time "Live Scan" — captures a frame every ~2.5s, sends to
 *    /ocr/scan-translate, renders translated text in floating boxes
 * 3. Post-capture / Gallery — sends high-res image to /ocr/process-full,
 *    renders a full-screen overlay with translated text covering originals
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    Dimensions,
    ScrollView,
    Image as RNImage,
    Platform,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { Text } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
    Camera,
    Zap,
    ZapOff,
    ImageIcon,
    X,
    ScanLine,
    Pause,
    Play,
    ChevronDown,
    Globe,
    ArrowRight,
    RotateCcw,
    Check,
} from 'lucide-react-native';
import { useTheme } from '../src/context/ThemeContext';
import { gradientColors, darkGradientColors, SUPPORTED_LANGUAGES, LANGUAGE_COLORS } from '../src/theme';
import { ocrScanTranslate, ocrProcessFull } from '../src/lib/api';
import LanguagePicker from '../src/components/LanguagePicker';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Source languages (no auto-detect)
const SOURCE_LANGUAGES: Record<string, string> = {
    tl: 'Tagalog',
    ceb: 'Cebuano',
    hil: 'Hiligaynon',
    en: 'English',
};
const TARGET_LANGUAGES = SUPPORTED_LANGUAGES;

// ─────────── Types ───────────

interface TranslatedBlock {
    text: string;
    translated_text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
}

interface FullOcrBlock {
    text: string;
    translated_text: string;
    box: number[];
    confidence: number;
}

interface FullOcrResult {
    blocks: FullOcrBlock[];
    image_width: number;
    image_height: number;
    full_extracted_text: string;
    full_translated_text: string;
    error?: string;
}

// ─────────── Component ───────────

export default function OCRScreen() {
    const { isDarkMode } = useTheme();
    const activeGradient = isDarkMode ? darkGradientColors : gradientColors;

    // Camera
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [torchOn, setTorchOn] = useState(false);

    // Language selectors
    const [sourceLang, setSourceLang] = useState('tl');
    const [targetLang, setTargetLang] = useState('en');
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showTargetPicker, setShowTargetPicker] = useState(false);

    // Live scan state
    const [scanning, setScanning] = useState(true);
    const [liveBlocks, setLiveBlocks] = useState<TranslatedBlock[]>([]);
    const [liveImageDims, setLiveImageDims] = useState({ w: 0, h: 0 });
    const [scanBusy, setScanBusy] = useState(false);

    // Post-capture overlay state
    const [capturedUri, setCapturedUri] = useState<string | null>(null);
    const [capturedB64, setCapturedB64] = useState<string | null>(null);
    const [fullOcr, setFullOcr] = useState<FullOcrResult | null>(null);
    const [fullOcrLoading, setFullOcrLoading] = useState(false);
    const [capturedImageDims, setCapturedImageDims] = useState({ w: 0, h: 0 });

    // Timer ref for live scan interval
    const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── ALL HOOKS ABOVE EARLY RETURNS ───

    const performLiveScan = useCallback(async () => {
        if (scanBusy || !cameraRef.current || capturedUri || !permission?.granted) return;

        setScanBusy(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.3,
                base64: true,
                skipProcessing: true,
            });

            if (!photo?.base64) {
                setScanBusy(false);
                return;
            }

            const result = await ocrScanTranslate(
                photo.base64,
                sourceLang,
                targetLang,
            );

            if (result && !result.error) {
                setLiveBlocks(result.blocks || []);
                setLiveImageDims({ w: result.image_width, h: result.image_height });
            }
        } catch (err) {
            console.warn('Live scan error:', err);
        } finally {
            setScanBusy(false);
        }
    }, [scanBusy, sourceLang, targetLang, capturedUri, permission]);

    // Start/stop live scan interval
    useEffect(() => {
        if (scanning && !capturedUri && permission?.granted) {
            scanTimerRef.current = setInterval(() => {
                performLiveScan();
            }, 800);

            return () => {
                if (scanTimerRef.current) clearInterval(scanTimerRef.current);
            };
        } else {
            if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        }
    }, [scanning, capturedUri, performLiveScan, permission]);

    // Clear live blocks when language changes
    useEffect(() => {
        setLiveBlocks([]);
    }, [sourceLang, targetLang]);

    // ─── Helper Functions (not hooks) ───

    const processFullOcr = async (b64: string, tgtLang?: string) => {
        setFullOcrLoading(true);
        setFullOcr(null);

        try {
            const result = await ocrProcessFull(
                b64,
                tgtLang || targetLang,
                sourceLang,
            );
            setFullOcr(result);
        } catch (err) {
            console.error('Full OCR error:', err);
            setFullOcr({
                blocks: [],
                image_width: 0,
                image_height: 0,
                full_extracted_text: '',
                full_translated_text: '',
                error: String(err),
            });
        } finally {
            setFullOcrLoading(false);
        }
    };

    const handleCapture = async () => {
        if (!cameraRef.current) return;

        try {
            setScanning(false);
            if (scanTimerRef.current) clearInterval(scanTimerRef.current);
            setLiveBlocks([]);

            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: true,
            });

            if (photo?.uri && photo?.base64) {
                setCapturedUri(photo.uri);
                setCapturedB64(photo.base64);
                setCapturedImageDims({ w: photo.width || 0, h: photo.height || 0 });
                processFullOcr(photo.base64);
            }
        } catch (err) {
            console.error('Capture error:', err);
            setScanning(true);
        }
    };

    const handleGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
                base64: true,
            });

            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                const uri = asset.uri;
                let b64 = asset.base64;

                if (!b64 && uri) {
                    b64 = await FileSystem.readAsStringAsync(uri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                }

                if (b64) {
                    setScanning(false);
                    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
                    setLiveBlocks([]);

                    setCapturedUri(uri);
                    setCapturedB64(b64);
                    setCapturedImageDims({ w: asset.width || 0, h: asset.height || 0 });
                    processFullOcr(b64);
                }
            }
        } catch (err) {
            console.error('Gallery error:', err);
        }
    };

    const handleRetranslate = () => {
        if (capturedB64) processFullOcr(capturedB64);
    };

    const handleCloseCapture = () => {
        setCapturedUri(null);
        setCapturedB64(null);
        setFullOcr(null);
        setFullOcrLoading(false);
        setScanning(true);
    };

    const handleTargetChange = (lang: string) => {
        setTargetLang(lang);
        if (capturedB64) {
            processFullOcr(capturedB64, lang);
        }
    };

    // ─── Permission screens (after all hooks) ───

    if (!permission) {
        return <View style={{ flex: 1, backgroundColor: '#000' }} />;
    }

    if (!permission.granted) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <LinearGradient colors={[...activeGradient]} style={styles.bg} />
                <Camera size={64} color="#94A3B8" />
                <Text style={{ color: '#64748B', marginTop: 16, fontSize: 16 }}>
                    Camera permission is required for OCR
                </Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ─── Render: Post-Capture Overlay ───

    if (capturedUri) {
        const imgAspect = capturedImageDims.w / (capturedImageDims.h || 1);
        const screenAspect = SCREEN_W / SCREEN_H;

        let displayW: number, displayH: number, offsetX = 0, offsetY = 0;
        if (imgAspect > screenAspect) {
            displayW = SCREEN_W;
            displayH = SCREEN_W / imgAspect;
            offsetY = (SCREEN_H - displayH) / 2;
        } else {
            displayH = SCREEN_H;
            displayW = SCREEN_H * imgAspect;
            offsetX = (SCREEN_W - displayW) / 2;
        }

        const scaleX = displayW / (capturedImageDims.w || 1);
        const scaleY = displayH / (capturedImageDims.h || 1);
        const langColor = LANGUAGE_COLORS[targetLang] || LANGUAGE_COLORS['en'];

        return (
            <View style={styles.capturedContainer}>
                <RNImage
                    source={{ uri: capturedUri }}
                    style={[styles.capturedImage, { width: displayW, height: displayH, marginLeft: offsetX, marginTop: offsetY }]}
                    resizeMode="contain"
                />

                {/* Translation overlay boxes */}
                {fullOcr && fullOcr.blocks.length > 0 && (
                    <View
                        style={[
                            styles.capturedOverlayContainer,
                            { width: displayW, height: displayH, left: offsetX, top: offsetY },
                        ]}
                        pointerEvents="none"
                    >
                        {fullOcr.blocks.map((block, idx) => {
                            const [bx, by, bw, bh] = block.box;
                            if (!block.translated_text) return null;

                            return (
                                <View
                                    key={`full-${idx}`}
                                    style={[
                                        styles.capturedBox,
                                        {
                                            left: bx * scaleX,
                                            top: by * scaleY,
                                            width: Math.max(bw * scaleX, 30),
                                            minHeight: bh * scaleY,
                                            backgroundColor: langColor.bg,
                                            borderColor: langColor.light,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[styles.capturedBoxText, { color: langColor.text }]}
                                        adjustsFontSizeToFit
                                        numberOfLines={4}
                                    >
                                        {block.translated_text}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Loading spinner */}
                {fullOcrLoading && (
                    <View style={styles.loadingOverlay}>
                        <BlurView intensity={30} tint="dark" style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={styles.loadingText}>Extracting & Translating…</Text>
                        </BlurView>
                    </View>
                )}

                {/* Top bar */}
                <View style={styles.capturedTopBar}>
                    <TouchableOpacity style={styles.capturedCloseBtn} onPress={handleCloseCapture}>
                        <X size={22} color="#FFF" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.capturedLangBtn} onPress={() => setShowTargetPicker(true)}>
                        <Globe size={14} color="#10B981" />
                        <Text style={styles.capturedLangText}>
                            {TARGET_LANGUAGES[targetLang] || targetLang}
                        </Text>
                        <ChevronDown size={12} color="#FFF" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.capturedRetranslateBtn} onPress={handleRetranslate}>
                        <RotateCcw size={18} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Bottom panel: Full text */}
                {fullOcr && !fullOcrLoading && (fullOcr.full_extracted_text || fullOcr.full_translated_text) && (
                    <View style={styles.capturedBottomPanel}>
                        <BlurView intensity={60} tint="dark" style={styles.capturedBottomBlur}>
                            <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                                {fullOcr.full_extracted_text ? (
                                    <View style={{ marginBottom: 12 }}>
                                        <Text style={styles.capturedPanelLabel}>Original</Text>
                                        <Text style={styles.capturedPanelText}>{fullOcr.full_extracted_text}</Text>
                                    </View>
                                ) : null}
                                {fullOcr.full_translated_text ? (
                                    <View>
                                        <Text style={[styles.capturedPanelLabel, { color: '#10B981' }]}>
                                            Translated ({TARGET_LANGUAGES[targetLang] || targetLang})
                                        </Text>
                                        <Text style={[styles.capturedPanelText, { color: '#E2E8F0' }]}>
                                            {fullOcr.full_translated_text}
                                        </Text>
                                    </View>
                                ) : null}
                                {fullOcr.error ? (
                                    <Text style={[styles.capturedPanelText, { color: '#F87171' }]}>
                                        Error: {fullOcr.error}
                                    </Text>
                                ) : null}
                            </ScrollView>
                        </BlurView>
                    </View>
                )}

                {/* Target Language Picker */}
                <LanguagePicker
                    visible={showTargetPicker}
                    onDismiss={() => setShowTargetPicker(false)}
                    onSelect={handleTargetChange}
                    selected={targetLang}
                    title="Translate To"
                />
            </View>
        );
    }

    // ─── Render: Camera + Live Scan ───

    const langColor = LANGUAGE_COLORS[targetLang] || LANGUAGE_COLORS['en'];

    return (
        <View style={styles.container}>
            {/* Camera Feed — using enableTorch for steady light (not flash which blinks) */}
            <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                enableTorch={torchOn}
            >
                {/* Live Scan Overlay Boxes */}
                {liveBlocks.length > 0 && liveImageDims.w > 0 && (
                    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                        {liveBlocks.map((block, idx) => {
                            const scaleX = SCREEN_W / liveImageDims.w;
                            const scaleY = SCREEN_H / liveImageDims.h;
                            const left = block.x * scaleX;
                            const top = block.y * scaleY;
                            const width = block.width * scaleX;
                            const height = block.height * scaleY;

                            if (!block.translated_text && !block.text) return null;
                            if (width < 20 || height < 10) return null;

                            const displayText = block.translated_text || block.text;

                            return (
                                <View
                                    key={`live-${idx}`}
                                    style={[
                                        styles.overlayBox,
                                        {
                                            left,
                                            top,
                                            width: Math.max(width, 50),
                                            minHeight: height,
                                            backgroundColor: langColor.bg,
                                            borderColor: langColor.light,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[styles.overlayText, { color: langColor.text }]}
                                        numberOfLines={3}
                                    >
                                        {displayText}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Scanning indicator — positioned below the language bar */}
                {scanning && (
                    <View style={styles.scanIndicator}>
                        <ScanLine size={18} color="#10B981" />
                        <Text style={styles.scanIndicatorText}>
                            {scanBusy ? 'Translating…' : 'Scanning'}
                        </Text>
                    </View>
                )}
            </CameraView>

            {/* Language selector bar — positioned below the navigation header */}
            <View style={styles.langBar}>
                <BlurView intensity={50} tint={isDarkMode ? 'dark' : 'light'} style={styles.langBarInner}>
                    <TouchableOpacity style={styles.langBtn} onPress={() => setShowSourcePicker(true)}>
                        <Globe size={14} color="#3B82F6" />
                        <Text style={styles.langBtnText}>
                            {SOURCE_LANGUAGES[sourceLang] || sourceLang}
                        </Text>
                        <ChevronDown size={12} color="#94A3B8" />
                    </TouchableOpacity>

                    <ArrowRight size={16} color="#64748B" />

                    <TouchableOpacity style={styles.langBtn} onPress={() => setShowTargetPicker(true)}>
                        <Globe size={14} color="#10B981" />
                        <Text style={styles.langBtnText}>
                            {TARGET_LANGUAGES[targetLang] || targetLang}
                        </Text>
                        <ChevronDown size={12} color="#94A3B8" />
                    </TouchableOpacity>
                </BlurView>
            </View>

            {/* Bottom Controls */}
            <View style={styles.controls}>
                <BlurView intensity={40} tint="dark" style={styles.controlsBlur}>
                    {/* Torch Toggle — steady on/off, not flash */}
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

                <TouchableOpacity style={styles.scanToggle} onPress={() => setScanning(s => !s)}>
                    <BlurView intensity={50} tint="dark" style={styles.scanToggleInner}>
                        {scanning
                            ? <><Pause size={14} color="#FFF" /><Text style={styles.scanToggleText}>Pause</Text></>
                            : <><Play size={14} color="#FFF" /><Text style={styles.scanToggleText}>Resume</Text></>
                        }
                    </BlurView>
                </TouchableOpacity>
            </View>

            {/* Source Language Picker */}
            <SourceLanguagePicker
                visible={showSourcePicker}
                onDismiss={() => setShowSourcePicker(false)}
                onSelect={setSourceLang}
                selected={sourceLang}
                isDarkMode={isDarkMode}
            />

            {/* Target Language Picker */}
            <LanguagePicker
                visible={showTargetPicker}
                onDismiss={() => setShowTargetPicker(false)}
                onSelect={setTargetLang}
                selected={targetLang}
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
                <View
                    style={[srcStyles.container, isDarkMode && srcStyles.containerDark]}
                >
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
                            <Text
                                style={[
                                    srcStyles.optionText,
                                    isDarkMode && { color: '#94A3B8' },
                                    selected === code && (isDarkMode
                                        ? { color: '#60A5FA', fontWeight: '600' as const }
                                        : { color: '#3B82F6', fontWeight: '600' as const }),
                                ]}
                            >
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
    containerDark: {
        backgroundColor: '#1E293B',
        borderColor: 'rgba(255,255,255,0.1)',
    },
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

    // Language bar — pushed down below navigation header
    langBar: {
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
    langBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    langBtnText: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },

    // Scan indicator — below language bar
    scanIndicator: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 170 : 150,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
    },
    scanIndicatorText: { color: '#10B981', fontSize: 12, fontWeight: '600' },

    overlayBox: {
        position: 'absolute',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderWidth: 1.5,
        justifyContent: 'center',
    },
    overlayText: {
        fontSize: 12,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },

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
    shutterInner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#FFFFFF',
    },
    scanToggle: { marginTop: 12 },
    scanToggleInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    scanToggleText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

    permissionBtn: {
        marginTop: 24,
        backgroundColor: '#3B82F6',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 24,
    },
    permissionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

    capturedContainer: { flex: 1, backgroundColor: '#000' },
    capturedImage: { position: 'absolute' },
    capturedOverlayContainer: { position: 'absolute' },
    capturedBox: {
        position: 'absolute',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderWidth: 1.5,
        justifyContent: 'center',
    },
    capturedBoxText: {
        fontSize: 11,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    capturedTopBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    capturedCloseBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    capturedLangBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    capturedLangText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
    capturedRetranslateBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    capturedBottomPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    capturedBottomBlur: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
    },
    capturedPanelLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    capturedPanelText: { fontSize: 14, color: '#CBD5E1', lineHeight: 20 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    loadingBox: {
        alignItems: 'center',
        padding: 28,
        borderRadius: 24,
        overflow: 'hidden',
    },
    loadingText: { color: '#CBD5E1', fontSize: 14, fontWeight: '600', marginTop: 12 },
});
