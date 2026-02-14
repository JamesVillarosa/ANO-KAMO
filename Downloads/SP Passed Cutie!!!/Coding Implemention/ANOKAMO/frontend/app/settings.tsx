import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, List, Switch, Divider, useTheme, Avatar, Button } from 'react-native-paper';

export default function SettingsScreen() {
    const theme = useTheme();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [highQualityAudio, setHighQualityAudio] = useState(true);
    const [autoDetectTone, setAutoDetectTone] = useState(true);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.profileSection}>
                <Avatar.Icon size={80} icon="account" style={{ backgroundColor: theme.colors.primary }} />
                <Text variant="headlineSmall" style={styles.userName}>Guest User</Text>
                <Text variant="bodyMedium" style={styles.userEmail}>guest@ano-kamo.dev</Text>
                <Button mode="outlined" style={styles.editButton}>Edit Profile</Button>
            </View>

            <List.Section>
                <List.Subheader>Preferences</List.Subheader>
                <List.Item
                    title="Dark Mode"
                    left={props => <List.Icon {...props} icon="brightness-6" />}
                    right={() => (
                        <Switch value={isDarkMode} onValueChange={setIsDarkMode} color={theme.colors.primary} />
                    )}
                />
                <Divider />
                <List.Item
                    title="High Quality Audio"
                    description="Better voice quality (uses more data)"
                    left={props => <List.Icon {...props} icon="volume-high" />}
                    right={() => (
                        <Switch value={highQualityAudio} onValueChange={setHighQualityAudio} color={theme.colors.primary} />
                    )}
                />
                <Divider />
                <List.Item
                    title="Auto-detect Tone"
                    description="Automatically suggest translation tone"
                    left={props => <List.Icon {...props} icon="auto-fix" />}
                    right={() => (
                        <Switch value={autoDetectTone} onValueChange={setAutoDetectTone} color={theme.colors.primary} />
                    )}
                />
            </List.Section>

            <List.Section>
                <List.Subheader>Account & Data</List.Subheader>
                <List.Item
                    title="Clear History"
                    left={props => <List.Icon {...props} icon="delete-sweep" iconColor="#EF4444" />}
                    onPress={() => { }}
                />
                <Divider />
                <List.Item
                    title="Language Packages"
                    description="Download for offline use"
                    left={props => <List.Icon {...props} icon="download" />}
                    onPress={() => { }}
                />
            </List.Section>

            <List.Section>
                <List.Subheader>About</List.Subheader>
                <List.Item
                    title="Version"
                    right={() => <Text variant="bodyMedium">0.1.0</Text>}
                />
                <List.Item
                    title="Terms of Service"
                    onPress={() => { }}
                />
                <List.Item
                    title="Privacy Policy"
                    onPress={() => { }}
                />
            </List.Section>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Made with ❤️ for the Philippines</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    profileSection: {
        alignItems: 'center',
        padding: 32,
        backgroundColor: '#fff',
    },
    userName: {
        marginTop: 16,
        fontWeight: 'bold',
    },
    userEmail: {
        color: '#64748B',
        marginBottom: 16,
    },
    editButton: {
        borderRadius: 8,
    },
    footer: {
        padding: 32,
        alignItems: 'center',
    },
    footerText: {
        color: '#94A3B8',
        fontSize: 12,
    },
});
