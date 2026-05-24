import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAudioSession } from '../hooks/useAudioSession';
import { useLibraryStore } from '../store/libraryStore';
import { useSettingsStore } from '../store/settingsStore';
import '../../global.css';

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
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0F0F0F' },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}
