import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS } from '../../constants/colors';
import { SPEED_STEPS } from '../../constants/speeds';
import { useReaderStore } from '../../store/readerStore';
import { useSettingsStore } from '../../store/settingsStore';

interface Props {
  onPlay: () => void;
  onPause: () => void;
  onSkipForward: () => void;
  onSkipBack: () => void;
}

export function PlayerBar({ onPlay, onPause, onSkipForward, onSkipBack }: Props) {
  const { isPlaying } = useReaderStore();
  const { speedStepIdx, setSpeedIdx } = useSettingsStore();

  const cycleSpeed = () => {
    setSpeedIdx((speedStepIdx + 1) % SPEED_STEPS.length);
  };

  return (
    <BlurView intensity={80} tint="dark" style={styles.container}>
      <TouchableOpacity onPress={cycleSpeed} style={styles.speedBtn}>
        <Text style={styles.speedText}>{SPEED_STEPS[speedStepIdx]}x</Text>
      </TouchableOpacity>

      <View style={styles.controls}>
        <TouchableOpacity onPress={onSkipBack} style={styles.iconBtn}>
          <Text style={styles.iconText}>⏮</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={isPlaying ? onPause : onPlay}
          style={styles.playBtn}
        >
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSkipForward} style={styles.iconBtn}>
          <Text style={styles.iconText}>⏭</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  speedBtn: {
    width: 52,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  controls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  iconBtn: {
    padding: 8,
  },
  iconText: {
    fontSize: 22,
    color: COLORS.mutedLight,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 22,
    color: COLORS.white,
  },
  spacer: { width: 52 },
});
