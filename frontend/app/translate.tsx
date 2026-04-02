/**
 * Camera Translate Screen
 *
 * Camera screen: full-screen viewfinder with language picker, flash (torch), capture, gallery, flip.
 * Result screen: photo with translated text overlays + full translation card with TTS, dict,
 *   feedback, 3-dot menu. Language change auto-retranslates — no manual reload button.
 * Includes BottomNav (Text | Camera | Conversation).
 */
import React, { useState, useRef } from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Dimensions,
    ScrollView,
    Platform,
    Modal,
    Animated,
    ToastAndroid,
    Alert,
    TextInput as RNTextInput,
} from 'react-native';
import { Text } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Camera,
    FolderOpen,
    RotateCcw,
    Zap,
    ZapOff,
    ArrowLeftRight,
    ScanText,
    X,
    ChevronDown,
    Volume2,
    BookOpen,
    MessageSquare,
    MoreHorizontal,
    ThumbsUp,
    ThumbsDown,
    Send,
} from 'lucide-react-native';
import { useTheme } from '../src/context/ThemeContext';
import { SUPPORTED_LANGUAGES } from '../src/theme';
import { ocrProcessFull, ocrTranslateBlocks, submitFeedback } from '../src/lib/api';
import { getDeviceId } from '../src/utils/device';
import { useTextToSpeech } from '../src/hooks/useTextToSpeech';
import FluidAura from '../src/components/FluidAura';
import BottomNav from '../src/components/BottomNav';
import LanguagePicker from '../src/components/LanguagePicker';
import GlassNotification from '../src/components/GlassNotification';
import AnchoredPopoverMenu from '../src/components/AnchoredPopoverMenu';
import WordCardModal from '../src/components/WordCardModal';
import SentenceBreakdownSheet from '../src/components/SentenceBreakdownSheet';
import { GlassBlur } from '../src/components/GlassBlur';

interface OcrBlock {
    text: string;
    translated_text: string;
    box: number[];
    confidence: number;
    lines?: number;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Bottom nav height + its bottom offset — used to push controls above it
const NAV_CLEARANCE = 106;

export default function TranslateScreen() {
    const { isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef<CameraView>(null);
    const tts = useTextToSpeech();

    const [permission, requestPermission] = useCameraPermissions();
    const [screenState, setScreenState] = useState<'camera' | 'result'>('camera');
    const [facing, setFacing] = useState<'front' | 'back'>('back');
    const [torchOn, setTorchOn] = useState(false);

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

    // TTS / dictionary / feedback / menu state
    const [feedbackGiven, setFeedbackGiven] = useState<'like' | 'dislike' | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const menuButtonRef = useRef<View>(null);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
    const [refineModal, setRefineModal] = useState({ visible: false, originalText: '' });
    const [refineText, setRefineText] = useState('');
    const [dictVisible, setDictVisible] = useState(false);
    const [dictWord, setDictWord] = useState('');
    const [dictSrcLang, setDictSrcLang] = useState('');
    const [dictTgtLang, setDictTgtLang] = useState('');
    const [breakdownVisible, setBreakdownVisible] = useState(false);
    const glowAnim = useRef(new Animated.Value(0)).current;
    const translationIdRef = useRef('');

    const showNotif = (msg: string) => { setNotifMessage(msg); setNotifVisible(true); };

    const showToast = (msg: string) => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(msg, ToastAndroid.SHORT);
        } else {
            Alert.alert('', msg);
        }
    };

    // ─── Core pipeline ────────────────────────────────────────────

