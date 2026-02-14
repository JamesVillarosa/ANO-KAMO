import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { TouchableOpacity } from 'react-native';
import { Menu, Settings as SettingsIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '../src/theme';

export default function RootLayout() {
  const router = useRouter();

  const mainScreenOptions = {
    headerStyle: { backgroundColor: 'transparent' },
    headerShadowVisible: false,
    headerTransparent: true,
    headerTitleAlign: 'center' as const,
    headerTitleStyle: {
      color: '#1E293B',
      fontWeight: '700' as const,
      fontSize: 18,
      letterSpacing: 1.5,
    },
    headerLeft: () => (
      <TouchableOpacity
        style={{ marginLeft: 20, padding: 4 }}
        onPress={() => router.push('/history' as any)}
      >
        <Menu color="#1E293B" size={24} />
      </TouchableOpacity>
    ),
    headerRight: () => (
      <TouchableOpacity
        style={{ marginRight: 20, padding: 4 }}
        onPress={() => router.push('/settings' as any)}
      >
        <SettingsIcon color="#1E293B" size={24} />
      </TouchableOpacity>
    ),
  };

  return (
    <PaperProvider theme={theme}>
      <Stack initialRouteName="splash">
        <Stack.Screen
          name="splash"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen name="index" options={{ ...mainScreenOptions, title: 'ANO-KAMO?' }} />
        <Stack.Screen name="conversation" options={{ ...mainScreenOptions, title: 'ANO-KAMO?' }} />
        <Stack.Screen name="ocr" options={{ ...mainScreenOptions, title: 'ANO-KAMO?' }} />
        <Stack.Screen name="history" options={{ ...mainScreenOptions, title: 'History' }} />
        <Stack.Screen name="community" options={{ ...mainScreenOptions, title: 'Community' }} />
        <Stack.Screen name="settings" options={{ ...mainScreenOptions, title: 'Settings' }} />
      </Stack>
    </PaperProvider>
  );
}
