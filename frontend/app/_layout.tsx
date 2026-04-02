import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { TouchableOpacity, View, Platform } from 'react-native';
import { Menu, Settings as SettingsIcon, ArrowLeft } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { lightTheme, darkTheme, liquidGlass } from '../src/theme';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { ConversationProvider } from '../src/context/ConversationContext';

function HeaderIconBtn({ icon: IconComponent, onPress, isDarkMode }: { icon: any; onPress: () => void; isDarkMode: boolean }) {
    const color = isDarkMode ? '#F1F5F9' : '#1E293B';
    if (Platform.OS === 'ios') {
        return (
            <TouchableOpacity onPress={onPress} style={{ marginHorizontal: 4 }}>
                <BlurView
                    intensity={20}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={{
                        padding: 9,
                        borderRadius: 50,
                        overflow: 'hidden',
                        borderWidth: 0.5,
                        borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)',
                    }}
                >
                    <IconComponent color={color} size={20} />
                </BlurView>
            </TouchableOpacity>
        );
    }
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[{
                padding: 9,
                borderRadius: 50,
                marginHorizontal: 4,
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 3,
                elevation: 2,
            }]}
        >
            <IconComponent color={color} size={20} />
        </TouchableOpacity>
    );
}

function RootLayoutContent() {
    const router = useRouter();
    const pathname = usePathname();
    const { isDarkMode } = useTheme();
    const activeTheme = isDarkMode ? darkTheme : lightTheme;

    const isIndex = pathname === '/' || pathname === '/index';

    const mainScreenOptions = {
        headerStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTransparent: true,
        headerTitleAlign: 'center' as const,
        headerTitleStyle: {
            color: isDarkMode ? '#F8FAFC' : '#1E293B',
            fontWeight: '800' as const,
            fontSize: 17,
            letterSpacing: 1.5,
        },
        headerLeft: () => (
            <View style={{ marginLeft: 10 }}>
                {!isIndex ? (
                    <HeaderIconBtn icon={ArrowLeft} onPress={() => router.back()} isDarkMode={isDarkMode} />
                ) : (
                    <HeaderIconBtn icon={Menu} onPress={() => router.push('/history' as any)} isDarkMode={isDarkMode} />
                )}
            </View>
        ),
        headerRight: () => (
            <View style={{ marginRight: 10 }}>
                <HeaderIconBtn icon={SettingsIcon} onPress={() => router.push('/settings' as any)} isDarkMode={isDarkMode} />
            </View>
        ),
    };

    return (
        <PaperProvider theme={activeTheme}>
            <Stack initialRouteName="splash">
                <Stack.Screen name="splash" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="index" options={{ ...mainScreenOptions, title: 'ANO-KAMO?' }} />
                <Stack.Screen name="conversation" options={{ headerShown: false }} />
                <Stack.Screen name="ocr" options={{ ...mainScreenOptions, title: 'Camera' }} />
                <Stack.Screen name="translate" options={{ headerShown: false }} />
                <Stack.Screen name="history" options={{ ...mainScreenOptions, title: 'History' }} />
                <Stack.Screen name="community" options={{ ...mainScreenOptions, title: 'Community' }} />
                <Stack.Screen name="settings" options={{ ...mainScreenOptions, title: 'Settings' }} />
            </Stack>
        </PaperProvider>
    );
}

export default function RootLayout() {
    return (
        <ThemeProvider>
            <ConversationProvider>
                <RootLayoutContent />
            </ConversationProvider>
        </ThemeProvider>
    );
}
