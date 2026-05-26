import { useEffect } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { AppState } from 'react-native';

async function configureSession() {
  await Audio.setAudioModeAsync({
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
  });
}

export function useAudioSession() {
  useEffect(() => {
    configureSession();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') configureSession();
    });
    return () => sub.remove();
  }, []);
}
