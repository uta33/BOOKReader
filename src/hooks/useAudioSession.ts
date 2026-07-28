import { useEffect } from 'react';
import { setAudioModeAsync } from 'expo-audio';
import { AppState } from 'react-native';

async function configureSession() {
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    shouldPlayInBackground: true,
    allowsRecording: false,
    shouldRouteThroughEarpiece: false,
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
