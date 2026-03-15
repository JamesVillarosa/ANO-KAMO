import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { TouchableOpacity, View } from 'react-native';
import { Menu, Settings as SettingsIcon, Sun, Moon, ArrowLeft } from 'lucide-react-native';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { lightTheme, darkTheme, liquidGlass } from '../src/theme';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { isDarkMode, toggleTheme } = useTheme();
  const activeTheme = isDarkMode ? darkTheme : lightTheme;

  const isIndex = pathname === '/' || pathname === '/index';

  const GlassHeaderIcon = ({ icon: IconComponent, onPress, style }: { icon: any, onPress: () => void, style?: any }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[{ marginHorizontal: 5 }, style]}
    >
      <BlurView
        intensity={20}
        tint={isDarkMode ? 'dark' : 'light'}
        style={[{
          padding: 8,
          borderRadius: 12,
          overflow: 'hidden',
        }, liquidGlass]}
      >
        <IconComponent color={activeTheme.colors.text} size={20} />
      </BlurView>
    </TouchableOpacity>
  );

  const mainScreenOptions = {
    headerStyle: { backgroundColor: 'transparent' },
    headerShadowVisible: false,
    headerTransparent: true,
    headerTitleAlign: 'center' as const,
    headerTitleStyle: {
      color: activeTheme.colors.text,
      fontWeight: '700' as const,
      fontSize: 18,
      letterSpacing: 1.5,
    },
    headerLeft: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
        {!isIndex ? (
          <GlassHeaderIcon icon={ArrowLeft} onPress={() => router.back()} />
        ) : (
          <GlassHeaderIcon icon={Menu} onPress={() => router.push('/history' as any)} />
        )}
      </View>
    ),
    headerRight: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
        <GlassHeaderIcon icon={SettingsIcon} onPress={() => router.push('/settings' as any)} />
      </View>
    ),
  };

  return (
    <PaperProvider theme={activeTheme}>
      <Stack initialRouteName="splash">
        <Stack.Screen
          name="splash"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen name="index" options={{ ...mainScreenOptions, title: 'ANO-KAMO?' }} />
        <Stack.Screen name="conversation" options={{ ...mainScreenOptions, title: 'Chat' }} />
        <Stack.Screen name="ocr" options={{ ...mainScreenOptions, title: 'Camera' }} />
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
      <RootLayoutContent />
    </ThemeProvider>
  );
}
