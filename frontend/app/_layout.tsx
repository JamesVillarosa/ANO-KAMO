import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { View, TouchableOpacity } from 'react-native';
import { Menu, Settings as SettingsIcon } from 'lucide-react-native';
import { theme } from '../src/theme';

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: 'transparent',
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTransparent: true,
          headerTitleAlign: 'center',
          headerTitleStyle: {
            color: '#1E293B',
            fontWeight: 'bold',
            fontSize: 18,
            letterSpacing: 1,
          },
          headerLeft: () => (
            <TouchableOpacity style={{ marginLeft: 20 }}>
              <Menu color="#1E293B" size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity style={{ marginRight: 20 }}>
              <SettingsIcon color="#1E293B" size={24} />
            </TouchableOpacity>
          ),
        }}
      >
        <Stack.Screen name="index" options={{ title: 'ANO-KAMO?' }} />
        <Stack.Screen name="translate" options={{ title: 'Translate' }} />
        <Stack.Screen name="conversation" options={{ title: 'Conversation' }} />
        <Stack.Screen name="ocr" options={{ title: 'OCR Translation' }} />
        <Stack.Screen name="history" options={{ title: 'History' }} />
        <Stack.Screen name="community" options={{ title: 'Community' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </PaperProvider>
  );
}