    const processImage = async (uri: string, base64: string, w: number, h: number) => {
        setPhotoUri(uri);
        setPhotoSize({ width: w, height: h });
        setOcrSize(null);
        setBlocks([]);
        setRawBlocks([]);
        setFullTranslation('');
        setFeedbackGiven(null);
        setScreenState('result');
        setLoading(true);
        translationIdRef.current = Date.now().toString();
        try {
            const deviceId = await getDeviceId();
            const result = await ocrProcessFull(base64, targetLang, sourceLang, deviceId);
            if (result.error) {
                showNotif(result.error);
            } else if (!result.blocks?.length) {
                showNotif('No readable text found. Try a clearer or closer photo.');
            } else {
                setBlocks(result.blocks);
                setRawBlocks(result.blocks.map((b: OcrBlock) => ({ ...b })));
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
                selectionLimit: 1,
            });
            if (!result.canceled && result.assets[0]?.base64) {
                const a = result.assets[0];
                await processImage(a.uri, a.base64!, a.width, a.height);
            }
        } catch {
            showNotif('Could not open gallery.');
        }
    };

    // Re-translate existing raw blocks with given lang pair
    const retranslateWithLangs = async (srcLang: string, tgtLang: string) => {
        if (!rawBlocks.length || loading || retranslating) return;
        setRetranslating(true);
        try {
            const raw = rawBlocks.map(b => ({ text: b.text, box: b.box, confidence: b.confidence, lines: b.lines ?? 1 }));
            const result = await ocrTranslateBlocks(raw, srcLang, tgtLang);
            if (result.blocks?.length) {
                setBlocks(result.blocks as OcrBlock[]);
                setFullTranslation(
                    result.blocks.map((b: any) => b.translated_text).filter(Boolean).join('\n'),
                );
            }
        } catch (err: any) {
            showNotif(err.message || 'Retranslation failed.');
        } finally {
            setRetranslating(false);
        }
    };

    const handleNewPhoto = () => {
        setScreenState('camera');
        setPhotoUri(null);
        setPhotoSize(null);
        setOcrSize(null);
        setBlocks([]);
        setRawBlocks([]);
        setFullTranslation('');
        setFeedbackGiven(null);
    };

    // Swap source ↔ target; auto-retranslate if result screen has content
    const handleSwapLangs = () => {
        const newSource = targetLang;
        const newTarget = sourceLang;
        setSourceLang(newSource);
        setTargetLang(newTarget);
        if (screenState === 'result' && rawBlocks.length > 0) {
            retranslateWithLangs(newSource, newTarget);
        }
    };

    // ─── TTS / Dictionary / Feedback helpers ─────────────────────

    const copyText = async (text: string) => {
        try {
            await Clipboard.setStringAsync(text);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast('Copied to clipboard');
        } catch { }
    };

    const openDictionary = (text: string) => {
        if (!text.trim()) { showToast('No translation to look up.'); return; }
        setDictSrcLang(sourceLang);
        setDictTgtLang(targetLang);
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length === 1) {
            setDictWord(words[0].replace(/[.,!?;:"""''()[\]{}]/g, '').trim());
            setDictVisible(true);
        } else {
            setDictWord(text);
            setBreakdownVisible(true);
        }
    };

    const triggerGlow = () => {
        Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
            Animated.timing(glowAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
        ]).start();
    };

    const handleFeedback = async (type: 'like' | 'dislike') => {
        if (feedbackGiven === type) { setFeedbackGiven(null); return; }
        setFeedbackGiven(type);
        triggerGlow();
        try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
        try { await submitFeedback(translationIdRef.current, type); } catch { }
    };

    const handleSubmitRefinement = async () => {
        if (!refineText.trim()) return;
        try {
            await submitFeedback(translationIdRef.current, 'dislike', refineText.trim());
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast('Suggestion submitted! Thank you.');
        } catch { }
        setRefineModal({ visible: false, originalText: '' });
        setRefineText('');
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
                {/* Full-screen camera — enableTorch keeps the flashlight on continuously */}
                <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing={facing}
                    enableTorch={torchOn}
                />

                {/* Top bar: language selector + flash toggle */}
                <View style={[styles.camTopBar, { paddingTop: insets.top + 10 }]}>
                    <View style={styles.camLangRow}>
                        <TouchableOpacity
                            style={styles.camLangPill}
                            onPress={() => setPickerTarget('source')}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.camLangText}>{srcName}</Text>
                            <ChevronDown size={12} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>

                        {/* Swap button */}
                        <TouchableOpacity
                            style={styles.camSwapBtn}
                            onPress={handleSwapLangs}
                            activeOpacity={0.75}
                        >
                            <ArrowLeftRight size={14} color="rgba(255,255,255,0.85)" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.camLangPill}
                            onPress={() => setPickerTarget('target')}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.camLangText}>{tgtName}</Text>
                            <ChevronDown size={12} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    </View>

                    {/* Flash toggle: enableTorch keeps light on continuously */}
                    <TouchableOpacity
                        style={[styles.camIconBtn, torchOn && styles.camIconBtnActive]}
                        onPress={() => setTorchOn(t => !t)}
                        activeOpacity={0.75}
                    >
                        {torchOn
                            ? <Zap size={20} color="#FBBF24" fill="#FBBF24" />
                            : <ZapOff size={20} color="rgba(255,255,255,0.7)" />
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

                {/* Bottom gradient + hint + controls — box-none so BottomNav receives touches */}
                <View
                    style={[styles.camBottomArea, { paddingBottom: insets.bottom + NAV_CLEARANCE }]}
                    pointerEvents="box-none"
                >
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
                        <TouchableOpacity style={styles.camSideBtn} onPress={handleGallery} activeOpacity={0.75}>
                            <View style={styles.camSideBtnCircle}>
                                <FolderOpen size={24} color="#FFF" />
                            </View>
                            <Text style={styles.camSideLabel}>Gallery</Text>
                        </TouchableOpacity>

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

    const glowColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            'transparent',
            feedbackGiven === 'dislike' ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)',
        ],
    });

    return (
        <View style={[styles.root, isDarkMode ? styles.bgDark : styles.bgLight]}>
            <FluidAura isDarkMode={isDarkMode} />

            {/* Header */}
            <View style={[styles.resultHeader, { paddingTop: insets.top + 8 }]}>
                {/* Row 1: New Photo button + spinner */}
                <View style={styles.resultHeaderRow1}>
                    <TouchableOpacity style={styles.backBtn} onPress={handleNewPhoto} activeOpacity={0.75}>
                        <X size={15} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                        <Text style={[styles.backBtnText, isDarkMode && styles.textLight]}>New Photo</Text>
                    </TouchableOpacity>
                    {retranslating
                        ? <ActivityIndicator size="small" color="#6366F1" />
                        : null
                    }
                </View>

                {/* Row 2: Language selector centered */}
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
                        <ChevronDown size={13} color="#94A3B8" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.resultSwapBtn}
                        onPress={handleSwapLangs}
                        disabled={loading || retranslating}
                        activeOpacity={0.75}
                    >
                        <ArrowLeftRight size={16} color={isDarkMode ? '#60A5FA' : '#3B82F6'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.resultLangPill, isDarkMode && styles.resultLangPillDark]}
                        onPress={() => setPickerTarget('target')}
                        disabled={loading || retranslating}
                        activeOpacity={0.75}
                    >
                        <Text style={[styles.resultLangText, isDarkMode && styles.textLight]}>
                            {tgtName}
                        </Text>
                        <ChevronDown size={13} color="#94A3B8" />
                    </TouchableOpacity>
                </View>
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

                        {/* Translated text overlay blocks — Google Lens style */}
                        {!loading && blocks.map((block, i) => {
                            const [bx, by, bw, bh] = block.box;
                            if (!block.translated_text || bw < 1 || bh < 1) return null;

                            // Exact box matching the source text bounding box
                            const left = Math.max(0, Math.min(bx * scaleX, imgW - 4));
                            const top = Math.max(0, Math.min(by * scaleY, imgH - 4));
                            const width = Math.max(20, Math.min(bw * scaleX, imgW - left));
                            const height = Math.max(14, Math.min(bh * scaleY, imgH - top));

                            // Three-constraint font size — take the smallest of:
                            // 1. Gemini line-height: (height / lines) × 0.78
                            //    Matches the visual size of the source text.
                            // 2. Geometric estimate: in case Gemini reports lines=1 on a
                            //    tall multi-line block, cap with aspect-ratio heuristic.
                            // 3. Longest-word constraint: the longest word in the
                            //    translation must fit on one line (no mid-word breaks).
                            const srcLines = Math.max(1, block.lines ?? 1);
                            const fsByGemini = (height / srcLines) * 0.78;

                            const geoLines = Math.max(1, Math.round(height / Math.max(width * 0.38, 1)));
                            const fsByGeo = (height / geoLines) * 0.78;

                            const longestWord = block.translated_text
                                .split(/\s+/)
                                .reduce((m, w) => Math.max(m, w.length), 1);
                            const fsByWidth = width / (longestWord * 0.62);

                            const fs = Math.max(9, Math.min(fsByGemini, fsByGeo, fsByWidth, 120));

                            return (
                                <View
                                    key={i}
                                    style={[
                                        styles.overlayBlock,
                                        { left, top, width, height, overflow: 'hidden' },
                                        isDarkMode && styles.overlayBlockDark,
                                    ]}
                                >
                                    <Text
                                        style={[styles.overlayText, { fontSize: fs, lineHeight: fs * 1.2 }]}
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

                {/* Full translation card with TTS / Dict / Feedback / Menu */}
                {!loading && !!fullTranslation && (
                    <View style={[styles.fullCard, isDarkMode && styles.fullCardDark]}>
                        <Text style={styles.fullCardLabel}>FULL TRANSLATION</Text>
                        <Text style={[styles.fullCardText, isDarkMode && styles.textLight]}>
                            {fullTranslation}
                        </Text>

                        <Animated.View
                            style={[
                                styles.actionRow,
                                { backgroundColor: glowColor, borderRadius: 12, paddingHorizontal: 4, marginHorizontal: -4 },
                            ]}
                        >
                            {/* TTS */}
                            <TouchableOpacity
                                style={styles.iconCircle}
                                onPress={() => tts.speak(fullTranslation, targetLang)}
                            >
                                <Volume2 size={18} color="#3B82F6" />
                            </TouchableOpacity>

                            {/* Dictionary */}
                            <TouchableOpacity
                                style={styles.iconCircle}
                                onPress={() => openDictionary(fullTranslation)}
                            >
                                <BookOpen size={18} color="#3B82F6" />
                            </TouchableOpacity>

                            {/* Feedback */}
                            <TouchableOpacity
                                style={[
                                    styles.iconCircle,
                                    feedbackGiven && {
                                        backgroundColor: 'rgba(59,130,246,0.1)',
                                        borderColor: '#3B82F6',
                                    },
                                ]}
                                onPress={() => setFeedbackModalVisible(true)}
                            >
                                <MessageSquare size={18} color="#3B82F6" />
                            </TouchableOpacity>

                            <View style={{ flex: 1 }} />

                            {/* 3-dot menu */}
                            <View ref={menuButtonRef} collapsable={false}>
                                <TouchableOpacity
                                    style={styles.iconCircle}
                                    onPress={() => {
                                        menuButtonRef.current?.measureInWindow((x, y, w, h) => {
                                            setMenuPosition({ x, y, width: w, height: h });
                                            setShowMenu(true);
                                        });
                                    }}
                                >
                                    <MoreHorizontal size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </View>
                )}
            </ScrollView>

            <BottomNav />

            {/* Language picker — auto-retranslates on selection */}
            <LanguagePicker
                visible={pickerTarget !== null}
                onDismiss={() => setPickerTarget(null)}
                onSelect={(code) => {
                    const newSource = pickerTarget === 'source' ? code : sourceLang;
                    const newTarget = pickerTarget === 'target' ? code : targetLang;
                    if (pickerTarget === 'source') setSourceLang(code);
                    else setTargetLang(code);
                    setPickerTarget(null);
                    if (rawBlocks.length > 0) {
                        retranslateWithLangs(newSource, newTarget);
                    }
                }}
                selected={pickerTarget === 'source' ? sourceLang : targetLang}
                exclude={pickerTarget === 'source' ? [targetLang] : [sourceLang]}
            />

            {/* Feedback Modal */}
            <Modal
                visible={feedbackModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setFeedbackModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <GlassBlur
                        intensity={30}
                        tint={isDarkMode ? 'dark' : 'light'}
                        style={[styles.feedbackModal, isDarkMode && styles.feedbackModalDark]}
                    >
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, isDarkMode && { color: '#FFF' }]}>
                                Rate this translation
                            </Text>
                            <TouchableOpacity onPress={() => setFeedbackModalVisible(false)}>
                                <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.feedbackBody, isDarkMode && { color: '#94A3B8' }]}>
                            Your feedback is important to us!
                        </Text>
                        <View style={styles.feedbackBtns}>
                            <TouchableOpacity
                                style={[styles.feedbackBtn, { backgroundColor: 'rgba(34,197,94,0.12)' }]}
                                onPress={() => {
                                    handleFeedback('like');
                                    setFeedbackModalVisible(false);
                                }}
                            >
                                <ThumbsUp size={24} color="#22C55E" />
                                <Text style={[styles.feedbackBtnText, { color: '#22C55E' }]}>Helpful</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.feedbackBtn, { backgroundColor: 'rgba(239,68,68,0.12)' }]}
                                onPress={() => {
                                    handleFeedback('dislike');
                                    setFeedbackModalVisible(false);
                                }}
                            >
                                <ThumbsDown size={24} color="#EF4444" />
                                <Text style={[styles.feedbackBtnText, { color: '#EF4444' }]}>Not helpful</Text>
                            </TouchableOpacity>
                        </View>
                    </GlassBlur>
                </View>
            </Modal>

            {/* Suggest Translation Modal */}
            <Modal
                visible={refineModal.visible}
                transparent
                animationType="slide"
                onRequestClose={() => setRefineModal({ visible: false, originalText: '' })}
            >
                <View style={styles.modalOverlay}>
                    <GlassBlur
                        intensity={30}
                        tint={isDarkMode ? 'dark' : 'light'}
                        style={[styles.feedbackModal, isDarkMode && styles.feedbackModalDark]}
                    >
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, isDarkMode && { color: '#FFF' }]}>
                                Suggest a Translation
                            </Text>
                            <TouchableOpacity
                                onPress={() => setRefineModal({ visible: false, originalText: '' })}
                            >
                                <X size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>
                        <Text
                            style={[styles.refineOriginal, isDarkMode && { color: '#94A3B8' }]}
                            numberOfLines={3}
                        >
                            {refineModal.originalText}
                        </Text>
                        <RNTextInput
                            style={[styles.refineInput, isDarkMode && styles.refineInputDark]}
                            placeholder="Enter your suggested translation..."
                            placeholderTextColor={isDarkMode ? '#475569' : '#94A3B8'}
                            value={refineText}
                            onChangeText={setRefineText}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                        <TouchableOpacity
                            style={[styles.submitBtn, !refineText.trim() && { opacity: 0.4 }]}
                            onPress={handleSubmitRefinement}
                            disabled={!refineText.trim()}
                        >
                            <Send size={16} color="#FFF" />
                            <Text style={styles.submitBtnText}>Submit</Text>
                        </TouchableOpacity>
                    </GlassBlur>
                </View>
            </Modal>

            {/* 3-dot anchored popover */}
            <AnchoredPopoverMenu
                visible={showMenu}
                onDismiss={() => setShowMenu(false)}
                anchorPosition={menuPosition}
                items={[
                    {
                        label: 'Copy',
                        onPress: () => copyText(fullTranslation),
                    },
                    {
                        label: 'Suggest a Translation',
                        onPress: () => {
                            setRefineText(fullTranslation);
                            setRefineModal({ visible: true, originalText: fullTranslation });
                        },
                    },
                ]}
                isDarkMode={isDarkMode}
            />

            {/* Word card (single word) */}
            <WordCardModal
                visible={dictVisible}
                onDismiss={() => setDictVisible(false)}
                word={dictWord}
                sourceLang={dictSrcLang}
                targetLang={dictTgtLang}
            />

            {/* Sentence breakdown sheet (multi-word) */}
            <SentenceBreakdownSheet
                visible={breakdownVisible}
                onClose={() => setBreakdownVisible(false)}
                text={dictWord}
                sourceLang={dictSrcLang}
                targetLang={dictTgtLang}
                onWordPress={(word) => {
                    setBreakdownVisible(false);
                    setDictWord(word);
                    setTimeout(() => setDictVisible(true), 300);
                }}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

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
        gap: 8,
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
    camSwapBtn: {
        padding: 6,
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
    camIconBtnActive: {
        backgroundColor: 'rgba(251,191,36,0.18)',
        borderColor: 'rgba(251,191,36,0.5)',
    },

    // ── Camera: viewfinder scan guide ──
    scanFrame: {
        position: 'absolute',
        top: SCREEN_H * 0.15,
        left: SCREEN_W * 0.06,
        right: SCREEN_W * 0.06,
        height: SCREEN_H * 0.48,
        zIndex: 5,
    },
    scanCorner: {
        position: 'absolute',
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderColor: CORNER_COLOR,
    },
    cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderTopLeftRadius: 4 },
    cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderTopRightRadius: 4 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderBottomLeftRadius: 4 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderBottomRightRadius: 4 },

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
    camSideBtn: { alignItems: 'center', gap: 6, minWidth: 64 },
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
    camSideLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '500' },
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
    shutterLoading: { backgroundColor: 'rgba(255,255,255,0.7)' },

    // ── Result: header ──
    resultHeader: {
        flexDirection: 'column',
        paddingHorizontal: 14,
        paddingBottom: 12,
        zIndex: 10,
        gap: 10,
    },
    resultHeaderRow1: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
    backBtnText: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
    resultLangRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    resultLangPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.95)',
        elevation: 1,
    },
    resultLangPillDark: {
        backgroundColor: 'rgba(30,27,75,0.88)',
        borderColor: 'rgba(255,255,255,0.08)',
    },
    resultLangText: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
    resultSwapBtn: {
        padding: 8,
        borderRadius: 14,
        backgroundColor: 'rgba(59,130,246,0.1)',
    },

    // ── Result: scroll ──
    scrollContent: { paddingBottom: 20 },

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
    imgLoadingTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
    imgLoadingSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },

    // ── Result: translated overlay blocks ──
    overlayBlock: {
        position: 'absolute',
        backgroundColor: 'rgba(8,12,28,0.90)',
        borderRadius: 2,
        paddingHorizontal: 2,
        paddingVertical: 1,
        justifyContent: 'center',
    },
    overlayBlockDark: { backgroundColor: 'rgba(30,27,75,0.9)' },
    overlayText: { color: '#FFFFFF', fontWeight: '700' },

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
    emptyCardDark: { backgroundColor: 'rgba(30,27,75,0.88)', borderColor: 'rgba(255,255,255,0.08)' },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
    emptyHint: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },

    // ── Full translation card ──
    fullCard: {
        margin: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 20,
        elevation: 2,
        borderWidth: 1.5,
        borderColor: 'rgba(99,102,241,0.18)',
    },
    fullCardDark: {
        backgroundColor: '#1E293B',
        borderColor: 'rgba(99,102,241,0.35)',
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
        marginBottom: 14,
    },

    // ── Action row (TTS / Dict / Feedback / Menu) ──
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
        marginTop: 4,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(59,130,246,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(59,130,246,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Modals ──
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    feedbackModal: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.95)',
    },
    feedbackModalDark: {
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.15)',
        alignSelf: 'center',
        marginBottom: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1E293B',
    },
    feedbackBody: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 20,
        lineHeight: 20,
    },
    feedbackBtns: {
        flexDirection: 'row',
        gap: 12,
    },
    feedbackBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 16,
    },
    feedbackBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
    refineOriginal: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 12,
        fontStyle: 'italic',
        lineHeight: 18,
    },
    refineInput: {
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.1)',
        borderRadius: 14,
        padding: 14,
        fontSize: 15,
        color: '#1E293B',
        backgroundColor: 'rgba(0,0,0,0.03)',
        minHeight: 100,
        marginBottom: 14,
    },
    refineInputDark: {
        borderColor: 'rgba(255,255,255,0.12)',
        color: '#F8FAFC',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#6366F1',
        borderRadius: 14,
        paddingVertical: 14,
    },
    submitBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
