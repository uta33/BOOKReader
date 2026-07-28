import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../constants/colors';
import { useAudioSession } from '../hooks/useAudioSession';
import { useLibraryStore } from '../store/libraryStore';
import { useSettingsStore } from '../store/settingsStore';
import { ensureSession, isApiConfigured } from '../services/authClient';
import { installSyncScheduler, syncNow } from '../services/syncEngine';
import { completePendingLocalWipe } from '../services/accountClient';

export default function RootLayout() {
  useAudioSession();
  const loadLibrary = useLibraryStore((s) => s.loadLibrary);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    let disposeSync: (() => void) | undefined;
    let subscription: ReturnType<typeof AppState.addEventListener> | undefined;
    void (async () => {
      await loadSettings();
      await loadLibrary();
      await completePendingLocalWipe();
      if (isApiConfigured()) {
        await ensureSession();
        disposeSync = installSyncScheduler();
        await syncNow();
      }
      subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void syncNow().catch(() => undefined);
      });
    })().catch(() => undefined);
    return () => {
      subscription?.remove();
      disposeSync?.();
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}
