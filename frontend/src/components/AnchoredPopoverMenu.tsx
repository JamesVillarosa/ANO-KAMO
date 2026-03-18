/**
 * Anchored Popover Menu Component
 * Dynamically positions menu above/below anchor button with proper overflow handling
 */
import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Dimensions,
    Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { BlurView } from 'expo-blur';

interface MenuItem {
    label: string;
    onPress: () => void;
    destructive?: boolean;
}

interface AnchoredPopoverMenuProps {
    visible: boolean;
    onDismiss: () => void;
    anchorPosition: { x: number; y: number; width: number; height: number };
    items: MenuItem[];
    isDarkMode?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AnchoredPopoverMenu({
    visible,
    onDismiss,
    anchorPosition,
    items,
    isDarkMode = false,
}: AnchoredPopoverMenuProps) {
    const [position, setPosition] = useState<'above' | 'below'>('above');
    const menuHeight = items.length * 48 + 16; // Estimate menu height

    useEffect(() => {
        // Determine if menu should appear above or below anchor
        const spaceAbove = anchorPosition.y;
        const spaceBelow = SCREEN_HEIGHT - (anchorPosition.y + anchorPosition.height);

        if (spaceAbove >= menuHeight + 8) {
            setPosition('above');
        } else if (spaceBelow >= menuHeight + 8) {
            setPosition('below');
        } else {
            // Default to above if neither fits perfectly
            setPosition(spaceAbove > spaceBelow ? 'above' : 'below');
        }
    }, [anchorPosition, menuHeight]);

    if (!visible) return null;

    const menuTop = position === 'above'
        ? anchorPosition.y - menuHeight - 8
        : anchorPosition.y + anchorPosition.height + 8;

    const menuRight = Dimensions.get('window').width - anchorPosition.x - anchorPosition.width;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={onDismiss}
            >
                <View
                    style={[
                        styles.menuContainer,
                        {
                            top: menuTop,
                            right: menuRight,
                        },
                    ]}
                >
                    <BlurView
                        intensity={isDarkMode ? 40 : 60}
                        tint={isDarkMode ? 'dark' : 'light'}
                        style={styles.menuBlur}
                    >
                        {items.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.menuItem,
                                    index < items.length - 1 && styles.menuItemBorder,
                                ]}
                                onPress={() => {
                                    item.onPress();
                                    onDismiss();
                                }}
                            >
                                <Text
                                    style={[
                                        styles.menuItemText,
                                        isDarkMode && styles.menuItemTextDark,
                                        item.destructive && styles.menuItemTextDestructive,
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </BlurView>

                    {/* Caret triangle */}
                    <View
                        style={[
                            styles.caret,
                            position === 'above' ? styles.caretDown : styles.caretUp,
                            {
                                right: 16,
                                [position === 'above' ? 'bottom' : 'top']: -8,
                            },
                        ]}
                    >
                        <View
                            style={[
                                styles.caretInner,
                                isDarkMode ? styles.caretInnerDark : styles.caretInnerLight,
                                position === 'above' ? styles.caretInnerDown : styles.caretInnerUp,
                            ]}
                        />
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    menuContainer: {
        position: 'absolute',
        minWidth: 200,
        maxWidth: 280,
        borderRadius: 16,
        overflow: 'visible',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    menuBlur: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        overflow: 'hidden',
        paddingVertical: 8,
    },
    menuItem: {
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    menuItemBorder: {
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },
    menuItemText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1E293B',
    },
    menuItemTextDark: {
        color: '#E2E8F0',
    },
    menuItemTextDestructive: {
        color: '#EF4444',
    },
    caret: {
        position: 'absolute',
        width: 16,
        height: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    caretInner: {
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
    caretInnerLight: {
        borderTopColor: 'rgba(255, 255, 255, 0.9)',
    },
    caretInnerDark: {
        borderTopColor: 'rgba(30, 41, 59, 0.9)',
    },
    caretDown: {
        // When menu is above button, caret points down
    },
    caretUp: {
        // When menu is below button, caret points up
        transform: [{ rotate: '180deg' }],
    },
    caretInnerDown: {
        borderTopWidth: 8,
    },
    caretInnerUp: {
        borderTopWidth: 8,
    },
});
