/**
 * Camera Translate Screen
 *
 * Camera screen: full-screen viewfinder with language picker, flash, capture, gallery, flip.
 * Result screen: photo with translated text overlays + full translation card.
 * Includes BottomNav (Text | Camera | Conversation).
 */
import React, { useState, useRef, useCallback } from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Dimensions,
    ScrollView,
    Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Camera,
    FolderOpen,
    RotateCcw,
    Zap,
    ZapOff,
    RefreshCcw,
    ArrowLeftRight,
    ScanText,
    X,
    ChevronDown,
} from 'lucide-react-native';
import { useTheme } from '../src/context/ThemeContext';
import { SUPPORTED_LANGUAGES } from '../src/theme';
import { ocrProcessFull, ocrTranslateBlocks } from '../src/lib/api';
import FluidAura from '../src/components/FluidAura';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import GlassNotification from '../src/components/GlassNotification';

interface OcrBlock {
    text: string;
    translated_text: string;
    box: number[];
    confidence: number;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Bottom nav height + its bottom offset — used to push controls above it
const NAV_CLEARANCE = 106;

export default function TranslateScreen() {
    const { isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef<CameraView>(null);

    const [permission, requestPermission] = useCameraPermissions();
    const [screenState, setScreenState] = useState<'camera' | 'result'>('camera');
    const [facing, setFacing] = useState<'front' | 'back'>('back');
    const [flash, setFlash] = useState<'off' | 'on'>('off');

    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | null>(null);
    const [ocrSize, setOcrSize] = useState<{ width: number; height: number } | null>(null);
    const [blocks, setBlocks] = useState<OcrBlock[]>([]);
    const [rawBlocks, setRawBlocks] = useState<OcrBlock[]>([]);
    const [fullTranslation, setFullTranslation] = useState('');
    const [loading, setLoading] = useState(false);
    const [retranslating, setRetranslating] = useState(false);

    const [sourceLang, setSourceLang] = useState('tl');
    const [targetLang, setTargetLang] = useState('en');
    const [pickerTarget, setPickerTarget] = useState<'source' | 'target' | null>(null);

    const [notifVisible, setNotifVisible] = useState(false);
    const [notifMessage, setNotifMessage] = useState('');

    const showNotif = (msg: string) => { setNotifMessage(msg); setNotifVisible(true); };

    // ─── Core pipeline ───────────────────────────────────────────

    const processImage = async (uri: string, base64: string, w: number, h: number) => {
        setPhotoUri(uri);
        setPhotoSize({ width: w, height: h });
        setOcrSize(null);
        setBlocks([]);
        setRawBlocks([]);
        setFullTranslation('');
        setScreenState('result');
        setLoading(true);
        try {
            const result = await ocrProcessFull(base64, targetLang, sourceLang);
            if (result.error) {
                showNotif(result.error);
            } else if (!result.blocks?.length) {
                showNotif('No readable text found. Try a clearer or closer photo.');
            } else {
                setBlocks(result.blocks);
                setRawBlocks(result.blocks.map(b => ({ ...b })));
                setFullTranslation(result.full_translated_text ?? '');
                setOcrSize({ width: result.image_width, height: result.image_height });
            }
        } catch (err: any) {
            showNotif(err.message || 'Failed to process image.');
        } finally {
            setLoading(false);
        }
    };

    const handleCapture = async () => {
        if (!cameraRef.current || loading) return;
        try {
            const pic = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.8 });
            if (pic?.base64) await processImage(pic.uri, pic.base64, pic.width, pic.height);
        } catch {
            showNotif('Failed to capture photo.');
        }
    };

