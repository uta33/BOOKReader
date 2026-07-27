import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../constants/colors';
import { useAudioSession } from '../hooks/useAudioSession';
import { useLibraryStore } from '../store/libraryStore';
import { useSettingsStore } from '../store/settingsStore';

export default function RootLayout() {
  useAudioSession();
  const loadLibrary = useLibraryStore((s) => s.loadLibrary);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadLibrary();
    loadSettings();
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
