import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    Alert,
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
    Pause,
    Play,
} from 'lucide-react-native';
import { gradientColors, darkGradientColors } from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import BottomNav from '../src/components/BottomNav';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ocrScan } from '../src/lib/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// How often to scan (ms)
const SCAN_INTERVAL = 2000;

interface TextBlock {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
}

export default function OCRScreen() {
    const { isDarkMode } = useTheme();

    // Camera
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);

    // State
    const [flashOn, setFlashOn] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
    const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
    const [galleryImage, setGalleryImage] = useState<string | null>(null);
    const [sourceLang] = useState('tl');

    // Refs
    const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isScanningRef = useRef(false);

    useEffect(() => {
        if (!permission || !permission.granted) {
            requestPermission();
        }
    }, [permission]);

    // ─── Auto-scan: capture snapshot → send to backend → overlay ───
    const runScan = useCallback(async () => {
        if (isScanningRef.current || isPaused || galleryImage) return;
        if (!cameraRef.current) return;

        isScanningRef.current = true;
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.5,
                base64: true,
                skipProcessing: true,
            });

            if (photo?.base64) {
                const result = await ocrScan(photo.base64, sourceLang);

                if (result.image_width > 0) {
                    setImageSize({ w: result.image_width, h: result.image_height });
                    setTextBlocks(result.blocks);
                }
            }
        } catch (e) {
            // Silently handle — camera may be transitioning
            console.log('Scan skipped:', e);
        }
        isScanningRef.current = false;
    }, [isPaused, galleryImage, sourceLang]);

    // Start/stop scan interval
    useEffect(() => {
        if (permission?.granted && !isPaused && !galleryImage) {
            setIsScanning(true);
            scanIntervalRef.current = setInterval(runScan, SCAN_INTERVAL);
            // First scan after short delay for camera to stabilize
            setTimeout(runScan, 800);

            return () => {
                if (scanIntervalRef.current) {
                    clearInterval(scanIntervalRef.current);
                    scanIntervalRef.current = null;
                }
                setIsScanning(false);
            };
        } else {
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
                scanIntervalRef.current = null;
            }
            setIsScanning(false);
        }
    }, [permission?.granted, isPaused, galleryImage, runScan]);

    // ─── Gallery OCR ───
    const handleGallery = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission needed', 'Gallery access is required');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            base64: true,
            mediaTypes: ['images'],
        });

        if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            setGalleryImage(asset.uri);
            setIsPaused(true);

            if (asset.base64) {
                try {
                    const scanResult = await ocrScan(asset.base64, sourceLang);
                    if (scanResult.image_width > 0) {
                        setImageSize({ w: scanResult.image_width, h: scanResult.image_height });
                        setTextBlocks(scanResult.blocks);
                    }
                } catch (e: any) {
                    Alert.alert('OCR Error', e?.message || 'Could not process image');
                }
            } else {
                // Read file as base64 if picker didn't include it
                try {
                    const b64 = await FileSystem.readAsStringAsync(asset.uri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                    const scanResult = await ocrScan(b64, sourceLang);
                    if (scanResult.image_width > 0) {
                        setImageSize({ w: scanResult.image_width, h: scanResult.image_height });
                        setTextBlocks(scanResult.blocks);
                    }
                } catch (e: any) {
                    Alert.alert('OCR Error', e?.message || 'Could not process image');
                }
            }
        }
    };

    // ─── Pause / Resume ───
    const togglePause = () => {
        if (galleryImage) {
            setGalleryImage(null);
            setTextBlocks([]);
            setIsPaused(false);
        } else {
            setIsPaused(!isPaused);
        }
    };

    // ─── Overlay rendering ───
    const getOverlayStyle = (block: TextBlock) => {
        if (!imageSize) return { top: 0, left: 0, width: 0, height: 0 };

        const viewW = SCREEN_WIDTH;
        const viewH = SCREEN_HEIGHT;

        const scaleX = viewW / imageSize.w;
        const scaleY = viewH / imageSize.h;

        return {
            position: 'absolute' as const,
            left: block.x * scaleX,
            top: block.y * scaleY,
            width: block.width * scaleX,
            height: block.height * scaleY,
        };
    };

    const renderOverlayBlocks = () => {
        if (textBlocks.length === 0) return null;

        return textBlocks.map((block, idx) => {
            const boxStyle = getOverlayStyle(block);
            // Vary opacity by confidence
            const opacity = Math.max(0.4, Math.min(0.8, block.confidence / 100));

            return (
                <View
                    key={idx}
                    style={[
                        styles.overlayBox,
                        boxStyle,
                        { backgroundColor: `rgba(59, 130, 246, ${opacity})` },
                    ]}
                >
                    <Text style={styles.overlayText} numberOfLines={0}>
                        {block.text}
                    </Text>
                </View>
            );
        });
    };

    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <LinearGradient colors={isDarkMode ? darkGradientColors : gradientColors} style={styles.bg} />

            {/* Camera / Image Viewfinder */}
            <View style={styles.viewfinder}>
                {galleryImage ? (
                    <Image source={{ uri: galleryImage }} style={styles.cameraFeed} resizeMode="cover" />
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

                {/* Text Overlay */}
                <View style={styles.overlayContainer} pointerEvents="none">
                    {renderOverlayBlocks()}
                </View>

                {/* Scanning indicator */}
                {isScanning && !isPaused && (
                    <View style={styles.scanIndicator}>
                        <View style={styles.scanDot} />
                        <Text style={styles.scanText}>Scanning...</Text>
                    </View>
                )}

                {/* Paused indicator */}
                {isPaused && (
                    <View style={styles.pauseIndicator}>
                        <Pause size={16} color="#FFF" />
                        <Text style={styles.pauseText}>
                            {galleryImage ? 'Gallery Image' : 'Paused'}
                        </Text>
                    </View>
                )}

                {/* Text block count */}
                {textBlocks.length > 0 && (
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>
                            {textBlocks.length} text {textBlocks.length === 1 ? 'block' : 'blocks'}
                        </Text>
                    </View>
                )}

                {/* Bottom Controls */}
                <View style={styles.bottomArea}>
                    <BlurView intensity={40} tint="dark" style={styles.bottomControls}>
                        {/* Gallery */}
                        <TouchableOpacity style={styles.sideBtn} onPress={handleGallery}>
                            <ImagePlus size={22} color="#FFF" />
                        </TouchableOpacity>

                        {/* Shutter = Pause/Resume */}
                        <TouchableOpacity style={styles.shutterBtn} onPress={togglePause}>
                            {isPaused ? (
                                <Play size={28} color="#FFF" fill="#FFF" />
                            ) : (
                                <Pause size={28} color="#FFF" fill="#FFF" />
                            )}
                        </TouchableOpacity>

                        {/* Flash */}
                        <TouchableOpacity style={styles.sideBtn} onPress={() => setFlashOn(!flashOn)}>
                            {flashOn ? (
                                <Zap size={22} color="#F59E0B" />
                            ) : (
                                <ZapOff size={22} color="#FFF" />
                            )}
                        </TouchableOpacity>
                    </BlurView>
                </View>
            </View>

            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    containerDark: { backgroundColor: '#0F172A' },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

    /* Camera full screen */
    viewfinder: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    cameraFeed: {
        flex: 1,
    },
    cameraEmpty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraHint: {
        color: '#64748B',
        fontSize: 14,
        marginTop: 10,
    },

    /* Text overlay */
    overlayContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    overlayBox: {
        borderWidth: 1.5,
        borderColor: 'rgba(96, 165, 250, 0.8)',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 2,
        overflow: 'hidden',
    },
    overlayText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },

    /* Scanning indicator */
    scanIndicator: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        gap: 8,
    },
    scanDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22C55E',
    },
    scanText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },

    /* Paused indicator */
    pauseIndicator: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        gap: 8,
    },
    pauseText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },

    /* Text count badge */
    countBadge: {
        position: 'absolute',
        top: 100,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12,
    },
    countText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '500',
    },

    /* Bottom controls */
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
});
