import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS } from '../../constants/colors';

interface Props {
  progress: number;
  total: number;
}

export function LoadingOverlay({ progress, total }: Props) {
  const percent = total > 0 ? Math.round((progress / total) * 100) : 0;
  return (
    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill}>
      <View style={styles.inner}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.title}>音声生成中...</Text>
        <Text style={styles.sub}>
          {progress} / {total}文 ({percent}%)
        </Text>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
  },
  sub: {
    color: COLORS.muted,
    fontSize: 14,
  },
});
