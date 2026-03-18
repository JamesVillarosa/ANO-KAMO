/**
 * Device ID Utilities
 * Manages unique device identification for history and favorites
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = '@ano_kamo_device_id';

/**
 * Get or create a unique device ID
 * Uses platform-specific identifiers or generates a UUID
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Check if we already have a device ID stored
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      return stored;
    }

    // Generate or retrieve platform-specific ID
    let deviceId: string;

    if (Platform.OS === 'android') {
      deviceId = Application.androidId || generateUUID();
    } else if (Platform.OS === 'ios') {
      deviceId = await Application.getIosIdForVendorAsync() || generateUUID();
    } else {
      // Web or other platforms
      deviceId = generateUUID();
    }

    // Store for future use
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    // Fallback to session-based UUID
    return generateUUID();
  }
}

/**
 * Generate a simple UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
