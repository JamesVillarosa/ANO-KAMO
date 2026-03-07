import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Tooltip from 'react-native-walkthrough-tooltip';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native-paper';

interface CoachmarkManagerProps {
    children: React.ReactNode;
    visible: boolean;
}

const COACHMARK_SHOWN_KEY = '@coachmark_dictionary_v1';

/**
 * Manages one-time coachmarks (tooltips) for feature discoverability.
 * Points to the first translation and explains tap-to-lookup.
 */
export default function CoachmarkManager({ children, visible }: CoachmarkManagerProps) {
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);
    const [wasShown, setWasShown] = useState(true); // Default to true until checked

    useEffect(() => {
        const checkStatus = async () => {
            const shown = await AsyncStorage.getItem(COACHMARK_SHOWN_KEY);
            setWasShown(!!shown);
            // Show only if not shown before AND parent says we should be visible
            if (!shown && visible) {
                setIsTooltipVisible(true);
            }
        };
        checkStatus();
    }, [visible]);

    const handleClose = async () => {
        setIsTooltipVisible(false);
        await AsyncStorage.setItem(COACHMARK_SHOWN_KEY, 'true');
        setWasShown(true);
    };

    return (
        <Tooltip
            isVisible={isTooltipVisible}
            content={
                <View style={styles.tooltipContent}>
                    <Text style={styles.tooltipText}>
                        Tip: Tap any word for its dictionary definition & regional slang notes.
                    </Text>
                </View>
            }
            placement="bottom"
            onClose={handleClose}
            useInteraction={true}
            arrowStyle={styles.arrow}
            contentStyle={styles.content}
            backgroundColor="rgba(0,0,0,0.3)"
        >
            {children}
        </Tooltip>
    );
}

const styles = StyleSheet.create({
    tooltipContent: {
        padding: 10,
    },
    tooltipText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    content: {
        backgroundColor: '#3B82F6',
        borderRadius: 16,
        padding: 12,
        maxWidth: 250,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    arrow: {
        borderTopColor: '#3B82F6',
    },
});