    const handleGallery = async () => {
        if (loading) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images' as any,
                base64: true,
                quality: 0.8,
            });
            if (!result.canceled && result.assets[0]?.base64) {
                const a = result.assets[0];
                await processImage(a.uri, a.base64!, a.width, a.height);
            }
        } catch {
            showNotif('Could not open gallery.');
        }
    };

    const handleRetranslate = useCallback(async () => {
        if (!rawBlocks.length || loading || retranslating) return;
        setRetranslating(true);
        try {
            const raw = rawBlocks.map(b => ({ text: b.text, box: b.box, confidence: b.confidence }));
            const result = await ocrTranslateBlocks(raw, sourceLang, targetLang);
            if (result.blocks?.length) {
                setBlocks(result.blocks as OcrBlock[]);
                setFullTranslation(result.blocks.map(b => b.translated_text).filter(Boolean).join(' '));
            }
        } catch (err: any) {
            showNotif(err.message || 'Retranslation failed.');
        } finally {
            setRetranslating(false);
        }
    }, [rawBlocks, sourceLang, targetLang, loading, retranslating]);

    const handleNewPhoto = () => {
        setScreenState('camera');
        setPhotoUri(null);
        setPhotoSize(null);
        setOcrSize(null);
        setBlocks([]);
        setRawBlocks([]);
        setFullTranslation('');
    };

    // ─── Derived layout for result image ─────────────────────────

    const effectiveSize = ocrSize ?? photoSize;
    const imgW = SCREEN_W;
    const imgH = effectiveSize ? imgW * (effectiveSize.height / effectiveSize.width) : 300;
    const scaleX = effectiveSize ? imgW / effectiveSize.width : 1;
    const scaleY = effectiveSize ? imgH / effectiveSize.height : 1;

    const srcName = SUPPORTED_LANGUAGES[sourceLang] ?? sourceLang;
    const tgtName = SUPPORTED_LANGUAGES[targetLang] ?? targetLang;

    // ─── Awaiting permission ──────────────────────────────────────

    if (!permission) {
        return (
            <View style={[styles.root, styles.centered]}>
                <FluidAura isDarkMode={isDarkMode} />
                <ActivityIndicator color={isDarkMode ? '#FFF' : '#6366F1'} size="large" />
                <BottomNav />
            </View>
        );
    }

    // ─── Permission denied ────────────────────────────────────────

    if (!permission.granted) {
        return (
            <View style={[styles.root, styles.centered]}>
                <FluidAura isDarkMode={isDarkMode} />
                <View style={[styles.permCard, isDarkMode && styles.permCardDark]}>
                    <Camera size={52} color="#6366F1" />
                    <Text style={[styles.permTitle, isDarkMode && styles.textLight]}>
                        Camera Access Needed
                    </Text>
                    <Text style={styles.permDesc}>
                        Allow camera access to capture and translate text from photos.
                    </Text>
                    <TouchableOpacity style={styles.permPrimaryBtn} onPress={requestPermission}>
                        <Camera size={18} color="#FFF" />
                        <Text style={styles.permPrimaryText}>Allow Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.permSecondaryBtn} onPress={handleGallery}>
                        <FolderOpen size={18} color="#6366F1" />
                        <Text style={styles.permSecondaryText}>Use Gallery Instead</Text>
                    </TouchableOpacity>
                </View>
                <BottomNav />
                <GlassNotification
                    visible={notifVisible}
                    message={notifMessage}
                    onHide={() => setNotifVisible(false)}
                    isDarkMode={isDarkMode}
                />
            </View>
        );
    }

    // ─── Camera Screen ────────────────────────────────────────────

    if (screenState === 'camera') {
        return (
            <View style={styles.root}>
                {/* Full-screen camera */}
                <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing={facing}
                    flash={flash}
                />

                {/* Top bar: language selector + flash */}
                <View style={[styles.camTopBar, { paddingTop: insets.top + 10 }]}>
                    {/* Language selector pill */}
                    <View style={styles.camLangRow}>
                        <TouchableOpacity
                            style={styles.camLangPill}
                            onPress={() => setPickerTarget('source')}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.camLangText}>{srcName}</Text>
                            <ChevronDown size={12} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>

                        <ArrowLeftRight size={14} color="rgba(255,255,255,0.45)" />

                        <TouchableOpacity
                            style={styles.camLangPill}
                            onPress={() => setPickerTarget('target')}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.camLangText}>{tgtName}</Text>
                            <ChevronDown size={12} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    </View>

                    {/* Flash toggle */}
                    <TouchableOpacity
                        style={styles.camIconBtn}
                        onPress={() => setFlash(f => f === 'off' ? 'on' : 'off')}
                        activeOpacity={0.75}
                    >
                        {flash === 'off'
                            ? <ZapOff size={20} color="rgba(255,255,255,0.7)" />
                            : <Zap size={20} color="#FBBF24" fill="#FBBF24" />
                        }
                    </TouchableOpacity>
                </View>

                {/* Viewfinder scan guide */}
                <View style={styles.scanFrame} pointerEvents="none">
                    <View style={[styles.scanCorner, styles.cornerTL]} />
                    <View style={[styles.scanCorner, styles.cornerTR]} />
                    <View style={[styles.scanCorner, styles.cornerBL]} />
                    <View style={[styles.scanCorner, styles.cornerBR]} />
                </View>

                {/* Bottom gradient + hint + controls — box-none so BottomNav below receives touches */}
                <View style={[styles.camBottomArea, { paddingBottom: insets.bottom + NAV_CLEARANCE }]} pointerEvents="box-none">
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.72)']}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                    />
                    <View style={styles.scanHintRow} pointerEvents="none">
                        <ScanText size={14} color="rgba(255,255,255,0.65)" />
                        <Text style={styles.scanHintText}>Point at text to translate</Text>
                    </View>
                    <View style={styles.camControlsRow} pointerEvents="box-none">
                        {/* Gallery */}
                        <TouchableOpacity style={styles.camSideBtn} onPress={handleGallery} activeOpacity={0.75}>
                            <View style={styles.camSideBtnCircle}>
                                <FolderOpen size={24} color="#FFF" />
                            </View>
                            <Text style={styles.camSideLabel}>Gallery</Text>
                        </TouchableOpacity>

                        {/* Shutter */}
                        <TouchableOpacity
                            style={styles.shutterRing}
                            onPress={handleCapture}
                            activeOpacity={0.85}
                            disabled={loading}
                        >
                            <View style={[styles.shutterDot, loading && styles.shutterLoading]}>
                                {loading && <ActivityIndicator size="small" color="#1E293B" />}
                            </View>
                        </TouchableOpacity>

                        {/* Flip */}
                        <TouchableOpacity
                            style={styles.camSideBtn}
                            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
                            activeOpacity={0.75}
                        >
                            <View style={styles.camSideBtnCircle}>
                                <RotateCcw size={24} color="#FFF" />
                            </View>
                            <Text style={styles.camSideLabel}>Flip</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <BottomNav />

                <LanguagePicker
                    visible={pickerTarget !== null}
                    onDismiss={() => setPickerTarget(null)}
                    onSelect={(code) => {
                        if (pickerTarget === 'source') setSourceLang(code);
                        else setTargetLang(code);
                        setPickerTarget(null);
                    }}
                    selected={pickerTarget === 'source' ? sourceLang : targetLang}
                    exclude={pickerTarget === 'source' ? [targetLang] : [sourceLang]}
                />
                <GlassNotification
                    visible={notifVisible}
                    message={notifMessage}
                    onHide={() => setNotifVisible(false)}
                    isDarkMode={isDarkMode}
                />
            </View>
        );
    }

    // ─── Result Screen ────────────────────────────────────────────

    return (
        <View style={[styles.root, isDarkMode ? styles.bgDark : styles.bgLight]}>
            <FluidAura isDarkMode={isDarkMode} />

            {/* Header */}
            <View style={[styles.resultHeader, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={styles.backBtn} onPress={handleNewPhoto} activeOpacity={0.75}>
                    <X size={15} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                    <Text style={[styles.backBtnText, isDarkMode && styles.textLight]}>New Photo</Text>
                </TouchableOpacity>

                {/* Language row */}
                <View style={styles.resultLangRow}>
                    <TouchableOpacity
                        style={[styles.resultLangPill, isDarkMode && styles.resultLangPillDark]}
                        onPress={() => setPickerTarget('source')}
                        disabled={loading || retranslating}
                        activeOpacity={0.75}
                    >
                        <Text style={[styles.resultLangText, isDarkMode && styles.textLight]}>
                            {srcName}
                        </Text>
                        <ChevronDown size={11} color="#94A3B8" />
                    </TouchableOpacity>

                    <ArrowLeftRight size={13} color={isDarkMode ? '#475569' : '#94A3B8'} />

                    <TouchableOpacity
                        style={[styles.resultLangPill, isDarkMode && styles.resultLangPillDark]}
                        onPress={() => setPickerTarget('target')}
                        disabled={loading || retranslating}
                        activeOpacity={0.75}
                    >
                        <Text style={[styles.resultLangText, isDarkMode && styles.textLight]}>
                            {tgtName}
                        </Text>
                        <ChevronDown size={11} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                {/* Retranslate button */}
                {rawBlocks.length > 0 && !loading ? (
                    <TouchableOpacity
                        style={styles.retransBtn}
                        onPress={handleRetranslate}
                        disabled={retranslating}
                        activeOpacity={0.75}
                    >
                        {retranslating
                            ? <ActivityIndicator size="small" color="#6366F1" />
                            : <RefreshCcw size={14} color="#6366F1" />
                        }
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 38 }} />
                )}
            </View>

            {/* Scrollable content */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: NAV_CLEARANCE + 16 }]}
            >
                {/* Photo + overlays */}
                {photoUri && (
                    <View style={{ width: imgW, height: imgH }}>
                        <Image
                            source={{ uri: photoUri }}
                            style={{ width: imgW, height: imgH }}
                            resizeMode="stretch"
                        />

                        {/* Loading shimmer over image */}
                        {loading && (
                            <View style={styles.imgLoadingOverlay}>
                                <View style={styles.imgLoadingCard}>
                                    <ActivityIndicator size="large" color="#6366F1" />
                                    <Text style={styles.imgLoadingTitle}>Analyzing image…</Text>
                                    <Text style={styles.imgLoadingSubtitle}>
                                        Reading and translating text
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Translated text overlay blocks */}
                        {!loading && blocks.map((block, i) => {
                            const [bx, by, bw, bh] = block.box;
                            if (!block.translated_text || bw < 1 || bh < 1) return null;
                            const left = bx * scaleX;
                            const top = by * scaleY;
                            const width = Math.max(bw * scaleX, 28);
                            const height = Math.max(bh * scaleY, 16);
                            const fs = Math.max(9, Math.min(14, height * 0.5));
                            return (
                                <View
                                    key={i}
                                    style={[
                                        styles.overlayBlock,
                                        {
                                            left,
                                            top,
                                            width,
                                            minHeight: height,
                                        },
                                        isDarkMode && styles.overlayBlockDark,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.overlayText,
                                            { fontSize: fs, lineHeight: fs * 1.35 },
                                        ]}
                                        numberOfLines={0}
                                    >
                                        {block.translated_text}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Empty state */}
                {!loading && !blocks.length && photoUri && (
                    <View style={[styles.emptyCard, isDarkMode && styles.emptyCardDark]}>
                        <ScanText size={40} color={isDarkMode ? '#334155' : '#CBD5E1'} />
                        <Text style={[styles.emptyTitle, isDarkMode && styles.textLight]}>
                            No text detected
                        </Text>
                        <Text style={styles.emptyHint}>
                            Try a clearer photo with well-lit, larger text.
                        </Text>
                    </View>
                )}

                {/* Full translation card */}
                {!loading && !!fullTranslation && (
                    <View style={[styles.fullCard, isDarkMode && styles.fullCardDark]}>
                        <Text style={styles.fullCardLabel}>FULL TRANSLATION</Text>
                        <Text style={[styles.fullCardText, isDarkMode && styles.textLight]}>
                            {fullTranslation}
                        </Text>
                    </View>
                )}
            </ScrollView>

            <BottomNav />

            <LanguagePicker
                visible={pickerTarget !== null}
                onDismiss={() => setPickerTarget(null)}
                onSelect={(code) => {
                    if (pickerTarget === 'source') setSourceLang(code);
                    else setTargetLang(code);
                    setPickerTarget(null);
                }}
                selected={pickerTarget === 'source' ? sourceLang : targetLang}
            />
            <GlassNotification
                visible={notifVisible}
                message={notifMessage}
                onHide={() => setNotifVisible(false)}
                isDarkMode={isDarkMode}
            />
        </View>
    );
}

const CORNER_SIZE = 22;
const CORNER_THICK = 2.5;
const CORNER_COLOR = 'rgba(255,255,255,0.85)';

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    bgLight: { backgroundColor: '#F1F5F9' },
    bgDark: { backgroundColor: '#0F172A' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    textLight: { color: '#F8FAFC' },

    // ── Permission card ──
    permCard: {
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderRadius: 28,
        padding: 32,
        marginHorizontal: 28,
        alignItems: 'center',
        gap: 14,
        elevation: 2,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.95)',
    },
    permCardDark: {
        backgroundColor: 'rgba(30,27,75,0.94)',
        borderColor: 'rgba(255,255,255,0.08)',
    },
    permTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1E293B',
        textAlign: 'center',
    },
    permDesc: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
    },
    permPrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        backgroundColor: '#6366F1',
        borderRadius: 16,
        paddingVertical: 14,
    },
    permPrimaryText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    permSecondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        backgroundColor: 'rgba(99,102,241,0.1)',
        borderRadius: 16,
        paddingVertical: 14,
        marginTop: -4,
    },
    permSecondaryText: { color: '#6366F1', fontSize: 15, fontWeight: '700' },

    // ── Camera: top bar ──
    camTopBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 14,
        zIndex: 20,
        gap: 10,
    },
    camLangRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: 'rgba(0,0,0,0.48)',
        borderRadius: 28,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    camLangPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    camLangText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    camIconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.48)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Camera: viewfinder scan guide ──
    scanFrame: {
        position: 'absolute',
        top: SCREEN_H * 0.25,
        left: SCREEN_W * 0.1,
        right: SCREEN_W * 0.1,
        height: SCREEN_H * 0.35,
        zIndex: 5,
    },
    scanCorner: {
        position: 'absolute',
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderColor: CORNER_COLOR,
    },
    cornerTL: {
        top: 0,
        left: 0,
        borderTopWidth: CORNER_THICK,
        borderLeftWidth: CORNER_THICK,
        borderTopLeftRadius: 4,
    },
    cornerTR: {
        top: 0,
        right: 0,
        borderTopWidth: CORNER_THICK,
        borderRightWidth: CORNER_THICK,
        borderTopRightRadius: 4,
    },
    cornerBL: {
        bottom: 0,
        left: 0,
        borderBottomWidth: CORNER_THICK,
        borderLeftWidth: CORNER_THICK,
        borderBottomLeftRadius: 4,
    },
    cornerBR: {
        bottom: 0,
        right: 0,
        borderBottomWidth: CORNER_THICK,
        borderRightWidth: CORNER_THICK,
        borderBottomRightRadius: 4,
    },

    // ── Camera: bottom controls ──
    camBottomArea: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 48,
        zIndex: 15,
    },
    scanHintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 20,
    },
    scanHintText: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 13,
        fontWeight: '500',
    },
    camControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        paddingHorizontal: 16,
        paddingBottom: Platform.OS === 'ios' ? 0 : 8,
    },
    camSideBtn: {
        alignItems: 'center',
        gap: 6,
        minWidth: 64,
    },
    camSideBtnCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    camSideLabel: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 11,
        fontWeight: '500',
    },
    shutterRing: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3.5,
        borderColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shutterDot: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shutterLoading: {
        backgroundColor: 'rgba(255,255,255,0.7)',
    },

    // ── Result: header ──
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingBottom: 8,
        zIndex: 10,
        gap: 8,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(0,0,0,0.06)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    backBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1E293B',
    },
    resultLangRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    resultLangPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.88)',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.95)',
        elevation: 1,
    },
    resultLangPillDark: {
        backgroundColor: 'rgba(30,27,75,0.88)',
        borderColor: 'rgba(255,255,255,0.08)',
    },
    resultLangText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1E293B',
    },
    retransBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(99,102,241,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Result: scroll ──
    scrollContent: {
        paddingBottom: 20,
    },

    // ── Result: image loading overlay ──
    imgLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imgLoadingCard: {
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 24,
        paddingHorizontal: 32,
        paddingVertical: 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    imgLoadingTitle: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
    },
    imgLoadingSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
    },

    // ── Result: translated overlay blocks ──
    overlayBlock: {
        position: 'absolute',
        backgroundColor: 'rgba(8,12,28,0.86)',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
    },
    overlayBlockDark: {
        backgroundColor: 'rgba(30,27,75,0.9)',
    },
    overlayText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },

    // ── Empty state ──
    emptyCard: {
        margin: 18,
        padding: 32,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.88)',
        alignItems: 'center',
        gap: 12,
        elevation: 1,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.95)',
    },
    emptyCardDark: {
        backgroundColor: 'rgba(30,27,75,0.88)',
        borderColor: 'rgba(255,255,255,0.08)',
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1E293B',
        textAlign: 'center',
    },
    emptyHint: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 19,
    },

    // ── Full translation card ──
    fullCard: {
        margin: 14,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 22,
        padding: 20,
        elevation: 1,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.95)',
    },
    fullCardDark: {
        backgroundColor: 'rgba(30,27,75,0.92)',
        borderColor: 'rgba(255,255,255,0.08)',
    },
    fullCardLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.8,
        color: '#94A3B8',
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    fullCardText: {
        fontSize: 16,
        lineHeight: 26,
        color: '#1E293B',
        fontWeight: '500',
    },
});
