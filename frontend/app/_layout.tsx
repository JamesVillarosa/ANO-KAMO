import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { TouchableOpacity } from 'react-native';
import { Menu, Settings as SettingsIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '../src/theme';

export default function RootLayout() {
  const router = useRouter();

  return (
    <PaperProvider theme={theme}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerShadowVisible: false,
          headerTransparent: true,
          headerTitleAlign: 'center',
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
        }}
      >
        <Stack.Screen name="index" options={{ title: 'ANO-KAMO?' }} />
        <Stack.Screen name="conversation" options={{ title: 'ANO-KAMO?' }} />
        <Stack.Screen name="ocr" options={{ title: 'ANO-KAMO?' }} />
        <Stack.Screen name="history" options={{ title: 'History' }} />
        <Stack.Screen name="community" options={{ title: 'Community' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </PaperProvider>
  );
}
