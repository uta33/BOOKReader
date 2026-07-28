import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_KEY = 'bookreader_device_id';

let cached: string | undefined;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const stored = await AsyncStorage.getItem(DEVICE_KEY);
  if (stored) {
    cached = stored;
    return stored;
  }
  cached = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_KEY, cached);
  return cached;
}
